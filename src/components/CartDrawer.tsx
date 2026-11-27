import React from 'react';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatINR } from '../lib/format';
import { ProductImage } from './ProductImage';

export function CartDrawer() {
  const {
    cart,
    products,
    cartSubtotal,
    cartDrawerOpen,
    setCartDrawerOpen,
    updateCartQty,
    removeFromCart,
    navigateTo,
    openProduct,
  } = useStore();

  if (!cartDrawerOpen) return null;

  const freeShippingThreshold = 2999;
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - cartSubtotal);
  const progressPct = Math.min(100, Math.round((cartSubtotal / freeShippingThreshold) * 100));

  const enrichedItems = cart
    .map((ci) => {
      const product = products.find((p) => p.id === ci.productId);
      return product ? { ...ci, product } : null;
    })
    .filter((x): x is { productId: string; quantity: number; product: NonNullable<typeof x>['product'] } => x !== null);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={() => setCartDrawerOpen(false)}
      />

      <aside
        aria-label="Shopping Bag"
        className="relative z-10 w-full max-w-md bg-[#FAF8F5] h-full flex flex-col border-l border-black/10 shadow-2xl"
      >
        <div className="px-6 py-5 bg-white border-b border-black/8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-[#F97316]" />
            <h2 className="font-display text-lg font-semibold text-[#141416]">Shopping Bag</h2>
          </div>
          <button
            type="button"
            onClick={() => setCartDrawerOpen(false)}
            aria-label="Close shopping bag"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#5C5B57] hover:text-[#141416] hover:bg-black/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {enrichedItems.length > 0 && (
          <div className="px-6 py-3.5 bg-[#F3EFE9] border-b border-black/6">
            <p className="text-xs font-medium text-[#141416] mb-2">
              {remainingForFreeShipping === 0
                ? 'Your order qualifies for complimentary express shipping.'
                : `Add ${formatINR(remainingForFreeShipping)} more for complimentary express shipping.`}
            </p>
            <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#F97316] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {enrichedItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-14 h-14 rounded-full bg-[#F3EFE9] flex items-center justify-center mb-4">
                <ShoppingBag className="w-6 h-6 text-[#5C5B57]" />
              </div>
              <h3 className="font-display text-base font-semibold text-[#141416] mb-1">
                Your bag is empty
              </h3>
              <p className="text-sm text-[#5C5B57] mb-6 max-w-xs">
                Explore curated electronics, tailored apparel, homeware, and everyday essentials.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCartDrawerOpen(false);
                  navigateTo('catalog');
                }}
                className="px-5 py-2.5 rounded-lg bg-[#141416] text-white text-sm font-medium hover:bg-[#27272A] transition-colors cursor-pointer"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            enrichedItems.map(({ product, quantity }) => (
              <div
                key={product.id}
                className="bg-white border border-black/8 rounded-xl p-3.5 flex gap-3.5"
              >
                <button
                  type="button"
                  onClick={() => {
                    setCartDrawerOpen(false);
                    openProduct(product.id);
                  }}
                  className="w-20 h-20 rounded-lg bg-[#F3EFE9] overflow-hidden shrink-0 cursor-pointer"
                >
                  <ProductImage src={product.imageUrl} alt={product.title} />
                </button>

                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCartDrawerOpen(false);
                        openProduct(product.id);
                      }}
                      className="text-left text-sm font-semibold text-[#141416] truncate hover:text-[#EA580C] cursor-pointer"
                    >
                      {product.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromCart(product.id)}
                      aria-label={`Remove ${product.title}`}
                      className="text-[#5C5B57] hover:text-red-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-[#5C5B57] mb-2">
                    {product.brand} · {formatINR(product.price)}
                  </p>

                  <div className="mt-auto flex items-center justify-between">
                    <div className="inline-flex items-center border border-black/10 rounded-lg bg-[#FAF8F5]">
                      <button
                        type="button"
                        onClick={() => updateCartQty(product.id, quantity - 1)}
                        aria-label="Decrease quantity"
                        className="w-7 h-7 flex items-center justify-center text-[#141416] hover:bg-black/5 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-semibold tabular-nums">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        disabled={quantity >= product.stock}
                        onClick={() => updateCartQty(product.id, quantity + 1)}
                        aria-label="Increase quantity"
                        className="w-7 h-7 flex items-center justify-center text-[#141416] hover:bg-black/5 disabled:opacity-40 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <span className="text-sm font-bold text-[#141416] tabular-nums">
                      {formatINR(product.price * quantity)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {enrichedItems.length > 0 && (
          <div className="p-6 bg-white border-t border-black/8 space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-[#5C5B57]">
                <span>Subtotal</span>
                <span className="tabular-nums font-medium text-[#141416]">
                  {formatINR(cartSubtotal)}
                </span>
              </div>
              <div className="flex justify-between text-[#5C5B57]">
                <span>Estimated Shipping</span>
                <span className="tabular-nums font-medium text-[#141416]">
                  {remainingForFreeShipping === 0 ? 'Complimentary' : formatINR(149)}
                </span>
              </div>
              <div className="pt-2 border-t border-black/8 flex justify-between text-base font-bold text-[#141416]">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatINR(cartSubtotal + (remainingForFreeShipping === 0 ? 0 : 149))}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setCartDrawerOpen(false);
                navigateTo('checkout');
              }}
              className="w-full py-3 px-5 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setCartDrawerOpen(false);
                navigateTo('catalog');
              }}
              className="w-full py-2.5 px-5 rounded-lg border border-black/12 bg-white hover:bg-[#F3EFE9] text-[#141416] text-xs font-semibold transition-colors cursor-pointer"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
