export type OrderStatus = 'confirmed' | 'tailoring' | 'dispatched' | 'delivered';

export type PortalRoute = 'client' | 'owner';

export function isOwnerPortalPath(pathname: string): boolean {
  const clean = (pathname || '/').trim().toLowerCase().replace(/\/+$/, '') || '/';
  return clean === '/owner' || clean.startsWith('/owner/');
}

export function resolvePortalRoute(pathname: string): PortalRoute {
  return isOwnerPortalPath(pathname) ? 'owner' : 'client';
}

export interface CartLineItem {
  productId: number;
  name: string;
  priceTnd: number;
  quantity: number;
  pointsReward: number;
  size: string;
  color: string;
}

export interface CartTotalsInput {
  items: CartLineItem[];
  discountPercent?: number;
  city: string;
}

export interface CartTotals {
  subtotalTnd: number;
  discountTnd: number;
  shippingTnd: number;
  totalTnd: number;
  pointsEarned: number;
}

export const LOYALTY_POINTS_PER_VOUCHER = 10;
export const LOYALTY_DISCOUNT_PERCENT = 10;
export const FREE_SHIPPING_THRESHOLD_TND = 350;
export const STANDARD_TUNISIA_SHIPPING_TND = 8;

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  if (digits.length === 8) return '+216' + digits;
  return '+' + digits;
}

export function calculateShippingTnd(subtotalAfterDiscount: number, city: string): number {
  if (subtotalAfterDiscount <= 0) return 0;
  const normalizedCity = city.trim().toLowerCase();
  if (normalizedCity === 'kairouan' || normalizedCity === 'al-qayrawan' || normalizedCity === 'قيروان') {
    return 0;
  }
  if (subtotalAfterDiscount >= FREE_SHIPPING_THRESHOLD_TND) {
    return 0;
  }
  return STANDARD_TUNISIA_SHIPPING_TND;
}

export function calculateCartTotals(input: CartTotalsInput): CartTotals {
  const subtotalTnd = input.items.reduce((sum, item) => {
    const qty = Math.max(0, Math.floor(item.quantity));
    const price = Math.max(0, Math.round(item.priceTnd));
    return sum + price * qty;
  }, 0);

  const pct = Math.min(50, Math.max(0, input.discountPercent ?? 0));
  const discountTnd = Math.round((subtotalTnd * pct) / 100);
  const afterDiscount = Math.max(0, subtotalTnd - discountTnd);
  const shippingTnd = calculateShippingTnd(afterDiscount, input.city || '');
  const totalTnd = afterDiscount + shippingTnd;

  const pointsEarned = input.items.reduce((sum, item) => {
    const qty = Math.max(0, Math.floor(item.quantity));
    const pts = Math.max(1, Math.floor(item.pointsReward || 1));
    return sum + pts * qty;
  }, 0);

  return {
    subtotalTnd,
    discountTnd,
    shippingTnd,
    totalTnd,
    pointsEarned,
  };
}

export function canRedeemLoyaltyPoints(
  pointsBalance: number,
  cost: number = LOYALTY_POINTS_PER_VOUCHER
): boolean {
  return Number.isFinite(pointsBalance) && pointsBalance >= cost;
}

export function redeemLoyaltyPoints(
  pointsBalance: number,
  cost: number = LOYALTY_POINTS_PER_VOUCHER
): { newBalance: number; vouchersUnlocked: number; progressToNext: number } {
  if (!canRedeemLoyaltyPoints(pointsBalance, cost)) {
    throw new Error(`Insufficient loyalty points: need ${cost}, have ${pointsBalance}`);
  }
  const newBalance = pointsBalance - cost;
  return {
    newBalance,
    vouchersUnlocked: Math.floor(newBalance / cost),
    progressToNext: newBalance % cost,
  };
}

