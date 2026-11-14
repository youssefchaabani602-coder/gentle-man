import { desc, eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  cashflowEntries,
  discountCodes,
  loyaltyWallets,
  orders,
  products,
} from './schema.ts';
import { ensureSeeded } from './seed.ts';
import {
  buildWhatsAppConfirmationMsg,
  buildWhatsAppTrackingUpdateMsg,
  calculateCartTotals,
  computeCashFlowSummary,
  generateDiscountCode,
  normalizePhone,
  OrderStatus,
  redeemLoyaltyPoints,
} from '../utils/commerce.ts';

export async function listProducts() {
  try {
    await ensureSeeded();
    return await db.select().from(products).orderBy(products.id);
  } catch (error) {
    console.error('Database query failed (listProducts):', error);
    throw new Error('Unable to load product catalog.', { cause: error });
  }
}

export async function createProduct(input: {
  name: string;
  category: string;
  description: string;
  priceTnd: number;
  costTnd: number;
  stock: number;
  pointsReward: number;
  sizes: string[];
  colors: Array<{ name: string; hex: string }>;
  garmentType: string;
  imageKey: string;
  featured?: boolean;
}) {
  try {
    await ensureSeeded();
    const slugBase = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const slug = `${slugBase}-${Date.now().toString(36)}`;
    const [created] = await db
      .insert(products)
      .values({
        slug,
        name: input.name,
        category: input.category,
        description: input.description,
        priceTnd: Math.max(1, Math.round(input.priceTnd)),
        costTnd: Math.max(0, Math.round(input.costTnd)),
        stock: Math.max(0, Math.round(input.stock)),
        pointsReward: Math.max(1, Math.round(input.pointsReward)),
        sizesJson: JSON.stringify(input.sizes),
        colorsJson: JSON.stringify(input.colors),
        garmentType: input.garmentType,
        imageKey: input.imageKey,
        featured: input.featured ?? true,
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Database mutation failed (createProduct):', error);
    throw new Error('Unable to save product.', { cause: error });
  }
}

export async function updateProduct(
  id: number,
  patch: Partial<{
    name: string;
    category: string;
    description: string;
    priceTnd: number;
    costTnd: number;
    stock: number;
    pointsReward: number;
    featured: boolean;
  }>
) {
  try {
    await ensureSeeded();
    const [updated] = await db
      .update(products)
      .set(patch)
      .where(eq(products.id, id))
      .returning();
    return updated ?? null;
  } catch (error) {
    console.error('Database mutation failed (updateProduct):', error);
    throw new Error('Unable to update product.', { cause: error });
  }
}

export async function deleteProduct(id: number) {
  try {
    await ensureSeeded();
    const [deleted] = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning();
    return deleted ?? null;
  } catch (error) {
    console.error('Database mutation failed (deleteProduct):', error);
    throw new Error('Unable to delete product.', { cause: error });
  }
}

export async function getLoyaltyWallet(rawPhone: string) {
  try {
    await ensureSeeded();
    const phone = normalizePhone(rawPhone);
    if (!phone) return null;
    const [wallet] = await db
      .select()
      .from(loyaltyWallets)
      .where(eq(loyaltyWallets.phone, phone));
    const codes = await db
      .select()
      .from(discountCodes)
      .where(eq(discountCodes.phone, phone))
      .orderBy(desc(discountCodes.createdAt));

    return {
      phone,
      customerName: wallet?.customerName ?? '',
      pointsBalance: wallet?.pointsBalance ?? 0,
      lifetimePoints: wallet?.lifetimePoints ?? 0,
      codes,
    };
  } catch (error) {
    console.error('Database query failed (getLoyaltyWallet):', error);
    throw new Error('Unable to retrieve loyalty balance.', { cause: error });
  }
}

export async function redeemWalletPointsForCode(rawPhone: string) {
  try {
    await ensureSeeded();
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      throw new Error('Valid phone number is required.');
    }

    const [wallet] = await db
      .select()
      .from(loyaltyWallets)
      .where(eq(loyaltyWallets.phone, phone));

    if (!wallet || wallet.pointsBalance < 10) {
      throw new Error('At least 10 loyalty points are required to redeem a 10% discount code.');
    }

    const { newBalance } = redeemLoyaltyPoints(wallet.pointsBalance, 10);
    const code = generateDiscountCode();

    await db
      .update(loyaltyWallets)
      .set({
        pointsBalance: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(loyaltyWallets.id, wallet.id));

    const [createdCode] = await db
      .insert(discountCodes)
      .values({
        code,
        phone,
        discountPercent: 10,
        pointsCost: 10,
        isUsed: false,
      })
      .returning();

    return {
      code: createdCode,
      newBalance,
    };
  } catch (error) {
    console.error('Loyalty redemption failed:', error);
    if (error instanceof Error && error.message.includes('10 loyalty points')) {
      throw error;
    }
    throw new Error('Unable to redeem loyalty points.', { cause: error });
  }
}

export async function validateDiscountCode(codeStr: string) {
  try {
    await ensureSeeded();
    const clean = codeStr.trim().toUpperCase();
    if (!clean) return null;
    const [found] = await db
      .select()
      .from(discountCodes)
      .where(eq(discountCodes.code, clean));
    if (!found || found.isUsed) return null;
    return found;
  } catch (error) {
    console.error('Database query failed (validateDiscountCode):', error);
    throw new Error('Unable to validate discount code.', { cause: error });
  }
}

export async function placeOrder(input: {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  city: string;
  discountCode?: string;
  userUid?: string;
  items: Array<{
    productId: number;
    quantity: number;
    size: string;
    color: string;
  }>;
}) {
  try {
    await ensureSeeded();
    const phone = normalizePhone(input.customerPhone);
    if (!phone || !input.customerName.trim() || !input.deliveryAddress.trim() || !input.city.trim()) {
      throw new Error('Customer name, phone, address, and city are required.');
    }
    if (!input.items.length) {
      throw new Error('Cart is empty.');
    }

    const allProducts = await db.select().from(products);
    const productById: Record<number, (typeof allProducts)[number]> = {};
    for (const p of allProducts) {
      productById[p.id] = p;
    }

    const verifiedItems = input.items.map((line) => {
      const prod = productById[line.productId];
      if (!prod) {
        throw new Error(`Product #${line.productId} not found.`);
      }
      const qty = Math.max(1, Math.floor(line.quantity));
      if (prod.stock < qty) {
        throw new Error(`Insufficient stock for ${prod.name}.`);
      }
      return {
        productId: prod.id,
        name: prod.name,
        priceTnd: prod.priceTnd,
        costTnd: prod.costTnd,
        quantity: qty,
        pointsReward: prod.pointsReward,
        size: line.size || 'M',
        color: line.color || 'Classic',
      };
    });

    let appliedDiscountCode: string | null = null;
    let discountPercent = 0;
    let codeRecordId: number | null = null;

    if (input.discountCode && input.discountCode.trim()) {
      const cleanCode = input.discountCode.trim().toUpperCase();
      const [found] = await db
        .select()
        .from(discountCodes)
        .where(eq(discountCodes.code, cleanCode));
      if (!found || found.isUsed) {
        throw new Error('Discount code is invalid or already used.');
      }
      appliedDiscountCode = found.code;
      discountPercent = found.discountPercent;
      codeRecordId = found.id;
    }

    const totals = calculateCartTotals({
      items: verifiedItems,
      discountPercent,
      city: input.city,
    });

    const orderCode = `GTM-${Math.floor(1050 + Math.random() * 8900)}`;

    // Upsert loyalty wallet and add earned points
    const [existingWallet] = await db
      .select()
      .from(loyaltyWallets)
      .where(eq(loyaltyWallets.phone, phone));

    const newPointsBalance = (existingWallet?.pointsBalance ?? 0) + totals.pointsEarned;
    const newLifetimePoints = (existingWallet?.lifetimePoints ?? 0) + totals.pointsEarned;

    await db
      .insert(loyaltyWallets)
      .values({
        phone,
        customerName: input.customerName.trim(),
        userUid: input.userUid ?? null,
        pointsBalance: newPointsBalance,
        lifetimePoints: newLifetimePoints,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: loyaltyWallets.phone,
        set: {
          customerName: input.customerName.trim(),
          pointsBalance: newPointsBalance,
          lifetimePoints: newLifetimePoints,
          updatedAt: new Date(),
        },
      });

    const whatsapp = buildWhatsAppConfirmationMsg({
      orderCode,
      customerName: input.customerName.trim(),
      customerPhone: phone,
      city: input.city.trim(),
      items: verifiedItems,
      subtotalTnd: totals.subtotalTnd,
      discountTnd: totals.discountTnd,
      discountCode: appliedDiscountCode,
      shippingTnd: totals.shippingTnd,
      totalTnd: totals.totalTnd,
      pointsEarned: totals.pointsEarned,
      newPointsBalance,
    });

    const initialLog = [
      {
        status: 'confirmed',
        note: `Order placed online (${input.city.trim()}). Personalized WhatsApp confirmation queued.`,
        whatsappSent: true,
        whatsappPreview: whatsapp.text,
        timestamp: new Date().toISOString(),
      },
    ];

    const [createdOrder] = await db
      .insert(orders)
      .values({
        orderCode,
        userUid: input.userUid ?? null,
        customerName: input.customerName.trim(),
        customerPhone: phone,
        deliveryAddress: input.deliveryAddress.trim(),
        city: input.city.trim(),
        itemsJson: JSON.stringify(verifiedItems),
        subtotalTnd: totals.subtotalTnd,
        discountCode: appliedDiscountCode,
        discountTnd: totals.discountTnd,
        shippingTnd: totals.shippingTnd,
        totalTnd: totals.totalTnd,
        pointsEarned: totals.pointsEarned,
        status: 'confirmed',
        whatsappMessage: whatsapp.text,
        trackingLogJson: JSON.stringify(initialLog),
      })
      .returning();

    // Decrement stock
    for (const item of verifiedItems) {
      await db
        .update(products)
        .set({ stock: sql`GREATEST(0, ${products.stock} - ${item.quantity})` })
        .where(eq(products.id, item.productId));
    }

    // Mark discount code as used
    if (codeRecordId) {
      await db
        .update(discountCodes)
        .set({ isUsed: true, usedOnOrderCode: orderCode })
        .where(eq(discountCodes.id, codeRecordId));
    }

    // Record revenue in Cash Flow ledger
    const today = new Date().toISOString().slice(0, 10);
    await db.insert(cashflowEntries).values({
      entryType: 'income',
      category: 'Sale',
      description: `Online Order #${orderCode} (${input.customerName.trim()} — ${input.city.trim()})`,
      amountTnd: totals.totalTnd,
      referenceCode: orderCode,
      entryDate: today,
    });

    return {
      order: createdOrder,
      whatsappUrl: whatsapp.waUrl,
      newPointsBalance,
    };
  } catch (error) {
    console.error('Order placement failed:', error);
    if (
      error instanceof Error &&
      (error.message.includes('required') ||
        error.message.includes('empty') ||
        error.message.includes('stock') ||
        error.message.includes('Discount code') ||
        error.message.includes('not found'))
    ) {
      throw error;
    }
    throw new Error('Unable to place order. Please try again.', { cause: error });
  }
}

export async function trackOrderByCode(rawCode: string) {
  try {
    await ensureSeeded();
    const clean = rawCode.trim().toUpperCase();
    if (!clean) return null;
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderCode, clean));
    return order ?? null;
  } catch (error) {
    console.error('Database query failed (trackOrderByCode):', error);
    throw new Error('Unable to look up order tracking.', { cause: error });
  }
}

