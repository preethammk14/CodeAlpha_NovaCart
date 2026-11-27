import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Heart,
  Minus,
  Plus,
  ShoppingBag,
  Star,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatINR } from '../lib/format';
import { CATEGORY_DISPLAY_NAMES } from '../types';
import { ProductImage } from './ProductImage';

export function QuickViewModal() {
  const {
    products,
    quickViewProductId,
    setQuickViewProductId,
    openProduct,
    addToCart,
    isInWishlist,
    toggleWishlist,
  } = useStore();

  const [qty, setQty] = useState(1);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const product = useMemo(
    () => products.find((p) => p.id === quickViewProductId) || null,
    [products, quickViewProductId]
  );

  useEffect(() => {
    setQty(1);
    setActiveImageIdx(0);
  }, [quickViewProductId]);

  useEffect(() => {
    if (!quickViewProductId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQuickViewProductId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [quickViewProductId, setQuickViewProductId]);

  if (!product) return null;

  const images = Array.from(
    new Set([product.imageUrl, ...(product.gallery || [])].filter(Boolean))
  );
  const activeImage = images[activeImageIdx] || product.imageUrl;
  const outOfStock = product.stock <= 0;
  const saved = isInWishlist(product.id);
  const categoryLabel = CATEGORY_DISPLAY_NAMES[product.category] || product.category;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Quick view: ${product.title}`}
    >
      <div
        className="fixed inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={() => setQuickViewProductId(null)}
      />

      <div className="relative z-10 w-full max-w-3xl bg-white border border-black/10 rounded-2xl overflow-hidden shadow-2xl grid grid-cols-1 md:grid-cols-12 max-h-[90vh]">
        <button
          type="button"
          onClick={() => setQuickViewProductId(null)}
          aria-label="Close quick view"
          className="absolute top-3.5 right-3.5 z-20 w-9 h-9 rounded-lg bg-white/95 border border-black/10 flex items-center justify-center text-[#141416] hover:bg-[#F3EFE9] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="md:col-span-6 bg-[#F3EFE9] p-4 flex flex-col justify-between gap-3">
          <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-white border border-black/6">
            <ProductImage src={activeImage} alt={product.title} loading="eager" />
          </div>

          {images.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {images.map((imgUrl, idx) => (
                <button
                  key={`${imgUrl}-${idx}`}
                  type="button"
                  onClick={() => setActiveImageIdx(idx)}
                  className={`w-14 h-12 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer ${
                    activeImageIdx === idx ? 'border-[#F97316]' : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                >
                  <ProductImage
                    src={imgUrl}
                    alt={`${product.title} angle ${idx + 1}`}
                    fallbackTitle={product.title}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="md:col-span-6 p-6 sm:p-7 overflow-y-auto flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-[#5C5B57] pr-8">
              <span className="uppercase tracking-wider font-semibold text-[#EA580C]">
                {product.brand}
              </span>
              <span aria-hidden="true">·</span>
              <span>{categoryLabel}</span>
              {product.subCategory && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{product.subCategory}</span>
                </>
              )}
            </div>

            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#141416] leading-snug">
              {product.title}
            </h2>

            <div className="flex items-center gap-2.5 text-xs tabular-nums">
              <span className="inline-flex items-center gap-1 font-semibold text-[#141416]">
                <Star className="w-3.5 h-3.5 fill-[#F97316] text-[#F97316]" />
                {product.rating.toFixed(1)}
              </span>
              <span className="text-[#5C5B57]">({product.reviewCount} reviews)</span>
              <span className="text-[#5C5B57]">·</span>
              <span className={outOfStock ? 'text-red-600 font-semibold' : 'text-emerald-700 font-semibold'}>
                {outOfStock ? 'Out of Stock' : `${product.stock} in stock`}
              </span>
            </div>

            <div className="flex items-baseline gap-2.5 pt-1 tabular-nums flex-wrap">
              <span className="font-display text-2xl font-bold text-[#141416]">
                {formatINR(product.price)}
              </span>
              {product.originalPrice > product.price && (
                <span className="text-sm text-[#5C5B57] line-through">
                  {formatINR(product.originalPrice)}
                </span>
              )}
              {product.discountPercent > 0 && (
                <span className="text-xs font-semibold text-[#EA580C]">
                  {product.discountPercent}% OFF
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-[#5C5B57] leading-relaxed">
              {product.description}
            </p>

            {product.specs.length > 0 && (
              <ul className="space-y-1.5 pt-1">
                {product.specs.slice(0, 4).map((spec) => (
                  <li key={spec} className="flex items-center gap-2 text-xs text-[#5C5B57]">
                    <Check className="w-3.5 h-3.5 text-[#F97316] shrink-0" />
                    <span>{spec}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 pt-3 border-t border-black/8">
            <div className="flex items-center gap-2.5">
              <div className="inline-flex items-center border border-black/12 rounded-lg bg-[#FAF8F5]">
                <button
                  type="button"
                  disabled={qty <= 1 || outOfStock}
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="w-9 h-10 flex items-center justify-center text-[#141416] hover:bg-black/5 disabled:opacity-40 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-8 text-center text-xs font-semibold tabular-nums">{qty}</span>
                <button
                  type="button"
                  disabled={qty >= product.stock || outOfStock}
                  onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                  aria-label="Increase quantity"
                  className="w-9 h-10 flex items-center justify-center text-[#141416] hover:bg-black/5 disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                disabled={outOfStock}
                onClick={() => {
                  addToCart(product.id, qty);
                  setQuickViewProductId(null);
                }}
                className="flex-1 h-10 px-4 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-45 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{outOfStock ? 'Out of Stock' : 'Add to Bag'}</span>
              </button>

              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
                className="w-10 h-10 rounded-lg border border-black/15 flex items-center justify-center hover:bg-[#F3EFE9] cursor-pointer"
              >
                <Heart className={`w-4 h-4 ${saved ? 'fill-[#F97316] text-[#F97316]' : 'text-[#141416]'}`} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => openProduct(product.id)}
              className="w-full py-2.5 px-4 rounded-lg bg-[#141416] hover:bg-[#27272A] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>View Full Product Details & Reviews</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
