import React, { useMemo, useState } from 'react';
import {
  Award,
  Check,
  Copy,
  ExternalLink,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import type { LoyaltyWalletData, OrderRecord } from '../types';
import {
  buildWhatsAppCartDraftMsg,
  calculateCartTotals,
  CartLineItem,
  LOYALTY_POINTS_PER_VOUCHER,
} from '../utils/commerce';
import { useAuth } from '../context/AuthContext';

export interface CartUiItem extends CartLineItem {
  imageUrl: string;
}

interface CartCheckoutDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartUiItem[];
  onUpdateQty: (index: number, delta: number) => void;
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  onOrderSuccess: (orderCode: string) => void;
  onJumpToTrack: (orderCode: string) => void;
}

const TUNISIAN_CITIES = [
  'Kairouan',
  'Tunis',
  'Sousse',
  'Sfax',
  'Monastir',
  'Nabeul',
  'Bizerte',
  'Mahdia',
  'Ariana',
  'Gabes',
];

export function CartCheckoutDrawer({
  open,
  onClose,
  items,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onOrderSuccess,
  onJumpToTrack,
}: CartCheckoutDrawerProps) {
  const { user, getToken } = useAuth();

  const [customerName, setCustomerName] = useState(user?.displayName || '');
  const [customerPhone, setCustomerPhone] = useState('+216');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [city, setCity] = useState('Kairouan');

  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; percent: number } | null>(null);
  const [discountStatus, setDiscountStatus] = useState<string | null>(null);

  const [wallet, setWallet] = useState<LoyaltyWalletData | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [receipt, setReceipt] = useState<{
    order: OrderRecord;
    whatsappText: string;
    whatsappUrl: string;
    pointsBalance: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [draftCopied, setDraftCopied] = useState(false);

  const totals = useMemo(
    () =>
      calculateCartTotals({
        items,
        discountPercent: appliedDiscount?.percent ?? 0,
        city,
      }),
    [items, appliedDiscount, city]
  );

  const liveWhatsAppDraft = useMemo(
    () =>
      buildWhatsAppCartDraftMsg({
        customerName,
        customerPhone,
        deliveryAddress,
        city,
        items: items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          size: i.size,
          color: i.color,
          priceTnd: i.priceTnd,
        })),
        subtotalTnd: totals.subtotalTnd,
        discountTnd: totals.discountTnd,
        discountCode: appliedDiscount?.code,
        shippingTnd: totals.shippingTnd,
        totalTnd: totals.totalTnd,
        pointsEarned: totals.pointsEarned,
      }),
    [
      customerName,
      customerPhone,
      deliveryAddress,
      city,
      items,
      totals,
      appliedDiscount,
    ]
  );

  if (!open) return null;

  async function handleCheckWallet(phoneOverride?: string) {
    const target = (phoneOverride ?? customerPhone).trim();
    if (target.length < 8) return;
    setWalletLoading(true);
    try {
      const res = await fetch(`/api/loyalty/${encodeURIComponent(target)}`);
      if (res.ok) {
        const data = (await res.json()) as { wallet: LoyaltyWalletData };
        setWallet(data.wallet);
        if (!customerName && data.wallet.customerName && data.wallet.customerName !== 'Valued Client') {
          setCustomerName(data.wallet.customerName);
        }
      }
    } finally {
      setWalletLoading(false);
    }
  }

  async function handleRedeem10Points() {
    if (!wallet) return;
    setWalletLoading(true);
    setDiscountStatus(null);
    try {
      const res = await fetch('/api/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: wallet.phone }),
      });
      const data = (await res.json()) as { code?: { code: string; discountPercent: number }; error?: string };
      if (!res.ok || !data.code) {
        setDiscountStatus(data.error || 'Could not redeem points.');
        return;
      }
      setAppliedDiscount({ code: data.code.code, percent: data.code.discountPercent });
      setDiscountInput(data.code.code);
      setDiscountStatus(`Redeemed 10 pts -> ${data.code.code} (-10%) applied.`);
      await handleCheckWallet(wallet.phone);
    } finally {
      setWalletLoading(false);
    }
  }

  async function handleValidateDiscount(codeToTry?: string) {
    const code = (codeToTry ?? discountInput).trim().toUpperCase();
    if (!code) return;
    setDiscountStatus(null);
    const res = await fetch('/api/discount/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = (await res.json()) as {
      discount?: { code: string; discountPercent: number };
      error?: string;
    };
    if (!res.ok || !data.discount) {
      setAppliedDiscount(null);
      setDiscountStatus(data.error || 'Invalid or already used discount code.');
      return;
    }
    setAppliedDiscount({ code: data.discount.code, percent: data.discount.discountPercent });
    setDiscountInput(data.discount.code);
    setDiscountStatus(`${data.discount.code} applied (-${data.discount.discountPercent}% off subtotal).`);
  }

  async function handleCheckoutSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCheckoutError(null);
    if (items.length === 0) {
      setCheckoutError('Your shopping bag is empty.');
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customerName,
          customerPhone,
          deliveryAddress,
          city,
          discountCode: appliedDiscount?.code,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            size: i.size,
            color: i.color,
          })),
        }),
      });
      const data = (await res.json()) as {
        order?: OrderRecord;
        whatsappText?: string;
        whatsappUrl?: string;
        newPointsBalance?: number;
        pointsBalance?: number;
        error?: string;
      };

      if (!res.ok || !data.order) {
        setCheckoutError(data.error || 'Unable to place order.');
        return;
      }

      setReceipt({
        order: data.order,
        whatsappText: data.whatsappText || data.order.whatsappMessage,
        whatsappUrl: data.whatsappUrl || '',
        pointsBalance: data.newPointsBalance ?? data.pointsBalance ?? 0,
      });
      onClearCart();
      setAppliedDiscount(null);
      setDiscountInput('');
      onOrderSuccess(data.order.orderCode);
    } catch {
      setCheckoutError('Network error submitting your order.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#0E1014]/65"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping Bag and Checkout"
    >
      <div className="w-full max-w-lg bg-[#F9F7F2] h-full flex flex-col border-l border-[#D8D1C4] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#E6E1D6]">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-4 h-4 text-[#8B6B2E]" />
            <h3 className="font-editorial text-xl text-[#111111]">
              {receipt ? 'Order Confirmed' : `Atelier Bag (${items.reduce((s, i) => s + i.quantity, 0)})`}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setReceipt(null);
              onClose();
            }}
            className="p-1.5 border border-[#E6E1D6] hover:border-[#111111]"
            aria-label="Close shopping bag"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {receipt ? (
            <div className="space-y-5">
              <div className="bg-white border border-[#E6E1D6] p-5 space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-[#1F7A52] font-semibold">
                  Order Registered · WhatsApp Confirmation Ready
                </p>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-bold text-[#111111]">
                    #{receipt.order.orderCode}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {receipt.order.totalTnd} TND
                  </span>
                </div>
                <p className="text-xs text-[#5C5953]">
                  +{receipt.order.pointsEarned} loyalty points credited · New balance:{' '}
                  <strong className="text-[#111111] tabular-nums">{receipt.pointsBalance} pts</strong>
                </p>
              </div>

              <div className="bg-white border border-[#E6E1D6] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#111111]">
                    <MessageCircle className="w-4 h-4 text-[#1F7A52]" />
                    <span>Personalized WhatsApp Message</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(receipt.whatsappText);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-[#8B6B2E] hover:underline"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed bg-[#F9F7F2] border border-[#E6E1D6] p-3.5 text-[#111111]">
                  {receipt.whatsappText}
                </pre>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {receipt.whatsappUrl && (
                    <a
                      href={receipt.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 py-2.5 px-3 bg-[#1F7A52] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#196443]"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in WhatsApp</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const code = receipt.order.orderCode;
                      setReceipt(null);
                      onClose();
                      onJumpToTrack(code);
                    }}
                    className="inline-flex items-center justify-center gap-2 py-2.5 px-3 bg-[#111111] text-[#F9F7F2] text-xs font-semibold uppercase tracking-wider hover:bg-[#2A2825]"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Track Order Live</span>
                  </button>
                </div>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <ShoppingBag className="w-8 h-8 text-[#8B6B2E] mx-auto opacity-60" />
              <p className="font-editorial text-xl text-[#111111]">Your atelier bag is empty</p>
              <p className="text-xs text-[#5C5953] max-w-xs mx-auto">
                Explore our 3D-sculpted blazers, linen overshirts, and merino knitwear to earn loyalty points toward 10% off.
              </p>
            </div>
          ) : (
            <>
              {/* Bag Items */}
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={`${item.productId}-${item.size}-${item.color}`}
                    className="flex gap-3.5 bg-white border border-[#E6E1D6] p-3"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-16 h-20 object-cover border border-[#E6E1D6] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-[#111111] truncate">{item.name}</p>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(idx)}
                          className="text-[#5C5953] hover:text-[#9E2A2B]"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-[#5C5953] mt-0.5">
                        Size {item.size} · {item.color} · +{item.pointsReward * item.quantity} pts
                      </p>
                      <div className="flex items-center justify-between mt-2.5">
                        <div className="inline-flex items-center border border-[#E6E1D6]">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(idx, -1)}
                            className="px-2 py-1 hover:bg-[#F9F7F2]"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2.5 text-xs font-medium tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(idx, 1)}
                            className="px-2 py-1 hover:bg-[#F9F7F2]"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-sm font-semibold text-[#111111] tabular-nums">
                          {item.priceTnd * item.quantity} TND
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Loyalty & Promo Code Section */}
              <div className="bg-white border border-[#E6E1D6] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#111111]">
                    <Tag className="w-3.5 h-3.5 text-[#8B6B2E]" />
                    <span>10% Loyalty Discount Code</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCheckWallet()}
                    className="text-[11px] font-medium text-[#8B6B2E] hover:underline"
                  >
                    {walletLoading ? 'Checking...' : 'Check Phone Points'}
                  </button>
                </div>

                {wallet && (
                  <div className="p-2.5 bg-[#F9F7F2] border border-[#E6E1D6] flex items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-medium text-[#111111]">
                        Wallet: <span className="tabular-nums">{wallet.pointsBalance}</span> pts
                      </p>
                      <p className="text-[11px] text-[#5C5953]">
                        {wallet.codes.filter((c) => !c.isUsed).length} active code(s)
                      </p>
                    </div>
                    {wallet.pointsBalance >= LOYALTY_POINTS_PER_VOUCHER ? (
                      <button
                        type="button"
                        onClick={handleRedeem10Points}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#C5A059] text-[#111111] font-semibold text-[11px] uppercase tracking-wider"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Redeem 10 pts (-10%)</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#5C5953] tabular-nums">
                        {10 - wallet.pointsBalance} pts to 10% off
                      </span>
                    )}
                  </div>
                )}

                {wallet && wallet.codes.some((c) => !c.isUsed) && (
                  <div className="flex flex-wrap gap-1.5">
                    {wallet.codes
                      .filter((c) => !c.isUsed)
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleValidateDiscount(c.code)}
                          className="px-2 py-1 text-[11px] font-mono bg-[#F9F7F2] border border-[#C5A059] text-[#111111] hover:bg-[#C5A059]/20"
                        >
                          Use {c.code} (-10%)
                        </button>
                      ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
                    placeholder="Enter code (e.g. GENT10-8824)"
                    className="flex-1 px-3 py-2 text-xs font-mono bg-[#F9F7F2] border border-[#E6E1D6] focus:outline-none focus:border-[#111111]"
                  />
                  <button
                    type="button"
                    onClick={() => handleValidateDiscount()}
                    className="px-4 py-2 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
                  >
                    Apply
                  </button>
                </div>
                {discountStatus && (
                  <p className="text-[11px] text-[#8B6B2E] font-medium">{discountStatus}</p>
                )}
              </div>

              {/* Delivery & WhatsApp Form */}
              <form id="checkout-form" onSubmit={handleCheckoutSubmit} className="bg-white border border-[#E6E1D6] p-4 space-y-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#111111]">
                  Delivery &amp; WhatsApp Confirmation Details
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#5C5953] mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Youssef Ben Ali"
                      className="w-full px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E6E1D6] focus:outline-none focus:border-[#111111]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#5C5953] mb-1">
                      WhatsApp Phone
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      onBlur={() => handleCheckWallet()}
                      placeholder="+21622450890"
                      className="w-full px-3 py-2 text-xs font-mono bg-[#F9F7F2] border border-[#E6E1D6] focus:outline-none focus:border-[#111111]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#5C5953] mb-1">
                      City / Governorate
                    </label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E6E1D6] focus:outline-none focus:border-[#111111]"
                    >
                      {TUNISIAN_CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#5C5953] mb-1">
                      Street Address
                    </label>
                    <input
                      type="text"
                      required
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Avenue Habib Bourguiba"
                      className="w-full px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E6E1D6] focus:outline-none focus:border-[#111111]"
                    />
                  </div>
                </div>

                {/* Totals */}
                <div className="border-t border-[#E6E1D6] pt-3 space-y-1.5 text-xs tabular-nums">
                  <div className="flex justify-between text-[#5C5953]">
                    <span>Subtotal</span>
                    <span>{totals.subtotalTnd} TND</span>
                  </div>
                  {totals.discountTnd > 0 && (
                    <div className="flex justify-between text-[#1F7A52] font-medium">
                      <span>Loyalty Discount ({appliedDiscount?.code})</span>
                      <span>-{totals.discountTnd} TND</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#5C5953]">
                    <span>Shipping ({city})</span>
                    <span>{totals.shippingTnd === 0 ? 'Free' : `${totals.shippingTnd} TND`}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-[#111111] pt-1.5 border-t border-[#E6E1D6]">
                    <span>Total Due (Cash on Delivery / Card)</span>
                    <span>{totals.totalTnd} TND</span>
                  </div>
                  <p className="text-[11px] text-[#8B6B2E]">
                    This order earns +{totals.pointsEarned} loyalty points toward 10% OFF codes.
                  </p>
                </div>

                {checkoutError && (
                  <p className="text-xs text-[#9E2A2B] font-medium">{checkoutError}</p>
                )}
              </form>

              {/* Live Pre-Filled WhatsApp Checkout Preview */}
              <div className="bg-white border border-[#E6E1D6] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#111111]">
                    <MessageCircle className="w-3.5 h-3.5 text-[#1F7A52]" />
                    <span>Pre-Filled WhatsApp Message</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(liveWhatsAppDraft.text);
                      setDraftCopied(true);
                      setTimeout(() => setDraftCopied(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#8B6B2E] hover:underline"
                  >
                    {draftCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{draftCopied ? 'Copied' : 'Copy Draft'}</span>
                  </button>
                </div>
                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed bg-[#F9F7F2] border border-[#E6E1D6] p-3 text-[#111111]">
                  {liveWhatsAppDraft.text}
                </pre>
                <a
                  href={liveWhatsAppDraft.waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 border border-[#1F7A52] text-[#1F7A52] text-xs font-semibold uppercase tracking-wider hover:bg-[#1F7A52] hover:text-white transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Send Pre-Filled Bag via WhatsApp</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </>
          )}
        </div>

        {!receipt && items.length > 0 && (
          <div className="p-4 bg-white border-t border-[#E6E1D6] space-y-2">
            <button
              type="submit"
              form="checkout-form"
              disabled={submitting}
              className="w-full py-3.5 bg-[#111111] text-[#F9F7F2] text-xs font-semibold uppercase tracking-[0.16em] hover:bg-[#2A2825] disabled:opacity-50"
            >
              {submitting ? 'Confirming & Generating WhatsApp...' : `Complete Order · ${totals.totalTnd} TND`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