export async function listOrders() {
  try {
    await ensureSeeded();
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  } catch (error) {
    console.error('Database query failed (listOrders):', error);
    throw new Error('Unable to load orders.', { cause: error });
  }
}

export async function updateOrderStatus(orderId: number, status: OrderStatus) {
  try {
    await ensureSeeded();
    const [existing] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId));
    if (!existing) return null;

    const currentLog = JSON.parse(existing.trackingLogJson || '[]');
    const waUpdate = buildWhatsAppTrackingUpdateMsg(
      existing.orderCode,
      existing.customerName,
      existing.customerPhone,
      status,
      existing.city
    );

    const statusNotes: Record<OrderStatus, string> = {
      confirmed: 'Order verified at Gentleman Atelier Kairouan',
      tailoring: 'Garments pressed, steamed & packed in Atelier dust cover',
      dispatched: `Dispatched with courier toward ${existing.city}`,
      delivered: 'Delivered & signed by customer',
    };

    const nextLog = [
      ...currentLog,
      {
        status,
        note: statusNotes[status],
        whatsappSent: true,
        whatsappPreview: waUpdate.text,
        timestamp: new Date().toISOString(),
      },
    ];

    const [updated] = await db
      .update(orders)
      .set({
        status,
        trackingLogJson: JSON.stringify(nextLog),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    return {
      order: updated,
      whatsappUpdate: waUpdate,
    };
  } catch (error) {
    console.error('Database mutation failed (updateOrderStatus):', error);
    throw new Error('Unable to update order status.', { cause: error });
  }
}

