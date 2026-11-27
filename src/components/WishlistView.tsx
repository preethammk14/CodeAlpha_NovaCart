import React, { useMemo } from 'react';
import { ArrowRight, Heart, ShoppingBag, Trash2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatINR } from '../lib/format';
import { CATEGORY_DISPLAY_NAMES } from '../types';
import { ProductImage } from './ProductImage';

export function WishlistView() {
  const {
    products,
    wishlistIds,
    toggleWishlist,
    moveWishlistToCart,
    openProduct,
    navigateTo,
  } = useStore();

  const savedProducts = useMemo(
    () =>
      wishlistIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [wishlistIds, products]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 border-b border-black/8 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#EA580C] mb-1">
            Saved Collection
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#141416]">
            Your Wishlist
          </h1>
        </div>
        <p className="text-sm text-[#5C5B57] tabular-nums">
          {savedProducts.length} {savedProducts.length === 1 ? 'item' : 'items'} saved
        </p>
      </div>

      {savedProducts.length === 0 ? (
        <div className="bg-white border border-black/8 rounded-2xl p-12 text-center space-y-4 max-w-xl mx-auto my-8">
          <div className="w-14 h-14 rounded-full bg-[#F3EFE9] flex items-center justify-center mx-auto">
            <Heart className="w-6 h-6 text-[#5C5B57]" />
          </div>
          <h2 className="font-display text-xl font-semibold text-[#141416]">
            Your wishlist is empty
          </h2>
          <p className="text-sm text-[#5C5B57]">
            Tap the heart icon on any product to save favorites and move them to your bag whenever
            you are ready.
          </p>
          <button
            type="button"
            onClick={() => navigateTo('catalog')}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            <span>Explore Catalog</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {savedProducts.map((product) => {
            const outOfStock = product.stock <= 0;
            return (
              <article
                key={product.id}
                className="bg-white border border-black/8 rounded-xl overflow-hidden flex flex-col"
              >
                <button
                  type="button"
                  onClick={() => openProduct(product.id)}
                  className="aspect-[4/3] w-full bg-[#F3EFE9] overflow-hidden cursor-pointer"
                >
                  <ProductImage
                    src={product.imageUrl}
                    alt={product.title}
                    className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-300"
                  />
                </button>

                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center justify-between text-xs text-[#5C5B57] mb-1">
                    <span className="uppercase tracking-wider font-medium">
                      {product.brand} · {CATEGORY_DISPLAY_NAMES[product.category]}
                    </span>
                    <span className={outOfStock ? 'text-red-600 font-medium' : 'text-emerald-700 font-medium'}>
                      {outOfStock ? 'Out of Stock' : 'In Stock'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => openProduct(product.id)}
                    className="text-left text-base font-semibold text-[#141416] hover:text-[#EA580C] mb-3 cursor-pointer"
                  >
                    {product.title}
                  </button>

                  <div className="flex items-baseline gap-2 tabular-nums mb-4">
                    <span className="text-base font-bold text-[#141416]">
                      {formatINR(product.price)}
                    </span>
                    {product.originalPrice > product.price && (
                      <span className="text-xs text-[#5C5B57] line-through">
                        {formatINR(product.originalPrice)}
                      </span>
                    )}
                  </div>

                  <div className="mt-auto pt-3 border-t border-black/6 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={outOfStock}
                      onClick={() => moveWishlistToCart(product.id)}
                      className="flex-1 py-2.5 px-4 rounded-lg bg-[#141416] hover:bg-[#27272A] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-[#F97316]" />
                      <span>{outOfStock ? 'Unavailable' : 'Move to Cart'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleWishlist(product.id)}
                      aria-label={`Remove ${product.title} from wishlist`}
                      className="p-2.5 rounded-lg border border-black/12 text-[#5C5B57] hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
