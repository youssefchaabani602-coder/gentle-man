import React, { useEffect, useState } from 'react';
import { Box, Image as ImageIcon, ShoppingBag, X } from 'lucide-react';
import type { ProductColorOption, ProductRecord } from '../types';
import { resolveProductImage } from '../data/catalogMedia';
import { ThreeGarmentStage } from './ThreeGarmentStage';

interface ProductModal3DProps {
  product: ProductRecord | null;
  onClose: () => void;
  onAddToCart: (product: ProductRecord, size: string, color: string) => void;
}

export function ProductModal3D({ product, onClose, onAddToCart }: ProductModal3DProps) {
  const [viewMode, setViewMode] = useState<'3d' | 'photo'>('3d');
  const [selectedSize, setSelectedSize] = useState<string>('M');
  const [selectedColor, setSelectedColor] = useState<ProductColorOption>({
    name: 'Obsidian',
    hex: '#181B22',
  });

  useEffect(() => {
    if (!product) return;
    try {
      const sizes = JSON.parse(product.sizesJson) as string[];
      if (sizes.length > 0) setSelectedSize(sizes[0]);
    } catch {
      setSelectedSize('M');
    }
    try {
      const colors = JSON.parse(product.colorsJson) as ProductColorOption[];
      if (colors.length > 0) setSelectedColor(colors[0]);
    } catch {
      setSelectedColor({ name: 'Obsidian', hex: '#181B22' });
    }
    setViewMode('3d');
  }, [product]);

  if (!product) return null;

  let sizes: string[] = ['S', 'M', 'L', 'XL'];
  let colors: ProductColorOption[] = [{ name: 'Obsidian', hex: '#181B22' }];
  try {
    sizes = JSON.parse(product.sizesJson) as string[];
  } catch {
    // default
  }
  try {
    colors = JSON.parse(product.colorsJson) as ProductColorOption[];
  } catch {
    // default
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0E1014]/75"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <div className="relative w-full max-w-4xl bg-[#F9F7F2] border border-[#D8D1C4] shadow-2xl grid grid-cols-1 md:grid-cols-12 overflow-hidden max-h-[92vh]">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2 bg-white border border-[#E6E1D6] text-[#111111] hover:border-[#111111]"
          aria-label="Close product preview"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Left: 3D Stage or Studio Photo */}
        <div className="md:col-span-7 relative bg-[#15181F] min-h-[340px] md:min-h-[480px] flex flex-col">
          <div className="flex-1 relative">
            {viewMode === '3d' ? (
              <ThreeGarmentStage
                mode="inspector"
                garmentType={product.garmentType}
                colorHex={selectedColor.hex}
                garmentLabel={product.name}
                showHeroDock={false}
              />
            ) : (
              <img
                src={resolveProductImage(product.imageKey)}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            )}
          </div>

          <div
            className="flex items-center justify-between px-4 py-2.5 border-t border-white/10 text-xs text-white/80"
            style={{ backgroundColor: '#111318' }}
          >
            <span>{viewMode === '3d' ? 'Drag to rotate 3D silhouette' : 'Atelier Studio Photograph'}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMode('3d')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 border ${
                  viewMode === '3d'
                    ? 'bg-[#C5A059] text-[#111111] border-[#C5A059] font-semibold'
                    : 'border-white/20 text-white/80'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>3D Model</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('photo')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 border ${
                  viewMode === 'photo'
                    ? 'bg-[#C5A059] text-[#111111] border-[#C5A059] font-semibold'
                    : 'border-white/20 text-white/80'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Photo</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Tailoring Details & Purchase Controls */}
        <div className="md:col-span-5 p-6 md:p-8 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B6B2E] font-medium">
                {product.category} · +{product.pointsReward} Loyalty Pts ·{' '}
                {product.stock > 0 ? `${product.stock} in stock` : 'Sold out'}
              </p>
              <h3 className="font-editorial text-2xl md:text-3xl text-[#111111] mt-1.5">
                {product.name}
              </h3>
              <p className="text-xl font-semibold text-[#111111] tabular-nums mt-2">
                {product.priceTnd} TND
              </p>
            </div>

            <p className="text-sm text-[#5C5953] leading-relaxed border-t border-[#E6E1D6] pt-4">
              {product.description}
            </p>

            {/* Color Swatches */}
            <div>
              <p className="text-xs uppercase tracking-wider text-[#5C5953] mb-2">
                Fabric Tone: <span className="text-[#111111] font-medium">{selectedColor.name}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => {
                  const active = c.name === selectedColor.name;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`inline-flex items-center gap-2 px-2.5 py-1.5 text-xs border transition-colors ${
                        active
                          ? 'border-[#111111] bg-white font-semibold'
                          : 'border-[#E6E1D6] bg-transparent hover:border-[#8B6B2E]'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 border border-black/20"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Size Selection */}
            <div>
              <p className="text-xs uppercase tracking-wider text-[#5C5953] mb-2">Size</p>
              <div className="grid grid-cols-4 gap-2">
                {sizes.map((size) => {
                  const active = size === selectedSize;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`py-2 text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-[#111111] text-[#F9F7F2] border-[#111111]'
                          : 'bg-white text-[#111111] border-[#E6E1D6] hover:border-[#111111]'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-[#E6E1D6] space-y-2.5">
            <button
              type="button"
              disabled={product.stock <= 0}
              onClick={() => {
                onAddToCart(product, selectedSize, selectedColor.name);
                onClose();
              }}
              className="w-full py-3.5 bg-[#111111] text-[#F9F7F2] text-xs font-semibold uppercase tracking-[0.16em] inline-flex items-center justify-center gap-2 hover:bg-[#2A2825] disabled:opacity-40 transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{product.stock > 0 ? 'Add to Shopping Bag' : 'Out of Stock'}</span>
            </button>
            <p className="text-[11px] text-[#5C5953] text-center">
              Collect 10 points to unlock a 10% discount code on your next purchase.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