export async function listCashFlowAndAnalytics() {
  try {
    await ensureSeeded();
    const entries = await db
      .select()
      .from(cashflowEntries)
      .orderBy(desc(cashflowEntries.entryDate), desc(cashflowEntries.id));
    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
    const allProducts = await db.select().from(products).orderBy(products.id);
    const wallets = await db.select().from(loyaltyWallets);

    const summary = computeCashFlowSummary(
      entries.map((e) => ({
        entryType: e.entryType as 'income' | 'expense',
        category: e.category,
        amountTnd: e.amountTnd,
        entryDate: e.entryDate,
      }))
    );

    return {
      entries,
      summary,
      orders: allOrders,
      products: allProducts,
      loyaltyCount: wallets.length,
    };
  } catch (error) {
    console.error('Database query failed (listCashFlowAndAnalytics):', error);
    throw new Error('Unable to load financial analytics.', { cause: error });
  }
}

export async function addCashFlowEntry(input: {
  entryType: 'income' | 'expense';
  category: string;
  description: string;
  amountTnd: number;
  referenceCode?: string;
  entryDate: string;
}) {
  try {
    await ensureSeeded();
    const [created] = await db
      .insert(cashflowEntries)
      .values({
        entryType: input.entryType,
        category: input.category,
        description: input.description,
        amountTnd: Math.max(1, Math.round(input.amountTnd)),
        referenceCode: input.referenceCode ?? '',
        entryDate: input.entryDate || new Date().toISOString().slice(0, 10),
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Database mutation failed (addCashFlowEntry):', error);
    throw new Error('Unable to record cash flow entry.', { cause: error });
  }
}
