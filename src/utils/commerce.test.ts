import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCartTotals,
  canRedeemLoyaltyPoints,
  redeemLoyaltyPoints,
  generateDiscountCode,
  buildWhatsAppConfirmationMsg,
  buildWhatsAppCartDraftMsg,
  buildWhatsAppTrackingUpdateMsg,
  computeCashFlowSummary,
  formatCsvReport,
  normalizePhone,
  isOwnerPortalPath,
  resolvePortalRoute,
} from './commerce';

test('normalizePhone formats Tunisian 8-digit numbers with +216', () => {
  assert.equal(normalizePhone('22 345 678'), '+21622345678');
  assert.equal(normalizePhone('+216 98 111 222'), '+21698111222');
  assert.equal(normalizePhone('0021655123456'), '+21655123456');
});

test('calculateCartTotals computes subtotal, 10% loyalty discount, Kairouan free shipping, and points', () => {
  const result = calculateCartTotals({
    items: [
      {
        productId: 1,
        name: 'Wool Blazer',
        priceTnd: 300,
        quantity: 1,
        pointsReward: 5,
        size: 'L',
        color: 'Charcoal',
      },
      {
        productId: 2,
        name: 'Merino Polo',
        priceTnd: 100,
        quantity: 2,
        pointsReward: 3,
        size: 'M',
        color: 'Espresso',
      },
    ],
    discountPercent: 10,
    city: 'Tunis',
  });

  assert.equal(result.subtotalTnd, 500);
  assert.equal(result.discountTnd, 50);
  assert.equal(result.shippingTnd, 0); // >= 350 TND free shipping
  assert.equal(result.totalTnd, 450);
  assert.equal(result.pointsEarned, 11);

  const smallTunisOrder = calculateCartTotals({
    items: [
      {
        productId: 2,
        name: 'Merino Polo',
        priceTnd: 120,
        quantity: 1,
        pointsReward: 3,
        size: 'M',
        color: 'Espresso',
      },
    ],
    discountPercent: 0,
    city: 'Sousse',
  });
  assert.equal(smallTunisOrder.shippingTnd, 8);
  assert.equal(smallTunisOrder.totalTnd, 128);

  const localKairouanOrder = calculateCartTotals({
    items: [
      {
        productId: 2,
        name: 'Merino Polo',
        priceTnd: 120,
        quantity: 1,
        pointsReward: 3,
        size: 'M',
        color: 'Espresso',
      },
    ],
    discountPercent: 0,
    city: 'Kairouan',
  });
  assert.equal(localKairouanOrder.shippingTnd, 0);
  assert.equal(localKairouanOrder.totalTnd, 120);
});

test('loyalty points redemption requires 10 points and deducts cleanly', () => {
  assert.equal(canRedeemLoyaltyPoints(9), false);
  assert.equal(canRedeemLoyaltyPoints(10), true);
  assert.equal(canRedeemLoyaltyPoints(14), true);

  const redeemed = redeemLoyaltyPoints(14);
  assert.equal(redeemed.newBalance, 4);
  assert.equal(redeemed.vouchersUnlocked, 0);
  assert.equal(redeemed.progressToNext, 4);

  assert.throws(() => redeemLoyaltyPoints(9), /Insufficient loyalty points/);
  assert.equal(generateDiscountCode('4821'), 'GENT10-4821');
});

