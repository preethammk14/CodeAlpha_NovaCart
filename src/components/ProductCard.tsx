import React from 'react';
import { Eye, Heart, Plus, Star } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatINR } from '../lib/format';
import { CATEGORY_DISPLAY_NAMES, type Product } from '../types';
import { ProductImage } from './ProductImage';

export function ProductCard({ product }: { product: Product }) {
  const { openProduct, addToCart, isInWishlist, toggleWishlist, setQuickViewProductId } =
    useStore();

  const outOfStock = product.stock <= 0;
  const saved = isInWishlist(product.id);
  const categoryLabel = CATEGORY_DISPLAY_NAMES[product.category] || product.category;

  return (
    <article className="group bg-white border border-black/8 rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] w-full bg-[#F3EFE9] overflow-hidden">
        <button
          type="button"
          onClick={() => openProduct(product.id)}
          className="w-full h-full text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#F97316]"
        >
          <ProductImage
            src={product.imageUrl}
            alt={product.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </button>

        {outOfStock ? (
          <span className="pointer-events-none absolute top-3 left-3 bg-[#141416]/85 text-white text-[11px] font-medium px-2 py-0.5 rounded">
            Out of Stock
          </span>
        ) : product.discountPercent > 0 ? (
          <span className="pointer-events-none absolute top-3 left-3 bg-[#141416] text-white text-[11px] font-medium px-2 py-0.5 rounded tabular-nums">
            {product.discountPercent}% Off
          </span>
        ) : product.isNew ? (
          <span className="pointer-events-none absolute top-3 left-3 bg-[#F97316] text-white text-[11px] font-medium px-2 py-0.5 rounded">
            New
          </span>
        ) : null}

        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => toggleWishlist(product.id)}
            aria-label={saved ? `Remove ${product.title} from wishlist` : `Save ${product.title} to wishlist`}
            className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur-sm border border-black/10 flex items-center justify-center text-[#141416] hover:bg-white transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#F97316]"
          >
            <Heart className={`w-4 h-4 ${saved ? 'fill-[#F97316] text-[#F97316]' : 'text-[#141416]'}`} />
          </button>

          <button
            type="button"
            onClick={() => setQuickViewProductId(product.id)}
            aria-label={`Quick view ${product.title}`}
            className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur-sm border border-black/10 flex items-center justify-center text-[#141416] hover:bg-white transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#F97316]"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2 text-xs text-[#5C5B57] mb-1.5">
          <div className="flex items-center gap-1.5 truncate">
            <span className="uppercase tracking-wider font-medium">{product.brand}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{categoryLabel}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0 tabular-nums text-[#141416] font-medium">
            <Star className="w-3.5 h-3.5 fill-[#F97316] text-[#F97316]" />
            <span>{product.rating.toFixed(1)}</span>
            <span className="text-[11px] text-[#5C5B57]">({product.reviewCount})</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openProduct(product.id)}
          className="text-left text-base font-semibold text-[#141416] leading-snug mb-3 hover:text-[#EA580C] transition-colors line-clamp-2 cursor-pointer"
        >
          {product.title}
        </button>

        <div className="mt-auto pt-3 border-t border-black/6 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-[16px] font-bold text-[#141416]">{formatINR(product.price)}</span>
            {product.originalPrice > product.price && (
              <span className="text-xs text-[#5C5B57] line-through">
                {formatINR(product.originalPrice)}
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={outOfStock}
            onClick={() => addToCart(product.id, 1)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#F3EFE9] text-[#141416] hover:bg-[#F97316] hover:text-white disabled:opacity-45 disabled:hover:bg-[#F3EFE9] disabled:hover:text-[#141416] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{outOfStock ? 'Sold Out' : 'Add'}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
