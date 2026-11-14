import { count } from 'drizzle-orm';
import { db } from './index.ts';
import {
  cashflowEntries,
  discountCodes,
  loyaltyWallets,
  orders,
  products,
} from './schema.ts';
import {
  buildWhatsAppConfirmationMsg,
  buildWhatsAppTrackingUpdateMsg,
} from '../utils/commerce.ts';

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = runSeed().catch((err) => {
    seedPromise = null;
    throw err;
  });
  return seedPromise;
}

async function runSeed(): Promise<void> {
  const [{ value: productCount }] = await db
    .select({ value: count() })
    .from(products);

  if (Number(productCount) > 0) {
    return;
  }

  const initialProducts = [
    {
      slug: 'kairouan-structured-wool-blazer',
      name: 'Aghlabid Tailored Wool Blazer',
      category: 'Blazers',
      description:
        'Half-canvas midnight charcoal Italian virgin wool blazer with hand-finished peak lapels, horn buttons, and breathable cupro lining tailored for Kairouan evenings.',
      priceTnd: 420,
      costTnd: 235,
      stock: 14,
      pointsReward: 6,
      sizesJson: JSON.stringify(['46', '48', '50', '52', '54']),
      colorsJson: JSON.stringify([
        { name: 'Midnight Charcoal', hex: '#23262E' },
        { name: 'Mediterranean Navy', hex: '#1B283C' },
        { name: 'Sandstone', hex: '#B8A890' },
      ]),
      garmentType: 'blazer',
      imageKey: 'garment_tailored_blazer',
      featured: true,
    },
    {
      slug: 'medina-sand-linen-overshirt',
      name: 'Medina Sand Linen Overshirt',
      category: 'Shirts',
      description:
        'Washed Normandy flax-linen overshirt with twin utility pockets and natural mother-of-pearl buttons. Engineered for effortless layering in warm Mediterranean sun.',
      priceTnd: 185,
      costTnd: 92,
      stock: 22,
      pointsReward: 4,
      sizesJson: JSON.stringify(['S', 'M', 'L', 'XL']),
      colorsJson: JSON.stringify([
        { name: 'Warm Sand', hex: '#CBB99B' },
        { name: 'Chalk White', hex: '#EAE6DD' },
        { name: 'Olive Stone', hex: '#5A6252' },
      ]),
      garmentType: 'overshirt',
      imageKey: 'garment_linen_overshirt',
      featured: true,
    },
    {
      slug: 'espresso-merino-knit-polo',
      name: 'Espresso Fine-Gauge Merino Polo',
      category: 'Knitwear',
      description:
        'Ultra-fine 18-gauge extrafine merino wool knit polo in deep roasted espresso with ribbed cuffs and seamless shoulder drape.',
      priceTnd: 165,
      costTnd: 78,
      stock: 18,
      pointsReward: 3,
      sizesJson: JSON.stringify(['S', 'M', 'L', 'XL']),
      colorsJson: JSON.stringify([
        { name: 'Roasted Espresso', hex: '#3D2B24' },
        { name: 'Oatmeal', hex: '#D4CAB8' },
        { name: 'Obsidian', hex: '#181A1F' },
      ]),
      garmentType: 'polo',
      imageKey: 'garment_merino_polo',
      featured: true,
    },
    {
      slug: 'double-pleat-flannel-trousers',
      name: 'Atelier Double-Pleat Trousers',
      category: 'Trousers',
      description:
        'High-waisted tailored trousers featuring deep double front pleats, brushed steel side-tab adjusters, and an elongating tapered leg.',
      priceTnd: 210,
      costTnd: 105,
      stock: 16,
      pointsReward: 4,
      sizesJson: JSON.stringify(['38', '40', '42', '44', '46']),
      colorsJson: JSON.stringify([
        { name: 'Slate Charcoal', hex: '#2F343D' },
        { name: 'Limestone Taupe', hex: '#9D9384' },
        { name: 'Ink Navy', hex: '#182233' },
      ]),
      garmentType: 'trousers',
      imageKey: 'garment_pleated_trousers',
      featured: true,
    },
    {
      slug: 'obsidian-suede-calfskin-bomber',
      name: 'Obsidian Suede & Calfskin Blouson',
      category: 'Outerwear',
      description:
        'Supple lamb-suede body paired with full-grain calfskin sleeves, two-way brushed silver Excella zipper, and ribbed virgin-wool trim.',
      priceTnd: 540,
      costTnd: 310,
      stock: 6,
      pointsReward: 8,
      sizesJson: JSON.stringify(['S', 'M', 'L', 'XL']),
      colorsJson: JSON.stringify([
        { name: 'Obsidian Black', hex: '#17191E' },
        { name: 'Cognac Tobacco', hex: '#7A4B2A' },
        { name: 'Storm Slate', hex: '#3A414D' },
      ]),
      garmentType: 'bomber',
      imageKey: 'garment_leather_bomber',
      featured: true,
    },
    {
      slug: 'kairouan-ivory-dress-shirt',
      name: 'Okba Poplin Dress Shirt',
      category: 'Shirts',
      description:
        'Two-ply Egyptian cotton poplin shirt with semi-spread collar, French placket, and tailored darted back.',
      priceTnd: 145,
      costTnd: 68,
      stock: 28,
      pointsReward: 3,
      sizesJson: JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
      colorsJson: JSON.stringify([
        { name: 'Atelier Ivory', hex: '#F2EFE9' },
        { name: 'Sky Oxford', hex: '#B9CCE0' },
        { name: 'Charcoal', hex: '#2A2D34' },
      ]),
      garmentType: 'overshirt',
      imageKey: 'garment_linen_overshirt',
      featured: false,
    },
  ];

  await db.insert(products).values(initialProducts);

  await db.insert(loyaltyWallets).values([
    {
      phone: '+21622450890',
      customerName: 'Mehdi Ben Salah',
      pointsBalance: 12,
      lifetimePoints: 22,
    },
    {
      phone: '+21698310442',
      customerName: 'Amine Trabelsi',
      pointsBalance: 6,
      lifetimePoints: 6,
    },
  ]);

  await db.insert(discountCodes).values([
    {
      code: 'GENT10-8824',
      phone: '+21622450890',
      discountPercent: 10,
      pointsCost: 10,
      isUsed: false,
    },
  ]);

  const sampleOrder1Items = [
    {
      productId: 1,
      name: 'Aghlabid Tailored Wool Blazer',
      priceTnd: 420,
      quantity: 1,
      size: '50',
      color: 'Midnight Charcoal',
    },
    {
      productId: 4,
      name: 'Atelier Double-Pleat Trousers',
      priceTnd: 210,
      quantity: 1,
      size: '42',
      color: 'Slate Charcoal',
    },
  ];

  const msg1 = buildWhatsAppConfirmationMsg({
    orderCode: 'GTM-1042',
    customerName: 'Mehdi Ben Salah',
    customerPhone: '+21622450890',
    city: 'Tunis',
    items: sampleOrder1Items,
    subtotalTnd: 630,
    discountTnd: 0,
    shippingTnd: 0,
    totalTnd: 630,
    pointsEarned: 10,
    newPointsBalance: 12,
  });

  const msg1Update = buildWhatsAppTrackingUpdateMsg(
    'GTM-1042',
    'Mehdi Ben Salah',
    '+21622450890',
    'dispatched',
    'Tunis'
  );

  const sampleOrder2Items = [
    {
      productId: 2,
      name: 'Medina Sand Linen Overshirt',
      priceTnd: 185,
      quantity: 1,
      size: 'L',
      color: 'Warm Sand',
    },
    {
      productId: 3,
      name: 'Espresso Fine-Gauge Merino Polo',
      priceTnd: 165,
      quantity: 1,
      size: 'M',
      color: 'Roasted Espresso',
    },
  ];

  const msg2 = buildWhatsAppConfirmationMsg({
    orderCode: 'GTM-1043',
    customerName: 'Amine Trabelsi',
    customerPhone: '+21698310442',
    city: 'Kairouan',
    items: sampleOrder2Items,
    subtotalTnd: 350,
    discountTnd: 0,
    shippingTnd: 0,
    totalTnd: 350,
    pointsEarned: 7,
    newPointsBalance: 7,
  });

  const sampleOrder3Items = [
    {
      productId: 5,
      name: 'Obsidian Suede & Calfskin Blouson',
      priceTnd: 540,
      quantity: 1,
      size: 'L',
      color: 'Obsidian Black',
    },
  ];

  const msg3 = buildWhatsAppConfirmationMsg({
    orderCode: 'GTM-1044',
    customerName: 'Karim Jebali',
    customerPhone: '+21655712309',
    city: 'Sousse',
    items: sampleOrder3Items,
    subtotalTnd: 540,
    discountTnd: 54,
    discountCode: 'GENT10-4102',
    shippingTnd: 0,
    totalTnd: 486,
    pointsEarned: 8,
    newPointsBalance: 8,
  });

  await db.insert(orders).values([
    {
      orderCode: 'GTM-1042',
      customerName: 'Mehdi Ben Salah',
      customerPhone: '+21622450890',
      deliveryAddress: '18 Rue du Lac Huron, Les Berges du Lac',
      city: 'Tunis',
      itemsJson: JSON.stringify(sampleOrder1Items),
      subtotalTnd: 630,
      discountTnd: 0,
      shippingTnd: 0,
      totalTnd: 630,
      pointsEarned: 10,
      status: 'dispatched',
      whatsappMessage: msg1.text,
      trackingLogJson: JSON.stringify([
        {
          status: 'confirmed',
          note: 'Order verified at Gentleman Kairouan Atelier',
          whatsappSent: true,
          whatsappPreview: msg1.text,
          timestamp: '2026-11-12T10:15:00Z',
        },
        {
          status: 'tailoring',
          note: 'Pressed & packed with garment dust cover',
          whatsappSent: true,
          timestamp: '2026-11-13T09:30:00Z',
        },
        {
          status: 'dispatched',
          note: 'Handed to Aramex / RapidPost courier toward Tunis',
          whatsappSent: true,
          whatsappPreview: msg1Update.text,
          timestamp: '2026-11-14T08:45:00Z',
        },
      ]),
    },
    {
      orderCode: 'GTM-1043',
      customerName: 'Amine Trabelsi',
      customerPhone: '+21698310442',
      deliveryAddress: 'Avenue de la Republique, Centre Ville',
      city: 'Kairouan',
      itemsJson: JSON.stringify(sampleOrder2Items),
      subtotalTnd: 350,
      discountTnd: 0,
      shippingTnd: 0,
      totalTnd: 350,
      pointsEarned: 7,
      status: 'tailoring',
      whatsappMessage: msg2.text,
      trackingLogJson: JSON.stringify([
        {
          status: 'confirmed',
          note: 'Order received — Free local Kairouan courier scheduled',
          whatsappSent: true,
          whatsappPreview: msg2.text,
          timestamp: '2026-11-13T16:20:00Z',
        },
        {
          status: 'tailoring',
          note: 'Final steaming & quality inspection in atelier',
          whatsappSent: true,
          timestamp: '2026-11-14T11:00:00Z',
        },
      ]),
    },
    {
      orderCode: 'GTM-1044',
      customerName: 'Karim Jebali',
      customerPhone: '+21655712309',
      deliveryAddress: 'Boulevard 14 Janvier, Hammam Sousse',
      city: 'Sousse',
      itemsJson: JSON.stringify(sampleOrder3Items),
      subtotalTnd: 540,
      discountCode: 'GENT10-4102',
      discountTnd: 54,
      shippingTnd: 0,
      totalTnd: 486,
      pointsEarned: 8,
      status: 'delivered',
      whatsappMessage: msg3.text,
      trackingLogJson: JSON.stringify([
        {
          status: 'confirmed',
          note: 'Order confirmed with 10% loyalty code GENT10-4102',
          whatsappSent: true,
          whatsappPreview: msg3.text,
          timestamp: '2026-11-09T12:10:00Z',
        },
        {
          status: 'dispatched',
          note: 'Dispatched via express courier to Sousse',
          whatsappSent: true,
          timestamp: '2026-11-10T08:00:00Z',
        },
        {
          status: 'delivered',
          note: 'Signed & delivered to customer',
          whatsappSent: true,
          timestamp: '2026-11-11T15:40:00Z',
        },
      ]),
    },
  ]);

  await db.insert(cashflowEntries).values([
    {
      entryType: 'income',
      category: 'Sale',
      description: 'Online Order #GTM-1044 (Obsidian Suede Blouson)',
      amountTnd: 486,
      referenceCode: 'GTM-1044',
      entryDate: '2026-11-09',
    },
    {
      entryType: 'expense',
      category: 'Inventory Restock',
      description: 'Italian Virgin Wool & Linen Bolt Fabric Delivery',
      amountTnd: 620,
      referenceCode: 'SUP-881',
      entryDate: '2026-11-10',
    },
    {
      entryType: 'income',
      category: 'Sale',
      description: 'In-Boutique Tailored Suit Fitting — Kairouan',
      amountTnd: 790,
      referenceCode: 'POS-204',
      entryDate: '2026-11-11',
    },
    {
      entryType: 'expense',
      category: 'Tailoring Supplies',
      description: 'Horn Buttons, Cupro Lining & Garment Bags',
      amountTnd: 145,
      referenceCode: 'SUP-884',
      entryDate: '2026-11-11',
    },
    {
      entryType: 'income',
      category: 'Sale',
      description: 'Online Order #GTM-1042 (Blazer + Double-Pleat Trousers)',
      amountTnd: 630,
      referenceCode: 'GTM-1042',
      entryDate: '2026-11-12',
    },
    {
      entryType: 'expense',
      category: 'Shipping & Logistics',
      description: 'Weekly Inter-Governorate Courier Settlement',
      amountTnd: 64,
      referenceCode: 'LOG-049',
      entryDate: '2026-11-12',
    },
    {
      entryType: 'income',
      category: 'Sale',
      description: 'Online Order #GTM-1043 (Overshirt + Merino Polo)',
      amountTnd: 350,
      referenceCode: 'GTM-1043',
      entryDate: '2026-11-13',
    },
    {
      entryType: 'expense',
      category: 'Marketing',
      description: 'Seasonal Lookbook & Social Campaign',
      amountTnd: 180,
      referenceCode: 'MKT-019',
      entryDate: '2026-11-13',
    },
    {
      entryType: 'expense',
      category: 'Atelier Rent',
      description: 'Kairouan Boutique Monthly Lease Share',
      amountTnd: 450,
      referenceCode: 'RNT-11',
      entryDate: '2026-11-14',
    },
  ]);
}
