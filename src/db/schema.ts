import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').default('').notNull(),
  phone: text('phone').default('').notNull(),
  role: text('role').default('customer').notNull(),
  loyaltyPoints: integer('loyalty_points').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  priceTnd: integer('price_tnd').notNull(),
  costTnd: integer('cost_tnd').notNull(),
  stock: integer('stock').default(10).notNull(),
  pointsReward: integer('points_reward').default(3).notNull(),
  sizesJson: text('sizes_json').notNull(),
  colorsJson: text('colors_json').notNull(),
  garmentType: text('garment_type').notNull(),
  imageKey: text('image_key').notNull(),
  featured: boolean('featured').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loyaltyWallets = pgTable('loyalty_wallets', {
  id: serial('id').primaryKey(),
  phone: text('phone').notNull().unique(),
  customerName: text('customer_name').default('').notNull(),
  userUid: text('user_uid'),
  pointsBalance: integer('points_balance').default(0).notNull(),
  lifetimePoints: integer('lifetime_points').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const discountCodes = pgTable('discount_codes', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  phone: text('phone').notNull(),
  discountPercent: integer('discount_percent').default(10).notNull(),
  pointsCost: integer('points_cost').default(10).notNull(),
  isUsed: boolean('is_used').default(false).notNull(),
  usedOnOrderCode: text('used_on_order_code'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderCode: text('order_code').notNull().unique(),
  userUid: text('user_uid'),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  deliveryAddress: text('delivery_address').notNull(),
  city: text('city').notNull(),
  itemsJson: text('items_json').notNull(),
  subtotalTnd: integer('subtotal_tnd').notNull(),
  discountCode: text('discount_code'),
  discountTnd: integer('discount_tnd').default(0).notNull(),
  shippingTnd: integer('shipping_tnd').default(0).notNull(),
  totalTnd: integer('total_tnd').notNull(),
  pointsEarned: integer('points_earned').default(0).notNull(),
  status: text('status').default('confirmed').notNull(),
  whatsappMessage: text('whatsapp_message').notNull(),
  trackingLogJson: text('tracking_log_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const cashflowEntries = pgTable('cashflow_entries', {
  id: serial('id').primaryKey(),
  entryType: text('entry_type').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  amountTnd: integer('amount_tnd').notNull(),
  referenceCode: text('reference_code').default('').notNull(),
  entryDate: text('entry_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