test('WhatsApp confirmation and cart draft messages include items, size, color, and order details', () => {
  const conf = buildWhatsAppConfirmationMsg({
    orderCode: 'GTM-1099',
    customerName: 'Youssef',
    customerPhone: '22345678',
    city: 'Kairouan',
    items: [
      {
        name: 'Tailored Blazer',
        quantity: 1,
        size: 'L',
        color: 'Midnight Charcoal',
        priceTnd: 320,
      },
    ],
    subtotalTnd: 320,
    discountTnd: 32,
    discountCode: 'GENT10-4821',
    shippingTnd: 0,
    totalTnd: 288,
    pointsEarned: 5,
    newPointsBalance: 11,
  });

  assert.match(conf.text, /Marhba Youssef/);
  assert.match(conf.text, /GTM-1099/);
  assert.match(conf.text, /1x Tailored Blazer \(Size: L, Color: Midnight Charcoal\) — 320 TND/);
  assert.match(conf.text, /Discount \(GENT10-4821\): -32 TND/);
  assert.match(conf.text, /10% OFF voucher/);
  assert.ok(conf.waUrl.startsWith('https://wa.me/21622345678?text='));

  const draft = buildWhatsAppCartDraftMsg({
    customerName: 'Amine',
    customerPhone: '+21698111222',
    deliveryAddress: '14 Avenue Okba',
    city: 'Kairouan',
    items: [
      {
        name: 'Medina Sand Linen Overshirt',
        quantity: 2,
        size: 'M',
        color: 'Sahara Sand',
        priceTnd: 185,
      },
    ],
    subtotalTnd: 370,
    discountTnd: 37,
    discountCode: 'GENT10-4821',
    shippingTnd: 0,
    totalTnd: 333,
    pointsEarned: 8,
  });

  assert.match(draft.text, /Selected Pieces:/);
  assert.match(draft.text, /2x Medina Sand Linen Overshirt \(Size: M, Color: Sahara Sand\) — 370 TND/);
  assert.match(draft.text, /Client: Amine/);
  assert.match(draft.text, /Discount \(GENT10-4821\): -37 TND/);
  assert.ok(draft.waUrl.startsWith('https://wa.me/21622450890?text='));

  const update = buildWhatsAppTrackingUpdateMsg(
    'GTM-1099',
    'Youssef',
    '+21622345678',
    'dispatched',
    'Sousse'
  );
  assert.match(update.text, /OUT FOR DELIVERY to Sousse/);
});

test('computeCashFlowSummary calculates money in, money out, net profit, and margin', () => {
  const summary = computeCashFlowSummary([
    { entryType: 'income', category: 'Sale', amountTnd: 1000, entryDate: '2026-11-10' },
    { entryType: 'income', category: 'Sale', amountTnd: 500, entryDate: '2026-11-11' },
    { entryType: 'expense', category: 'Inventory Restock', amountTnd: 450, entryDate: '2026-11-11' },
    { entryType: 'expense', category: 'Shipping & Logistics', amountTnd: 50, entryDate: '2026-11-12' },
  ]);

  assert.equal(summary.totalIncome, 1500);
  assert.equal(summary.totalExpenses, 500);
  assert.equal(summary.netProfit, 1000);
  assert.equal(summary.profitMarginPct, 66.7);
  assert.equal(summary.byCategory.length, 3);
});

test('formatCsvReport escapes commas and quotes properly', () => {
  const csv = formatCsvReport(
    ['Order', 'Customer', 'Total'],
    [
      ['GTM-1001', 'Amine, Ben Ali', 250],
      ['GTM-1002', 'Sami "The Tailor"', 410],
    ]
  );
  assert.equal(
    csv,
    'Order,Customer,Total\nGTM-1001,"Amine, Ben Ali",250\nGTM-1002,"Sami ""The Tailor""",410'
  );
});

test('portal route helpers separate client storefront (/) from standalone owner page (/owner)', () => {
  assert.equal(isOwnerPortalPath('/'), false);
  assert.equal(isOwnerPortalPath('/collection'), false);
  assert.equal(isOwnerPortalPath('/owner'), true);
  assert.equal(isOwnerPortalPath('/owner/'), true);
  assert.equal(isOwnerPortalPath('/owner/inventory'), true);

  assert.equal(resolvePortalRoute('/'), 'client');
  assert.equal(resolvePortalRoute('/owner'), 'owner');
  assert.equal(resolvePortalRoute('/OWNER/'), 'owner');
});
