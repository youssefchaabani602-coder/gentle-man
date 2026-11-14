import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Camera,
  Check,
  Download,
  ExternalLink,
  MessageCircle,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { CashFlowEntryRecord, GarmentType, OrderRecord, ProductRecord } from '../types';
import type { CashFlowSummary } from '../utils/commerce';
import { ThreeGarmentStage, ThreeGarmentStageHandle } from './ThreeGarmentStage';

interface OverviewResponse {
  summary: CashFlowSummary;
  entries: CashFlowEntryRecord[];
  orders: OrderRecord[];
  products: ProductRecord[];
  loyaltyCount: number;
}

export function OwnerDashboard({
  onProductsChanged,
  initialTab = 'inventory',
}: {
  onProductsChanged: () => void;
  initialTab?: 'ledger' | 'inventory' | 'orders' | 'studio';
}) {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ledger' | 'inventory' | 'orders' | 'studio'>(initialTab);

  // Cashflow form
  const [entryType, setEntryType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState('Fabric Restock');
  const [description, setDescription] = useState('');
  const [amountTnd, setAmountTnd] = useState('');
  const [referenceCode, setReferenceCode] = useState('');
  const [ledgerBusy, setLedgerBusy] = useState(false);

  // Add Product form
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Blazers');
  const [newGarmentType, setNewGarmentType] = useState<GarmentType>('blazer');
  const [newImageKey, setNewImageKey] = useState('garment_tailored_blazer');
  const [newPrice, setNewPrice] = useState('340');
  const [newCost, setNewCost] = useState('175');
  const [newStock, setNewStock] = useState('8');
  const [newPoints, setNewPoints] = useState('6');
  const [newDesc, setNewDesc] = useState('');
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [inventoryNotice, setInventoryNotice] = useState<string | null>(null);

  // Inline Edit Product state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<{
    name: string;
    category: string;
    priceTnd: string;
    costTnd: string;
    stock: string;
    pointsReward: string;
  }>({
    name: '',
    category: 'Blazers',
    priceTnd: '0',
    costTnd: '0',
    stock: '0',
    pointsReward: '1',
  });

  // Order WhatsApp latest update preview
  const [latestWaUpdate, setLatestWaUpdate] = useState<{
    orderCode: string;
    text: string;
    url: string;
  } | null>(null);

  // AI CFO Insights
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // 3D Studio Snapshot & Lookbook
  const studioStageRef = useRef<ThreeGarmentStageHandle | null>(null);
  const [studioGarment, setStudioGarment] = useState<GarmentType>('blazer');
  const [studioColor, setStudioColor] = useState('#181B22');
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [lookbookPrompt, setLookbookPrompt] = useState(
    'Editorial menswear lookbook of a tailored charcoal wool blazer in warm limestone courtyard light'
  );
  const [lookbookNotice, setLookbookNotice] = useState<string | null>(null);
  const [lookbookImage, setLookbookImage] = useState<string | null>(null);
  const [lookbookBusy, setLookbookBusy] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/overview');
      if (res.ok) {
        const json = (await res.json()) as OverviewResponse;
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  async function handleAddLedger(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !amountTnd) return;
    setLedgerBusy(true);
    try {
      const res = await fetch('/api/admin/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryType,
          category,
          description: description.trim(),
          amountTnd: Number(amountTnd),
          referenceCode: referenceCode.trim(),
        }),
      });
      if (res.ok) {
        setDescription('');
        setAmountTnd('');
        setReferenceCode('');
        await loadOverview();
      }
    } finally {
      setLedgerBusy(false);
    }
  }

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setInventoryBusy(true);
    setInventoryNotice(null);
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          category: newCategory,
          garmentType: newGarmentType,
          imageKey: newImageKey,
          priceTnd: Number(newPrice),
          costTnd: Number(newCost),
          stock: Number(newStock),
          pointsReward: Number(newPoints),
          description: newDesc.trim() || 'Tailored menswear crafted for Gentleman Atelier Kairouan.',
        }),
      });
      if (res.ok) {
        const addedName = newName.trim();
        setNewName('');
        setNewDesc('');
        setShowAddProduct(false);
        setInventoryNotice(`Added "${addedName}" to catalog & inventory.`);
        await loadOverview();
        onProductsChanged();
      } else {
        const err = (await res.json()) as { error?: string };
        setInventoryNotice(err.error || 'Could not add garment.');
      }
    } finally {
      setInventoryBusy(false);
    }
  }

  function startEditingProduct(product: ProductRecord) {
    setEditingId(product.id);
    setInventoryNotice(null);
    setEditDraft({
      name: product.name,
      category: product.category,
      priceTnd: String(product.priceTnd),
      costTnd: String(product.costTnd),
      stock: String(product.stock),
      pointsReward: String(product.pointsReward),
    });
  }

  async function handleSaveProductEdit(productId: number) {
    if (!editDraft.name.trim()) return;
    setInventoryBusy(true);
    setInventoryNotice(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editDraft.name.trim(),
          category: editDraft.category,
          priceTnd: Math.max(1, Number(editDraft.priceTnd) || 1),
          costTnd: Math.max(0, Number(editDraft.costTnd) || 0),
          stock: Math.max(0, Number(editDraft.stock) || 0),
          pointsReward: Math.max(1, Number(editDraft.pointsReward) || 1),
        }),
      });
      if (res.ok) {
        setEditingId(null);
        setInventoryNotice(`Updated "${editDraft.name.trim()}" in live store catalog.`);
        await loadOverview();
        onProductsChanged();
      } else {
        const err = (await res.json()) as { error?: string };
        setInventoryNotice(err.error || 'Failed to update garment.');
      }
    } finally {
      setInventoryBusy(false);
    }
  }

  async function handleStockAdjust(product: ProductRecord, delta: number) {
    const nextStock = Math.max(0, product.stock + delta);
    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: nextStock }),
    });
    if (res.ok) {
      await loadOverview();
      onProductsChanged();
    }
  }

  async function handleDeleteProduct(product: ProductRecord) {
    setInventoryNotice(null);
    const res = await fetch(`/api/admin/products/${product.id}`, { method: 'DELETE' });
    if (res.ok) {
      if (editingId === product.id) setEditingId(null);
      setInventoryNotice(`Removed "${product.name}" from store catalog.`);
      await loadOverview();
      onProductsChanged();
    }
  }

  async function handleUpdateOrderStatus(orderId: number, orderCode: string, status: OrderRecord['status']) {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const json = (await res.json()) as { whatsappText: string; whatsappUrl: string };
      setLatestWaUpdate({
        orderCode,
        text: json.whatsappText,
        url: json.whatsappUrl,
      });
      await loadOverview();
    }
  }

  async function handleGenerateInsights() {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/owner-insights', { method: 'POST' });
      const json = (await res.json()) as { analysis?: string; error?: string };
      setAiInsights(json.analysis || json.error || 'No analysis available.');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleLookbookEdit(e: React.FormEvent) {
    e.preventDefault();
    setLookbookBusy(true);
    setLookbookNotice(null);
    try {
      const res = await fetch('/api/ai/lookbook-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: lookbookPrompt }),
      });
      const json = (await res.json()) as {
        imageUrl?: string;
        paidKeyRequired?: boolean;
        error?: string;
      };
      if (res.ok && json.imageUrl) {
        setLookbookImage(json.imageUrl);
      } else {
        setLookbookNotice(
          json.error ||
            'Editorial image generation requires a billing-enabled Gemini API key. Capture live 3D Garment Studio snapshots on the left.'
        );
      }
    } finally {
      setLookbookBusy(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-16 text-sm text-[#5C5953]">
        Loading Gentleman Owner Studio &amp; Financial Ledger...
      </div>
    );
  }

  const summary = data?.summary ?? {
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    profitMarginPct: 0,
    byCategory: [],
  };
  const lowStockProducts = (data?.products ?? []).filter((p) => p.stock <= 5);
  const maxBar = Math.max(1, summary.totalIncome, summary.totalExpenses);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 space-y-8">
      {/* Studio Header & CSV Exports */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#E6E1D6] pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#8B6B2E] font-medium">
            Owner Studio · Kairouan Operations &amp; Financial Control
          </p>
          <h1 className="font-editorial text-3xl md:text-4xl text-[#111111] mt-1">
            Cash Flow, Inventory &amp; Dispatch Analytics
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadOverview}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E6E1D6] text-xs font-medium hover:border-[#111111]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <a
            href="/api/admin/export/cashflow"
            download="gentleman-cashflow.csv"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E6E1D6] text-xs font-medium hover:border-[#111111]"
          >
            <Download className="w-3.5 h-3.5 text-[#8B6B2E]" />
            <span>Export Cash Flow CSV</span>
          </a>
          <a
            href="/api/admin/export/orders"
            download="gentleman-orders.csv"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E6E1D6] text-xs font-medium hover:border-[#111111]"
          >
            <Download className="w-3.5 h-3.5 text-[#8B6B2E]" />
            <span>Export Orders CSV</span>
          </a>
          <a
            href="/api/admin/export/inventory"
            download="gentleman-inventory.csv"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E6E1D6] text-xs font-medium hover:border-[#111111]"
          >
            <Download className="w-3.5 h-3.5 text-[#8B6B2E]" />
            <span>Export Inventory CSV</span>
          </a>
        </div>
      </div>

      {/* KPI Strip (Money In / Money Out / Net Profit / Active Orders) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E6E1D6] p-5">
          <div className="flex items-center justify-between text-xs text-[#5C5953]">
            <span className="uppercase tracking-wider">Money In (Revenue)</span>
            <ArrowUpRight className="w-4 h-4 text-[#1F7A52]" />
          </div>
          <p className="font-editorial text-3xl text-[#111111] tabular-nums mt-2">
            {summary.totalIncome.toLocaleString()} <span className="text-sm font-sans">TND</span>
          </p>
          <p className="text-[11px] text-[#5C5953] mt-1">Online + boutique sales recorded</p>
        </div>

        <div className="bg-white border border-[#E6E1D6] p-5">
          <div className="flex items-center justify-between text-xs text-[#5C5953]">
            <span className="uppercase tracking-wider">Money Out (Expenses)</span>
            <ArrowDownRight className="w-4 h-4 text-[#9E2A2B]" />
          </div>
          <p className="font-editorial text-3xl text-[#111111] tabular-nums mt-2">
            {summary.totalExpenses.toLocaleString()} <span className="text-sm font-sans">TND</span>
          </p>
          <p className="text-[11px] text-[#5C5953] mt-1">Restocks, shipping, rent &amp; supplies</p>
        </div>

        <div className="bg-white border border-[#E6E1D6] p-5">
          <div className="flex items-center justify-between text-xs text-[#5C5953]">
            <span className="uppercase tracking-wider">Net Cash Flow</span>
            <span className="font-mono text-[11px] font-semibold text-[#1F7A52] tabular-nums">
              {summary.profitMarginPct}% margin
            </span>
          </div>
          <p
            className={`font-editorial text-3xl tabular-nums mt-2 ${
              summary.netProfit >= 0 ? 'text-[#1F7A52]' : 'text-[#9E2A2B]'
            }`}
          >
            {summary.netProfit >= 0 ? '+' : ''}
            {summary.netProfit.toLocaleString()} <span className="text-sm font-sans">TND</span>
          </p>
          <p className="text-[11px] text-[#5C5953] mt-1">Real-time profit after outflows</p>
        </div>

        <div className="bg-white border border-[#E6E1D6] p-5">
          <div className="flex items-center justify-between text-xs text-[#5C5953]">
            <span className="uppercase tracking-wider">Orders &amp; Stock Alerts</span>
            {lowStockProducts.length > 0 && <AlertTriangle className="w-4 h-4 text-[#B4690E]" />}
          </div>
          <p className="font-editorial text-3xl text-[#111111] tabular-nums mt-2">
            {data?.orders.length ?? 0} <span className="text-sm font-sans">orders</span>
          </p>
          <p className="text-[11px] text-[#5C5953] mt-1">
            {lowStockProducts.length} low-stock SKU(s) · {data?.loyaltyCount ?? 0} loyalty clients
          </p>
        </div>
      </div>

      {/* Money In vs Money Out Visual + AI CFO Advisor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#E6E1D6] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-editorial text-xl text-[#111111]">
              Money In vs. Money Out Breakdown
            </h2>
            <span className="text-xs text-[#5C5953] tabular-nums">All Values in TND</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-medium text-[#111111]">Total Money In</span>
                <span className="font-mono font-semibold text-[#1F7A52] tabular-nums">
                  +{summary.totalIncome} TND
                </span>
              </div>
              <div className="h-3 bg-[#F3EFE6] w-full">
                <div
                  className="h-full bg-[#1F7A52]"
                  style={{ width: `${Math.round((summary.totalIncome / maxBar) * 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-medium text-[#111111]">Total Money Out</span>
                <span className="font-mono font-semibold text-[#9E2A2B] tabular-nums">
                  -{summary.totalExpenses} TND
                </span>
              </div>
              <div className="h-3 bg-[#F3EFE6] w-full">
                <div
                  className="h-full bg-[#9E2A2B]"
                  style={{ width: `${Math.round((summary.totalExpenses / maxBar) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-[#E6E1D6] pt-4">
            <p className="text-xs uppercase tracking-wider text-[#5C5953] mb-2.5">
              By Financial Category
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {summary.byCategory.map((cat) => (
                <div
                  key={cat.category}
                  className="flex items-center justify-between px-3 py-2 bg-[#F9F7F2] border border-[#E6E1D6]"
                >
                  <span className="font-medium text-[#111111] truncate">{cat.category}</span>
                  <span className="font-mono tabular-nums">
                    {cat.income > 0 && <span className="text-[#1F7A52]">+{cat.income}</span>}
                    {cat.income > 0 && cat.expense > 0 && ' / '}
                    {cat.expense > 0 && <span className="text-[#9E2A2B]">-{cat.expense}</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#E6E1D6] p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#8B6B2E]" />
                <h2 className="font-editorial text-xl text-[#111111]">AI Retail CFO Insights</h2>
              </div>
              <button
                type="button"
                disabled={aiLoading}
                onClick={handleGenerateInsights}
                className="px-3 py-1.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#2A2825] disabled:opacity-50"
              >
                {aiLoading ? 'Analyzing...' : 'Run Deep Analysis'}
              </button>
            </div>
            <div className="bg-[#F9F7F2] border border-[#E6E1D6] p-4 min-h-[160px] text-xs leading-relaxed text-[#111111] whitespace-pre-wrap">
              {aiInsights ||
                'Click "Run Deep Analysis" to inspect live profit margins, restock urgency for low-inventory garments, and loyalty voucher ROI.'}
            </div>
          </div>
          {lowStockProducts.length > 0 && (
            <p className="text-[11px] text-[#B4690E] font-medium">
              Restock Alert: {lowStockProducts.map((p) => `${p.name} (${p.stock} left)`).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {/* Navigation Tabs for Operational Tables */}
      <div className="flex flex-wrap border-b border-[#E6E1D6] gap-1">
        {[
          { key: 'inventory', label: `Inventory (${data?.products.length ?? 0})` },
          { key: 'ledger', label: `Cash Flow Ledger (${data?.entries.length ?? 0})` },
          { key: 'orders', label: `Orders & WhatsApp (${data?.orders.length ?? 0})` },
          { key: 'studio', label: '3D Garment Studio' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key as typeof activeTab)}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-[#111111] text-[#111111] bg-white'
                : 'border-transparent text-[#5C5953] hover:text-[#111111]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: CASH FLOW LEDGER */}
      {activeTab === 'ledger' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleAddLedger}
            className="lg:col-span-4 bg-white border border-[#E6E1D6] p-5 space-y-3.5 h-fit"
          >
            <h3 className="font-editorial text-xl text-[#111111]">Log Money In / Out</h3>
            <div className="grid grid-cols-2 gap-2">
              {(['income', 'expense'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setEntryType(type);
                    setCategory(type === 'income' ? 'Boutique Sale' : 'Fabric Restock');
                  }}
                  className={`py-2 text-xs font-semibold uppercase tracking-wider border ${
                    entryType === type
                      ? type === 'income'
                        ? 'bg-[#1F7A52] text-white border-[#1F7A52]'
                        : 'bg-[#9E2A2B] text-white border-[#9E2A2B]'
                      : 'bg-[#F9F7F2] text-[#111111] border-[#E6E1D6]'
                  }`}
                >
                  {type === 'income' ? '+ Money In' : '- Money Out'}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#5C5953] mb-1">
                Category
              </label>
              <input
                type="text"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E6E1D6]"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[#5C5953] mb-1">
                Description
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Restock 10 linen shirts or Boutique walk-in sale"
                className="w-full px-3 py-2 text-xs bg-[#F9F7F2] border border-[#E6E1D6]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#5C5953] mb-1">
                  Amount (TND)
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={amountTnd}
                  onChange={(e) => setAmountTnd(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#F9F7F2] border border-[#E6E1D6]"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#5C5953] mb-1">
                  Reference
                </label>
                <input
                  type="text"
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  placeholder="INV-205"
                  className="w-full px-3 py-2 text-xs font-mono bg-[#F9F7F2] border border-[#E6E1D6]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={ledgerBusy}
              className="w-full py-2.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#2A2825]"
            >
              {ledgerBusy ? 'Saving...' : 'Record Ledger Transaction'}
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-[#E6E1D6] overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E6E1D6] bg-[#F9F7F2] text-[#5C5953] uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Ref</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E1D6]">
                {(data?.entries ?? []).map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#F9F7F2]/60">
                    <td className="py-3 px-4 font-mono text-[#5C5953] whitespace-nowrap">
                      {entry.entryDate}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#111111] whitespace-nowrap">
                      {entry.category}
                    </td>
                    <td className="py-3 px-4 text-[#111111]">{entry.description}</td>
                    <td className="py-3 px-4 font-mono text-[#5C5953]">
                      {entry.referenceCode || '—'}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                        entry.entryType === 'income' ? 'text-[#1F7A52]' : 'text-[#9E2A2B]'
                      }`}
                    >
                      {entry.entryType === 'income' ? '+' : '-'}
                      {entry.amountTnd} TND
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY MANAGEMENT */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <p className="text-xs text-[#5C5953]">
              Add new pieces, adjust stock quantities, edit prices, or remove items from your live client shop.
            </p>
            <button
              type="button"
              onClick={() => setShowAddProduct((v) => !v)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#2A2825]"
            >
              <PackagePlus className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>{showAddProduct ? 'Close Form' : 'Add New Garment'}</span>
            </button>
          </div>

          {inventoryNotice && (
            <div className="px-4 py-2.5 bg-white border border-[#C5A059] text-xs text-[#111111] flex items-center justify-between gap-2">
              <span>{inventoryNotice}</span>
              <button
                type="button"
                onClick={() => setInventoryNotice(null)}
                className="text-[#5C5953] hover:text-[#111111]"
                aria-label="Dismiss inventory notice"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {showAddProduct && (
            <form
              onSubmit={handleCreateProduct}
              className="bg-white border border-[#E6E1D6] p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs"
            >
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#5C5953] mb-1">
                  Garment Name
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Bourguiba Silk Jacket"
                  className="w-full px-3 py-2 bg-[#F9F7F2] border border-[#E6E1D6]"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#5C5953] mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F9F7F2] border border-[#E6E1D6]"
                >
                  <option>Blazers</option>
                  <option>Shirts</option>
                  <option>Knitwear</option>
                  <option>Trousers</option>
                  <option>Outerwear</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#5C5953] mb-1">
                  3D Model Type
                </label>
                <select
                  value={newGarmentType}
                  onChange={(e) => {
                    const gt = e.target.value as GarmentType;
                    setNewGarmentType(gt);
                    const imgMap: Record<GarmentType, string> = {
                      blazer: 'garment_tailored_blazer',
                      overshirt: 'garment_linen_overshirt',
                      polo: 'garment_merino_polo',
                      trousers: 'garment_pleated_trousers',
                      bomber: 'garment_leather_bomber',
                    };
                    setNewImageKey(imgMap[gt]);
                  }}
                  className="w-full px-3 py-2 bg-[#F9F7F2] border border-[#E6E1D6]"
                >
                  <option value="blazer">Blazer</option>
                  <option value="overshirt">Overshirt</option>
                  <option value="polo">Knit Polo</option>
                  <option value="trousers">Pleated Trousers</option>
                  <option value="bomber">Leather Bomber</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#5C5953] mb-1">
                    Price (TND)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full px-2.5 py-2 font-mono bg-[#F9F7F2] border border-[#E6E1D6]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#5C5953] mb-1">
                    Cost (TND)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value)}
                    className="w-full px-2.5 py-2 font-mono bg-[#F9F7F2] border border-[#E6E1D6]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#5C5953] mb-1">
                    Stock
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    className="w-full px-2.5 py-2 font-mono bg-[#F9F7F2] border border-[#E6E1D6]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#5C5953] mb-1">
                    Loyalty Pts
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newPoints}
                    onChange={(e) => setNewPoints(e.target.value)}
                    className="w-full px-2.5 py-2 font-mono bg-[#F9F7F2] border border-[#E6E1D6]"
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] uppercase tracking-wider text-[#5C5953] mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Material, lining, and cut..."
                  className="w-full px-3 py-2 bg-[#F9F7F2] border border-[#E6E1D6]"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={inventoryBusy}
                  className="w-full py-2 bg-[#C5A059] text-[#111111] font-semibold uppercase tracking-wider disabled:opacity-50"
                >
                  {inventoryBusy ? 'Saving...' : 'Save Garment to Catalog'}
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-[#E6E1D6] overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E6E1D6] bg-[#F9F7F2] text-[#5C5953] uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Garment</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Price</th>
                  <th className="py-3 px-4 text-right">Unit Cost</th>
                  <th className="py-3 px-4 text-right">Margin</th>
                  <th className="py-3 px-4 text-center">Stock</th>
                  <th className="py-3 px-4 text-right">Pts</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E1D6]">
                {(data?.products ?? []).map((p) => {
                  const isEditing = editingId === p.id;
                  return (
                    <tr key={p.id} className="hover:bg-[#F9F7F2]/60">
                      <td className="py-3 px-4 font-medium text-[#111111]">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDraft.name}
                            onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                            aria-label={`Edit name for ${p.name}`}
                            className="w-full min-w-[160px] px-2 py-1 bg-[#F9F7F2] border border-[#111111] text-xs"
                          />
                        ) : (
                          p.name
                        )}
                      </td>
                      <td className="py-3 px-4 text-[#5C5953]">
                        {isEditing ? (
                          <select
                            value={editDraft.category}
                            onChange={(e) =>
                              setEditDraft((d) => ({ ...d, category: e.target.value }))
                            }
                            aria-label={`Edit category for ${p.name}`}
                            className="px-2 py-1 bg-[#F9F7F2] border border-[#E6E1D6] text-xs"
                          >
                            <option>Blazers</option>
                            <option>Shirts</option>
                            <option>Knitwear</option>
                            <option>Trousers</option>
                            <option>Outerwear</option>
                          </select>
                        ) : (
                          p.category
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {isEditing ? (
                          <input
                            type="number"
                            min={1}
                            value={editDraft.priceTnd}
                            onChange={(e) =>
                              setEditDraft((d) => ({ ...d, priceTnd: e.target.value }))
                            }
                            aria-label={`Edit price for ${p.name}`}
                            className="w-20 px-2 py-1 text-right bg-[#F9F7F2] border border-[#E6E1D6] text-xs font-mono"
                          />
                        ) : (
                          `${p.priceTnd} TND`
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#5C5953] tabular-nums">
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            value={editDraft.costTnd}
                            onChange={(e) =>
                              setEditDraft((d) => ({ ...d, costTnd: e.target.value }))
                            }
                            aria-label={`Edit cost for ${p.name}`}
                            className="w-20 px-2 py-1 text-right bg-[#F9F7F2] border border-[#E6E1D6] text-xs font-mono"
                          />
                        ) : (
                          `${p.costTnd} TND`
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#1F7A52] tabular-nums">
                        +{isEditing
                          ? (Number(editDraft.priceTnd) || 0) - (Number(editDraft.costTnd) || 0)
                          : p.priceTnd - p.costTnd}{' '}
                        TND
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            value={editDraft.stock}
                            onChange={(e) => setEditDraft((d) => ({ ...d, stock: e.target.value }))}
                            aria-label={`Edit stock for ${p.name}`}
                            className="w-16 px-2 py-1 text-center bg-[#F9F7F2] border border-[#E6E1D6] text-xs font-mono"
                          />
                        ) : (
                          <div className="inline-flex items-center gap-1.5 border border-[#E6E1D6] px-1.5 py-0.5">
                            <button
                              type="button"
                              onClick={() => handleStockAdjust(p, -1)}
                              className="px-1 text-[#5C5953] hover:text-[#111111]"
                              aria-label={`Decrease stock for ${p.name}`}
                            >
                              -
                            </button>
                            <span
                              className={`font-mono font-semibold tabular-nums px-1 ${
                                p.stock <= 5 ? 'text-[#B4690E]' : 'text-[#111111]'
                              }`}
                            >
                              {p.stock}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStockAdjust(p, 1)}
                              className="px-1 text-[#5C5953] hover:text-[#111111]"
                              aria-label={`Increase stock for ${p.name}`}
                            >
                              <Plus className="w-3 h-3 inline" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#8B6B2E] tabular-nums">
                        {isEditing ? (
                          <input
                            type="number"
                            min={1}
                            value={editDraft.pointsReward}
                            onChange={(e) =>
                              setEditDraft((d) => ({ ...d, pointsReward: e.target.value }))
                            }
                            aria-label={`Edit loyalty points for ${p.name}`}
                            className="w-14 px-2 py-1 text-right bg-[#F9F7F2] border border-[#E6E1D6] text-xs font-mono"
                          />
                        ) : (
                          `+${p.pointsReward}`
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={inventoryBusy}
                              onClick={() => handleSaveProductEdit(p.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-[#1F7A52] text-white text-[11px] font-semibold uppercase tracking-wider"
                              aria-label={`Save changes for ${p.name}`}
                            >
                              <Check className="w-3 h-3" />
                              <span>Save</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="inline-flex items-center gap-1 px-2 py-1 border border-[#E6E1D6] text-[#5C5953] text-[11px] font-semibold uppercase tracking-wider hover:text-[#111111]"
                              aria-label={`Cancel editing ${p.name}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => startEditingProduct(p)}
                              className="text-[#5C5953] hover:text-[#111111]"
                              aria-label={`Edit ${p.name}`}
                            >
                              <Pencil className="w-3.5 h-3.5 inline" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(p)}
                              className="text-[#5C5953] hover:text-[#9E2A2B]"
                              aria-label={`Delete ${p.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ORDERS & WHATSAPP UPDATES */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {latestWaUpdate && (
            <div className="bg-white border border-[#1F7A52] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-semibold text-[#1F7A52]">
                  WhatsApp Update Ready for #{latestWaUpdate.orderCode}
                </p>
                <p className="text-[#5C5953] mt-0.5 line-clamp-2">{latestWaUpdate.text}</p>
              </div>
              <a
                href={latestWaUpdate.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1F7A52] text-white font-semibold uppercase tracking-wider shrink-0"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Send via WhatsApp</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          <div className="bg-white border border-[#E6E1D6] overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E6E1D6] bg-[#F9F7F2] text-[#5C5953] uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">City</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E1D6]">
                {(data?.orders ?? []).map((o) => {
                  const waHref = `https://wa.me/${o.customerPhone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(o.whatsappMessage)}`;
                  return (
                    <tr key={o.id} className="hover:bg-[#F9F7F2]/60">
                      <td className="py-3 px-4 font-mono font-semibold text-[#111111]">
                        #{o.orderCode}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-[#111111]">{o.customerName}</p>
                        <p className="text-[11px] font-mono text-[#5C5953]">{o.customerPhone}</p>
                      </td>
                      <td className="py-3 px-4 text-[#5C5953]">{o.city}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums">
                        {o.totalTnd} TND
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={o.status}
                          onChange={(e) =>
                            handleUpdateOrderStatus(
                              o.id,
                              o.orderCode,
                              e.target.value as OrderRecord['status']
                            )
                          }
                          className="px-2.5 py-1.5 bg-[#F9F7F2] border border-[#E6E1D6] text-xs font-medium"
                        >
                          <option value="confirmed">confirmed</option>
                          <option value="tailoring">tailoring</option>
                          <option value="dispatched">dispatched</option>
                          <option value="delivered">delivered</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#1F7A52] font-medium hover:underline"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Message</span>
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: 3D GARMENT STUDIO & LOOKBOOK */}
      {activeTab === 'studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-[#15181F] border border-[#E6E1D6] overflow-hidden flex flex-col">
            <div className="h-[360px]">
              <ThreeGarmentStage
                ref={studioStageRef}
                mode="inspector"
                garmentType={studioGarment}
                colorHex={studioColor}
                showHeroDock={false}
              />
            </div>
            <div className="p-4 bg-white border-t border-[#E6E1D6] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {(['blazer', 'overshirt', 'polo', 'trousers', 'bomber'] as GarmentType[]).map(
                  (gt) => (
                    <button
                      key={gt}
                      type="button"
                      onClick={() => setStudioGarment(gt)}
                      className={`px-2.5 py-1 text-xs border ${
                        studioGarment === gt
                          ? 'bg-[#111111] text-white border-[#111111]'
                          : 'border-[#E6E1D6] text-[#111111]'
                      }`}
                    >
                      {gt}
                    </button>
                  )
                )}
              </div>
              <div className="flex items-center gap-2">
                {['#181B22', '#C6B394', '#3D271E', '#4F5C4D'].map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setStudioColor(hex)}
                    className={`w-5 h-5 border ${
                      studioColor === hex ? 'border-[#C5A059] scale-110' : 'border-black/20'
                    }`}
                    style={{ backgroundColor: hex }}
                    aria-label={`Studio color ${hex}`}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const snap = studioStageRef.current?.captureSnapshot();
                    if (snap) setSnapshotUrl(snap);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#C5A059] text-[#111111] text-xs font-semibold uppercase tracking-wider"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Capture 3D Shot</span>
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-[#E6E1D6] p-5 space-y-4">
            <h3 className="font-editorial text-xl text-[#111111]">
              Lookbook Snapshot &amp; Editorial Studio
            </h3>
            {snapshotUrl && (
              <div className="space-y-2">
                <img
                  src={snapshotUrl}
                  alt="Captured 3D Garment Render"
                  className="w-full h-44 object-cover border border-[#E6E1D6]"
                />
                <a
                  href={snapshotUrl}
                  download={`gentleman-${studioGarment}.png`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8B6B2E] hover:underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download 3D PNG</span>
                </a>
              </div>
            )}

            <form onSubmit={handleLookbookEdit} className="space-y-3 pt-2 border-t border-[#E6E1D6]">
              <label className="block text-[11px] uppercase tracking-wider text-[#5C5953]">
                AI Lookbook Concept Prompt
              </label>
              <textarea
                rows={3}
                value={lookbookPrompt}
                onChange={(e) => setLookbookPrompt(e.target.value)}
                className="w-full p-2.5 text-xs bg-[#F9F7F2] border border-[#E6E1D6]"
              />
              <button
                type="submit"
                disabled={lookbookBusy}
                className="w-full py-2.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider disabled:opacity-50"
              >
                {lookbookBusy ? 'Generating Editorial...' : 'Generate AI Lookbook Frame'}
              </button>
            </form>

            {lookbookNotice && <p className="text-xs text-[#8B6B2E] leading-relaxed">{lookbookNotice}</p>}
            {lookbookImage && (
              <img
                src={lookbookImage}
                alt="AI Generated Menswear Lookbook"
                className="w-full h-44 object-cover border border-[#E6E1D6]"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
