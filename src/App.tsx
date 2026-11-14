import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Box,
  LayoutDashboard,
  LogIn,
  LogOut,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import type { GarmentType, ProductColorOption, ProductRecord } from './types';
import { resolveProductImage } from './data/catalogMedia';
import { ThreeGarmentStage } from './components/ThreeGarmentStage';
import { ProductModal3D } from './components/ProductModal3D';
import { CartCheckoutDrawer, CartUiItem } from './components/CartCheckoutDrawer';
import { LoyaltyTrackingSection } from './components/LoyaltyTrackingSection';
import { OwnerDashboard } from './components/OwnerDashboard';
import { StylistDrawer } from './components/StylistDrawer';
import { resolvePortalRoute } from './utils/commerce';

const CATEGORIES = ['All', 'Blazers', 'Shirts', 'Knitwear', 'Trousers', 'Outerwear'];

function StorefrontShell() {
  const { user, signInWithGoogle, logout } = useAuth();

  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const portalRoute = resolvePortalRoute(pathname);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');

  // 3D Hero showcase interactive state
  const [heroGarment, setHeroGarment] = useState<GarmentType>('blazer');
  const [heroColor, setHeroColor] = useState<string>('#181B22');

  // Modals & Drawers
  const [inspectProduct, setInspectProduct] = useState<ProductRecord | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [stylistOpen, setStylistOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartUiItem[]>([]);
  const [recentOrderCode, setRecentOrderCode] = useState<string | undefined>(undefined);

  // Google Maps Quota Banner state
  const [quotaBanner, setQuotaBanner] = useState<boolean>(
    () => Boolean(window.__gmpQuotaExceeded)
  );

  useEffect(() => {
    const onQuota = () => setQuotaBanner(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    document.title =
      portalRoute === 'owner'
        ? 'Gentleman Atelier | Seller & Owner Console'
        : 'Gentleman Atelier Kairouan | 3D Menswear & Boutique';
  }, [portalRoute]);

  const navigateTo = useCallback((targetPath: '/' | '/owner') => {
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
      setPathname(targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const json = (await res.json()) as { products: ProductRecord[] };
        setProducts(json.products || []);
      }
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'All') return products;
    return products.filter((p) => p.category.toLowerCase() === selectedCategory.toLowerCase());
  }, [products, selectedCategory]);

  const handleAddToCart = useCallback(
    (product: ProductRecord, size?: string, color?: string) => {
      let defaultSize = 'M';
      let defaultColor = 'Obsidian';
      try {
        const sizes = JSON.parse(product.sizesJson) as string[];
        if (sizes[0]) defaultSize = sizes[0];
      } catch {
        // default
      }
      try {
        const colors = JSON.parse(product.colorsJson) as ProductColorOption[];
        if (colors[0]) defaultColor = colors[0].name;
      } catch {
        // default
      }

      const finalSize = size || defaultSize;
      const finalColor = color || defaultColor;

      setCartItems((prev) => {
        const existingIdx = prev.findIndex(
          (i) => i.productId === product.id && i.size === finalSize && i.color === finalColor
        );
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = { ...next[existingIdx], quantity: next[existingIdx].quantity + 1 };
          return next;
        }
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            priceTnd: product.priceTnd,
            quantity: 1,
            pointsReward: product.pointsReward,
            size: finalSize,
            color: finalColor,
            imageUrl: resolveProductImage(product.imageKey),
          },
        ];
      });
      setCartOpen(true);
    },
    []
  );

  const bagCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const navigateToSection = (sectionId: string) => {
    if (portalRoute !== 'client') {
      navigateTo('/');
    }
    setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  if (portalRoute === 'owner') {
    return (
      <div className="min-h-screen bg-[#F9F7F2] text-[#111111] flex flex-col">
        {/* Standalone Seller / Owner Console Header */}
        <header className="sticky top-0 z-40 bg-[#111111] text-[#F9F7F2] border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0">
                <span className="font-editorial text-xl sm:text-2xl tracking-[0.14em] text-white block leading-none">
                  GENTLEMAN
                </span>
                <span className="text-[10px] uppercase tracking-[0.24em] text-[#C5A059] block mt-0.5">
                  Seller &amp; Owner Console
                </span>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 border border-[#C5A059]/40 text-[10px] uppercase tracking-[0.16em] text-[#C5A059]">
                <LayoutDashboard className="w-3 h-3" />
                <span>Private Backoffice (/owner)</span>
              </span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <a
                href="/"
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                    e.preventDefault();
                    navigateTo('/');
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 border border-white/25 text-[#F9F7F2] text-xs font-semibold uppercase tracking-[0.14em] hover:border-[#C5A059] hover:text-[#C5A059] transition-colors whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>View Client Shop</span>
              </a>
            </div>
          </div>
        </header>

        <main className="flex-1">
          <OwnerDashboard onProductsChanged={loadProducts} initialTab="inventory" />
        </main>

        <footer className="bg-[#111111] text-[#D7D2C8] border-t border-white/10 py-6 px-4 sm:px-6 lg:px-10">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <p className="text-white/70">
              Gentleman Atelier Kairouan · Seller Operations, Inventory &amp; Cash Flow Portal
            </p>
            <a
              href="/"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  navigateTo('/');
                }
              }}
              className="text-[#C5A059] hover:underline"
            >
              Open Client Storefront (/)
            </a>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F7F2] text-[#111111] flex flex-col">
      {/* Sticky Google Maps Demo Quota Banner if over quota */}
      {quotaBanner && (
        <div className="sticky top-0 z-50 bg-[#1B1917] text-[#F9F7F2] px-4 py-2 text-xs flex items-center justify-center gap-2 border-b border-[#C5A059]/40">
          <AlertCircle className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
          <span>
            Google Maps demo quota notice detected. Interactive fallback and direct Google Maps links remain active.
          </span>
        </div>
      )}

      {/* Client Web Shop Navigation Bar (Strict 3 Zones) */}
      <header className="sticky top-0 z-40 bg-[#F9F7F2] border-b border-[#E6E1D6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="text-left shrink-0"
          >
            <span className="font-editorial text-xl sm:text-2xl tracking-[0.14em] text-[#111111] block leading-none">
              GENTLEMAN
            </span>
            <span className="text-[10px] uppercase tracking-[0.26em] text-[#8B6B2E] block mt-0.5">
              Atelier · Kairouan
            </span>
          </button>

          {/* Zone 2: Client Storefront Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-xs uppercase tracking-[0.16em] font-medium whitespace-nowrap">
            <button
              type="button"
              onClick={() => navigateToSection('collection')}
              className="hover:text-[#8B6B2E] transition-colors"
            >
              Collection
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('track-rewards')}
              className="hover:text-[#8B6B2E] transition-colors"
            >
              Track &amp; Rewards
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('boutique')}
              className="hover:text-[#8B6B2E] transition-colors"
            >
              Boutique
            </button>
          </nav>

          {/* Zone 3: Primary Bag CTA */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#111111] text-[#F9F7F2] text-xs font-semibold uppercase tracking-[0.14em] hover:bg-[#2A2825] transition-colors whitespace-nowrap"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#C5A059]" />
              <span className="tabular-nums">Bag ({bagCount})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Client Shop Content */}
      <main className="flex-1">
        <>
            {/* HERO SECTION: Full-bleed Scroll & Mouse-Reactive 3D Garment Stage */}
            <section className="relative bg-[#0E1014] text-[#F6F3EC] min-h-[78vh] lg:min-h-[85vh] overflow-hidden flex items-center">
              {/* Interactive 3D Clothes Backdrop */}
              <div className="absolute inset-0">
                <ThreeGarmentStage
                  mode="hero"
                  garmentType={heroGarment}
                  colorHex={heroColor}
                  onSelectGarment={(gt) => {
                    setHeroGarment(gt);
                    const defaultColors: Record<GarmentType, string> = {
                      blazer: '#181B22',
                      overshirt: '#C6B394',
                      polo: '#4F5C4D',
                      trousers: '#353841',
                      bomber: '#3D271E',
                    };
                    setHeroColor(defaultColors[gt]);
                  }}
                  onSelectColor={(hex) => setHeroColor(hex)}
                />
              </div>

              {/* Left Editorial Overlay (Solid dark scrim gradient, no backdrop-filter over WebGL) */}
              <div
                className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-10 pt-10 pb-52 sm:py-14 sm:pb-32 pointer-events-none"
              >
                <div
                  className="max-w-xl p-6 sm:p-8 pointer-events-auto border border-white/10"
                  style={{ backgroundColor: 'rgba(14, 16, 20, 0.84)' }}
                >
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#C5A059] font-medium">
                    Kairouan Flagship · 3D Menswear Runway
                  </p>
                  <h1 className="font-editorial text-4xl sm:text-5xl lg:text-6xl leading-[1.06] text-white mt-3 text-balance">
                    Tailored Silhouettes, Sculpted in Motion.
                  </h1>
                  <p className="text-sm sm:text-base text-[#D7D2C8] mt-4 leading-relaxed">
                    Scroll or glide your cursor to rotate our bespoke Kairouan pieces in real-time 3D. Every garment earns loyalty points—collect 10 points for a 10% OFF voucher and receive instant WhatsApp confirmation.
                  </p>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => navigateToSection('collection')}
                      className="px-6 py-3 bg-[#C5A059] text-[#0E1014] text-xs font-semibold uppercase tracking-[0.16em] hover:bg-[#D7B46E] transition-colors"
                    >
                      Explore Collection
                    </button>
                    <button
                      type="button"
                      onClick={() => setStylistOpen(true)}
                      className="inline-flex items-center gap-2 px-5 py-3 border border-white/25 text-white text-xs font-semibold uppercase tracking-[0.16em] hover:border-[#C5A059] transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
                      <span>Ask AI Stylist</span>
                    </button>
                  </div>

                  {/* Subtle account strip */}
                  <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-white/70">
                    {user ? (
                      <div className="flex items-center gap-2.5">
                        <span>Signed in as {user.displayName || user.email}</span>
                        <button
                          type="button"
                          onClick={logout}
                          className="inline-flex items-center gap-1 text-[#C5A059] hover:underline"
                        >
                          <LogOut className="w-3 h-3" />
                          <span>Sign out</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={signInWithGoogle}
                        className="inline-flex items-center gap-1.5 text-white/85 hover:text-[#C5A059]"
                      >
                        <LogIn className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>Sign in with Google for saved rewards</span>
                      </button>
                    )}

                    <span className="text-[11px] uppercase tracking-[0.16em] text-white/50">
                      10 pts = 10% OFF Next Order
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* COLLECTION CATALOG SECTION */}
            <section
              id="collection"
              className="py-16 md:py-24 px-4 sm:px-6 lg:px-10 max-w-7xl mx-auto"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#E6E1D6] pb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8B6B2E] font-medium">
                    Autumn / Atelier Selection
                  </p>
                  <h2 className="font-editorial text-3xl md:text-4xl text-[#111111] mt-2">
                    Menswear Wardrobe
                  </h2>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => {
                    const active = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3.5 py-2 text-xs font-medium uppercase tracking-wider border transition-colors ${
                          active
                            ? 'bg-[#111111] text-[#F9F7F2] border-[#111111]'
                            : 'bg-white text-[#111111] border-[#E6E1D6] hover:border-[#111111]'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {loadingProducts ? (
                <div className="py-16 text-center text-sm text-[#5C5953]">
                  Loading Atelier Catalog...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-10">
                  {filteredProducts.map((product) => (
                    <article
                      key={product.id}
                      className="bg-white border border-[#E6E1D6] flex flex-col justify-between group"
                    >
                      <div>
                        <div className="relative aspect-[4/5] bg-[#ECE7DC] overflow-hidden">
                          <img
                            src={resolveProductImage(product.imageKey)}
                            alt={product.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                          <button
                            type="button"
                            onClick={() => setInspectProduct(product)}
                            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#111111] text-[#F9F7F2] text-[11px] font-semibold uppercase tracking-wider hover:bg-[#C5A059] hover:text-[#111111] transition-colors"
                          >
                            <Box className="w-3.5 h-3.5" />
                            <span>Inspect 3D</span>
                          </button>
                        </div>

                        <div className="p-5 space-y-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-[#8B6B2E] font-medium">
                            {product.category} · +{product.pointsReward} pts ·{' '}
                            {product.stock > 0 ? `${product.stock} in stock` : 'Sold out'}
                          </p>
                          <div className="flex items-baseline justify-between gap-2">
                            <h3 className="font-editorial text-xl text-[#111111]">
                              {product.name}
                            </h3>
                            <span className="font-mono text-sm font-semibold text-[#111111] tabular-nums shrink-0">
                              {product.priceTnd} TND
                            </span>
                          </div>
                          <p className="text-xs text-[#5C5953] line-clamp-2 leading-relaxed">
                            {product.description}
                          </p>
                        </div>
                      </div>

                      <div className="px-5 pb-5 pt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setInspectProduct(product)}
                          className="flex-1 py-2.5 border border-[#E6E1D6] text-xs font-semibold uppercase tracking-wider hover:border-[#111111] transition-colors"
                        >
                          3D View &amp; Fit
                        </button>
                        <button
                          type="button"
                          disabled={product.stock <= 0}
                          onClick={() => handleAddToCart(product)}
                          className="flex-1 py-2.5 bg-[#111111] text-[#F9F7F2] text-xs font-semibold uppercase tracking-wider hover:bg-[#2A2825] disabled:opacity-40 transition-colors"
                        >
                          {product.stock > 0 ? 'Add to Bag' : 'Sold Out'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* LOYALTY 10-PT REWARDS + LIVE PARCEL TRACKING + KAIROUAN BOUTIQUE MAP */}
            <div className="border-t border-[#E6E1D6] bg-[#F3EFE6]">
              <LoyaltyTrackingSection
                initialOrderCode={recentOrderCode}
                onQuotaDetected={() => setQuotaBanner(true)}
              />
            </div>
        </>
      </main>

      {/* Footer */}
      <footer className="bg-[#111111] text-[#D7D2C8] border-t border-white/10 py-10 px-4 sm:px-6 lg:px-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-xs">
          <div>
            <p className="font-editorial text-xl tracking-[0.14em] text-white">GENTLEMAN</p>
            <p className="text-white/60 mt-1">
              Centre Ville, Kairouan 3100, Tunisia · Personalized WhatsApp Confirmations &amp; Nationwide Courier
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <a
              href="https://maps.app.goo.gl/kNZD5xJUovHBy7aP6"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#C5A059] hover:underline"
            >
              Google Maps Storefront
            </a>
            <button
              type="button"
              onClick={() => setStylistOpen(true)}
              className="hover:text-white"
            >
              Personal Stylist
            </button>
            <a
              href="/owner"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  navigateTo('/owner');
                }
              }}
              className="text-white/45 hover:text-[#C5A059] border-l border-white/15 pl-6 transition-colors"
            >
              Seller Portal
            </a>
          </div>
        </div>
      </footer>

      {/* Floating Concierge Launch Button (desktop only; mobile uses prominent hero & footer triggers) */}
      {!stylistOpen && !cartOpen && (
        <button
          type="button"
          onClick={() => setStylistOpen(true)}
          className="hidden md:inline-flex fixed bottom-5 right-5 z-30 items-center gap-2 px-4 py-2.5 bg-[#111111] text-[#F9F7F2] border border-[#C5A059] text-xs font-semibold uppercase tracking-wider shadow-xl hover:bg-[#1E1E22]"
          aria-label="Open Atelier Personal Stylist"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>Stylist</span>
        </button>
      )}

      {/* Quick-View 3D Garment Inspector */}
      <ProductModal3D
        product={inspectProduct}
        onClose={() => setInspectProduct(null)}
        onAddToCart={(product, size, color) => handleAddToCart(product, size, color)}
      />

      {/* Slide-Over Shopping Bag & WhatsApp Checkout */}
      <CartCheckoutDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        onUpdateQty={(idx, delta) => {
          setCartItems((prev) =>
            prev
              .map((item, i) => (i === idx ? { ...item, quantity: item.quantity + delta } : item))
              .filter((item) => item.quantity > 0)
          );
        }}
        onRemoveItem={(idx) => {
          setCartItems((prev) => prev.filter((_, i) => i !== idx));
        }}
        onClearCart={() => setCartItems([])}
        onOrderSuccess={(code) => {
          setRecentOrderCode(code);
          loadProducts();
        }}
        onJumpToTrack={(code) => {
          setRecentOrderCode(code);
          navigateToSection('track-rewards');
        }}
      />

      {/* AI Personal Stylist & Live Voice Concierge */}
      <StylistDrawer open={stylistOpen} onClose={() => setStylistOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StorefrontShell />
    </AuthProvider>
  );
}