export function generateDiscountCode(suffix?: string): string {
  const randomPart =
    suffix ?? Math.floor(1000 + Math.random() * 9000).toString();
  return `GENT10-${randomPart}`;
}

export const STORE_WHATSAPP_NUMBER = '+21622450890';

export interface WhatsAppOrderContext {
  orderCode: string;
  customerName: string;
  customerPhone: string;
  city: string;
  items: Array<{ name: string; quantity: number; size: string; color?: string; priceTnd: number }>;
  subtotalTnd: number;
  discountTnd: number;
  discountCode?: string | null;
  shippingTnd: number;
  totalTnd: number;
  pointsEarned: number;
  newPointsBalance: number;
}

function formatWhatsAppItemLine(item: {
  name: string;
  quantity: number;
  size: string;
  color?: string;
  priceTnd: number;
}): string {
  const variant = item.color ? `Size: ${item.size}, Color: ${item.color}` : `Size: ${item.size}`;
  return `• ${item.quantity}x ${item.name} (${variant}) — ${item.priceTnd * item.quantity} TND`;
}

export function buildWhatsAppConfirmationMsg(ctx: WhatsAppOrderContext): {
  text: string;
  waUrl: string;
} {
  const itemLines = ctx.items.map(formatWhatsAppItemLine).join('\n');

  const discountLine =
    ctx.discountTnd > 0 && ctx.discountCode
      ? `\nDiscount (${ctx.discountCode}): -${ctx.discountTnd} TND`
      : '';

  const voucherReady =
    ctx.newPointsBalance >= LOYALTY_POINTS_PER_VOUCHER
      ? `\nYou now have ${ctx.newPointsBalance} pts — ready to redeem a 10% OFF voucher on your next order!`
      : `\nLoyalty Balance: ${ctx.newPointsBalance}/10 pts toward your next 10% OFF code.`;

  const text = [
    `Marhba ${ctx.customerName} — Gentleman Atelier (Kairouan)`,
    `Order #${ctx.orderCode} is CONFIRMED.`,
    ``,
    `Items:`,
    itemLines,
    ``,
    `Subtotal: ${ctx.subtotalTnd} TND${discountLine}`,
    `Shipping (${ctx.city}): ${ctx.shippingTnd === 0 ? 'Free' : `${ctx.shippingTnd} TND`}`,
    `Total: ${ctx.totalTnd} TND`,
    `Points Earned: +${ctx.pointsEarned} pts${voucherReady}`,
    ``,
    `Track your parcel live on our site using code: ${ctx.orderCode}`,
  ].join('\n');

  const cleanDigits = normalizePhone(ctx.customerPhone).replace(/[^\d]/g, '');
  const waUrl = `https://wa.me/${cleanDigits}?text=${encodeURIComponent(text)}`;

  return { text, waUrl };
}

export interface WhatsAppCartDraftContext {
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  city: string;
  items: Array<{ name: string; quantity: number; size: string; color?: string; priceTnd: number }>;
  subtotalTnd: number;
  discountTnd: number;
  discountCode?: string | null;
  shippingTnd: number;
  totalTnd: number;
  pointsEarned: number;
}

