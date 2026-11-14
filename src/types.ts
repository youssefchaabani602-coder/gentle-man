export type GarmentType = 'blazer' | 'overshirt' | 'polo' | 'trousers' | 'bomber';

export interface ProductColorOption {
  name: string;
  hex: string;
}

export interface ProductRecord {
  id: number;
  slug: string;
  name: string;
  category: string;
  description: string;
  priceTnd: number;
  costTnd: number;
  stock: number;
  pointsReward: number;
  sizesJson: string;
  colorsJson: string;
  garmentType: GarmentType | string;
  imageKey: string;
  featured: boolean;
}

export interface OrderTrackingStep {
  status: 'confirmed' | 'tailoring' | 'dispatched' | 'delivered';
  note: string;
  whatsappSent?: boolean;
  whatsappPreview?: string;
  timestamp: string;
}

export interface OrderRecord {
  id: number;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  city: string;
  itemsJson: string;
  subtotalTnd: number;
  discountCode?: string | null;
  discountTnd: number;
  shippingTnd: number;
  totalTnd: number;
  pointsEarned: number;
  status: 'confirmed' | 'tailoring' | 'dispatched' | 'delivered';
  whatsappMessage: string;
  trackingLogJson: string;
  createdAt: string;
}

export interface DiscountCodeRecord {
  id: number;
  code: string;
  phone: string;
  discountPercent: number;
  pointsCost: number;
  isUsed: boolean;
  usedOnOrderCode?: string | null;
}

export interface LoyaltyWalletData {
  phone: string;
  customerName: string;
  pointsBalance: number;
  lifetimePoints: number;
  codes: DiscountCodeRecord[];
}

export interface CashFlowEntryRecord {
  id: number;
  entryType: 'income' | 'expense';
  category: string;
  description: string;
  amountTnd: number;
  referenceCode: string;
  entryDate: string;
}

export interface StoreMapsInfo {
  quotaExceeded: boolean;
  store: {
    name: string;
    address: string;
    rating?: number;
    userRatingCount?: number;
    googleMapsUri: string;
    openingHours: string[];
    location: { lat?: number; lng?: number; latitude?: number; longitude?: number };
  };
  photos: Array<{
    url: string;
    attributions: Array<{ displayName: string; uri: string }>;
  }>;
  groundingSummary: string;
  groundingLinks: Array<{ title: string; uri: string; snippet?: string }>;
}
