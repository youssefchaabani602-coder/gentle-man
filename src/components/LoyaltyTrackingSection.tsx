import React, { useEffect, useState } from 'react';
import {
  Award,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  Package,
  Search,
  Sparkles,
  Truck,
} from 'lucide-react';
import type { LoyaltyWalletData, OrderRecord, OrderTrackingStep } from '../types';
import { LOYALTY_POINTS_PER_VOUCHER } from '../utils/commerce';
import { StoreLocationMap } from './StoreLocationMap';

const PIPELINE_STEPS: Array<{ key: OrderRecord['status']; label: string }> = [
  { key: 'confirmed', label: 'Order Confirmed' },
  { key: 'tailoring', label: 'Tailoring & Press' },
  { key: 'dispatched', label: 'Courier Dispatched' },
  { key: 'delivered', label: 'Delivered' },
];

export function LoyaltyTrackingSection({
  initialOrderCode,
  onQuotaDetected,
}: {
  initialOrderCode?: string;
  onQuotaDetected?: () => void;
}) {
  const [phoneInput, setPhoneInput] = useState('+21622450890');
  const [wallet, setWallet] = useState<LoyaltyWalletData | null>(null);
  const [walletMsg, setWalletMsg] = useState<string | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);

  const [orderCodeInput, setOrderCodeInput] = useState(initialOrderCode || 'GTM-1042');
  const [trackedOrder, setTrackedOrder] = useState<OrderRecord | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [trackBusy, setTrackBusy] = useState(false);

  async function lookupWallet(phone: string) {
    setWalletBusy(true);
    setWalletMsg(null);
    try {
      const res = await fetch(`/api/loyalty/${encodeURIComponent(phone.trim())}`);
      if (res.ok) {
        const data = (await res.json()) as { wallet: LoyaltyWalletData };
        setWallet(data.wallet);
      }
    } finally {
      setWalletBusy(false);
    }
  }

  async function redeemVoucher() {
    if (!wallet) return;
    setWalletBusy(true);
    setWalletMsg(null);
    try {
      const res = await fetch('/api/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: wallet.phone }),
      });
      const data = (await res.json()) as { code?: { code: string }; error?: string };
      if (!res.ok || !data.code) {
        setWalletMsg(data.error || 'Could not redeem points.');
        return;
      }
      setWalletMsg(`Unlocked new 10% OFF code: ${data.code.code}`);
      await lookupWallet(wallet.phone);
    } finally {
      setWalletBusy(false);
    }
  }

  async function lookupOrder(code: string) {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setTrackBusy(true);
    setTrackError(null);
    try {
      const res = await fetch(`/api/orders/track/${encodeURIComponent(clean)}`);
      const data = (await res.json()) as { order?: OrderRecord; error?: string };
      if (!res.ok || !data.order) {
        setTrackedOrder(null);
        setTrackError(data.error || 'Order code not found.');
        return;
      }
      setTrackedOrder(data.order);
    } catch {
      setTrackError('Network error looking up order.');
    } finally {
      setTrackBusy(false);
    }
  }

  useEffect(() => {
    lookupWallet('+21622450890');
    lookupOrder(initialOrderCode || 'GTM-1042');
  }, [initialOrderCode]);

  const progressPts = wallet ? Math.min(LOYALTY_POINTS_PER_VOUCHER, wallet.pointsBalance) : 0;
  const progressPct = Math.round((progressPts / LOYALTY_POINTS_PER_VOUCHER) * 100);

  let trackingLog: OrderTrackingStep[] = [];
  if (trackedOrder) {
    try {
      trackingLog = JSON.parse(trackedOrder.trackingLogJson) as OrderTrackingStep[];
    } catch {
      trackingLog = [];
    }
  }

  const activeStepIdx = trackedOrder
    ? PIPELINE_STEPS.findIndex((s) => s.key === trackedOrder.status)
    : -1;

  return (
    <section id="track-rewards" className="py-16 md:py-24 px-4 sm:px-6 lg:px-10 max-w-7xl mx-auto space-y-14">
      <div className="border-b border-[#E6E1D6] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#8B6B2E] font-medium">
            Client Concierge · Loyalty &amp; Parcel Dispatch
          </p>
          <h2 className="font-editorial text-3xl md:text-4xl text-[#111111] mt-2">
            10-Point Rewards &amp; Live Order Tracking
          </h2>
        </div>
        <p className="text-sm text-[#5C5953] max-w-md">
          Every purchase earns points. Collect 10 points to convert into a personal 10% OFF code, and follow WhatsApp courier milestones in real time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Loyalty Rewards Hub */}
        <div className="lg:col-span-5 bg-white border border-[#E6E1D6] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#8B6B2E]" />
              <h3 className="font-editorial text-2xl text-[#111111]">Loyalty Wallet</h3>
            </div>
            <span className="text-xs text-[#5C5953]">10 pts = 10% OFF</span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              lookupWallet(phoneInput);
            }}
            className="flex gap-2"
          >
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="+216..."
              className="flex-1 px-3 py-2 text-xs font-mono bg-[#F9F7F2] border border-[#E6E1D6] focus:outline-none focus:border-[#111111]"
            />
            <button
              type="submit"
              disabled={walletBusy}
              className="px-4 py-2 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
            >
              Check
            </button>
          </form>

          {wallet && (
            <div className="space-y-4">
              <div className="bg-[#F9F7F2] border border-[#E6E1D6] p-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-xs text-[#5C5953]">{wallet.customerName}</p>
                    <p className="font-mono text-xs text-[#111111]">{wallet.phone}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-semibold text-[#111111] tabular-nums">
                      {wallet.pointsBalance}
                    </span>
                    <span className="text-xs text-[#5C5953]"> pts available</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-[#5C5953] mb-1 tabular-nums">
                    <span>Progress toward 10% Discount Code</span>
                    <span>{progressPts} / 10 pts</span>
                  </div>
                  <div className="w-full h-2 bg-[#E6E1D6] overflow-hidden">
                    <div
                      className="h-full bg-[#C5A059] transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={walletBusy || wallet.pointsBalance < LOYALTY_POINTS_PER_VOUCHER}
                  onClick={redeemVoucher}
                  className="w-full py-2.5 bg-[#C5A059] text-[#111111] text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-2 disabled:opacity-45 hover:bg-[#D4B06A]"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {wallet.pointsBalance >= 10
                      ? 'Convert 10 Points into 10% OFF Code'
                      : `Need ${10 - wallet.pointsBalance} more pts to unlock 10% OFF`}
                  </span>
                </button>
                {walletMsg && <p className="text-xs font-medium text-[#1F7A52]">{walletMsg}</p>}
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-[#5C5953] mb-2">
                  Your 10% Discount Codes
                </p>
                {wallet.codes.length === 0 ? (
                  <p className="text-xs text-[#5C5953]">No codes redeemed yet for this number.</p>
                ) : (
                  <div className="divide-y divide-[#E6E1D6] border border-[#E6E1D6]">
                    {wallet.codes.map((c) => (
                      <div key={c.id} className="flex items-center justify-between px-3 py-2 text-xs">
                        <div>
                          <span className="font-mono font-semibold text-[#111111]">{c.code}</span>
                          <span className="text-[#5C5953] ml-2">-{c.discountPercent}% OFF</span>
                        </div>
                        <span
                          className={
                            c.isUsed ? 'text-[#5C5953] line-through' : 'text-[#1F7A52] font-semibold'
                          }
                        >
                          {c.isUsed ? `Used (${c.usedOnOrderCode || ''})` : 'Ready to Apply'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Order Tracking & WhatsApp Dispatch Log */}
        <div className="lg:col-span-7 bg-white border border-[#E6E1D6] p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#8B6B2E]" />
              <h3 className="font-editorial text-2xl text-[#111111]">Live Parcel Tracking</h3>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#5C5953]">
              <span>Samples:</span>
              {['GTM-1042', 'GTM-1043', 'GTM-1044'].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => {
                    setOrderCodeInput(sample);
                    lookupOrder(sample);
                  }}
                  className="font-mono underline hover:text-[#111111]"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              lookupOrder(orderCodeInput);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#5C5953] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderCodeInput}
                onChange={(e) => setOrderCodeInput(e.target.value.toUpperCase())}
                placeholder="Order code (e.g. GTM-1042)"
                className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-[#F9F7F2] border border-[#E6E1D6] focus:outline-none focus:border-[#111111]"
              />
            </div>
            <button
              type="submit"
              disabled={trackBusy}
              className="px-4 py-2 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
            >
              Track
            </button>
          </form>

          {trackError && <p className="text-xs text-[#9E2A2B] font-medium">{trackError}</p>}

          {trackedOrder && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F9F7F2] border border-[#E6E1D6] p-4">
                <div>
                  <p className="font-mono text-base font-semibold text-[#111111]">
                    #{trackedOrder.orderCode} · {trackedOrder.customerName}
                  </p>
                  <p className="text-xs text-[#5C5953] mt-0.5">
                    {trackedOrder.deliveryAddress}, {trackedOrder.city} · +{trackedOrder.pointsEarned} pts earned
                  </p>
                </div>
                <div className="text-right tabular-nums">
                  <p className="text-base font-semibold text-[#111111]">{trackedOrder.totalTnd} TND</p>
                  <p className="text-[11px] uppercase tracking-wider text-[#8B6B2E] font-semibold">
                    {trackedOrder.status}
                  </p>
                </div>
              </div>

              {/* 4-Stage Horizontal Pipeline */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PIPELINE_STEPS.map((step, idx) => {
                  const done = idx <= activeStepIdx;
                  return (
                    <div
                      key={step.key}
                      className={`p-3 border text-xs ${
                        done
                          ? 'bg-[#111111] text-[#F9F7F2] border-[#111111]'
                          : 'bg-[#F9F7F2] text-[#5C5953] border-[#E6E1D6]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[10px]">0{idx + 1}</span>
                        {done ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059]" />
                        ) : (
                          <Package className="w-3.5 h-3.5 opacity-40" />
                        )}
                      </div>
                      <p className="font-medium">{step.label}</p>
                    </div>
                  );
                })}
              </div>

              {/* WhatsApp Tracking Updates Feed */}
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-[#5C5953]">
                  WhatsApp Tracking Log
                </p>
                <div className="divide-y divide-[#E6E1D6] border border-[#E6E1D6]">
                  {trackingLog.map((entry, idx) => {
                    const msg = entry.whatsappPreview || trackedOrder.whatsappMessage;
                    const waLink = `https://wa.me/${trackedOrder.customerPhone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(msg)}`;
                    return (
                      <div key={idx} className="p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#111111] uppercase tracking-wider text-[11px]">
                            {entry.status}
                          </span>
                          <span className="text-[11px] text-[#5C5953] font-mono">
                            {new Date(entry.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-[#5C5953]">{entry.note}</p>
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11px] text-[#1F7A52] font-medium hover:underline pt-0.5"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>Preview / Send WhatsApp Update</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Boutique & Dispatch Hub Map */}
      <div id="boutique" className="pt-4">
        <StoreLocationMap compact={false} onQuotaDetected={onQuotaDetected} />
      </div>
    </section>
  );
}