export function buildWhatsAppCartDraftMsg(ctx: WhatsAppCartDraftContext): {
  text: string;
  waUrl: string;
} {
  const itemLines = ctx.items.map(formatWhatsAppItemLine).join('\n');
  const discountLine =
    ctx.discountTnd > 0 && ctx.discountCode
      ? `\nDiscount (${ctx.discountCode}): -${ctx.discountTnd} TND`
      : '';

  const clientDetails: string[] = [];
  if (ctx.customerName?.trim()) clientDetails.push(`Client: ${ctx.customerName.trim()}`);
  if (ctx.customerPhone?.trim() && ctx.customerPhone.trim() !== '+216') {
    clientDetails.push(`Phone: ${normalizePhone(ctx.customerPhone)}`);
  }
  const addressLine = ctx.deliveryAddress?.trim()
    ? `${ctx.deliveryAddress.trim()}, ${ctx.city}`
    : ctx.city;
  clientDetails.push(`Delivery: ${addressLine}`);

  const text = [
    `Marhba Gentleman Atelier (Kairouan) — I would like to confirm my order:`,
    ``,
    `Selected Pieces:`,
    itemLines,
    ``,
    ...clientDetails,
    `Subtotal: ${ctx.subtotalTnd} TND${discountLine}`,
    `Shipping (${ctx.city}): ${ctx.shippingTnd === 0 ? 'Free' : `${ctx.shippingTnd} TND`}`,
    `Total: ${ctx.totalTnd} TND`,
    `Loyalty Points to Earn: +${ctx.pointsEarned} pts`,
  ].join('\n');

  const storeDigits = normalizePhone(STORE_WHATSAPP_NUMBER).replace(/[^\d]/g, '');
  const waUrl = `https://wa.me/${storeDigits}?text=${encodeURIComponent(text)}`;

  return { text, waUrl };
}

export function buildWhatsAppTrackingUpdateMsg(
  orderCode: string,
  customerName: string,
  customerPhone: string,
  status: OrderStatus,
  city: string
): { text: string; waUrl: string } {
  const statusCopy: Record<OrderStatus, string> = {
    confirmed: `Order #${orderCode} is confirmed at Gentleman Atelier Kairouan.`,
    tailoring: `Order #${orderCode} is currently being pressed, inspected, and packed in our Kairouan boutique.`,
    dispatched: `Order #${orderCode} is now OUT FOR DELIVERY to ${city}. Our courier will call shortly.`,
    delivered: `Order #${orderCode} has been DELIVERED. Thank you for wearing Gentleman Kairouan!`,
  };

  const text = `Gentleman Atelier Update — Marhba ${customerName},\n${statusCopy[status]}\nTrack anytime with #${orderCode}.`;
  const cleanDigits = normalizePhone(customerPhone).replace(/[^\d]/g, '');
  const waUrl = `https://wa.me/${cleanDigits}?text=${encodeURIComponent(text)}`;
  return { text, waUrl };
}

export interface CashFlowEntryInput {
  entryType: 'income' | 'expense';
  category: string;
  amountTnd: number;
  entryDate: string;
}

export interface CashFlowSummary {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  profitMarginPct: number;
  byCategory: Array<{ category: string; income: number; expense: number }>;
}

export function computeCashFlowSummary(entries: CashFlowEntryInput[]): CashFlowSummary {
  let totalIncome = 0;
  let totalExpenses = 0;
  const catMap: Record<string, { income: number; expense: number }> = {};

  for (const e of entries) {
    const amt = Math.max(0, Math.round(e.amountTnd));
    if (!catMap[e.category]) {
      catMap[e.category] = { income: 0, expense: 0 };
    }
    if (e.entryType === 'income') {
      totalIncome += amt;
      catMap[e.category].income += amt;
    } else {
      totalExpenses += amt;
      catMap[e.category].expense += amt;
    }
  }

  const netProfit = totalIncome - totalExpenses;
  const profitMarginPct =
    totalIncome > 0 ? Math.round((netProfit / totalIncome) * 1000) / 10 : 0;

  const byCategory = Object.entries(catMap).map(([category, vals]) => ({
    category,
    income: vals.income,
    expense: vals.expense,
  }));

  return {
    totalIncome,
    totalExpenses,
    netProfit,
    profitMarginPct,
    byCategory,
  };
}

export function formatCsvReport(
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>
): string {
  const escapeCell = (val: string | number | boolean | null | undefined): string => {
    const str = val === null || val === undefined ? '' : String(val);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const headerLine = headers.map(escapeCell).join(',');
  const bodyLines = rows.map((row) => row.map(escapeCell).join(','));
  return [headerLine, ...bodyLines].join('\n');
}
