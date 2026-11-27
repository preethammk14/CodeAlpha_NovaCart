import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Heart,
  MessageSquarePlus,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatINR, formatOrderDate } from '../lib/format';
import { CATEGORY_DISPLAY_NAMES } from '../types';
import { EmailVerificationInlineBanner } from './EmailVerificationGate';
import { ProductCard } from './ProductCard';
import { ProductImage } from './ProductImage';

export function ProductDetailView() {
  const {
    products,
    selectedProductId,
    navigateTo,
    addToCart,
    setCartDrawerOpen,
    isInWishlist,
    toggleWishlist,
    recentlyViewedIds,
    productReviews,
    submitProductReview,
    user,
    emailVerified,
    isAdmin,
    setAuthModalOpen,
    showToast,
  } = useStore();

  const [qty, setQty] = useState(1);
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const product = useMemo(
    () => products.find((p) => p.id === selectedProductId) || products[0],
    [products, selectedProductId]
  );

  useEffect(() => {
    setQty(1);
    setActiveImgIdx(0);
  }, [product?.id]);

  const galleryImages = useMemo(() => {
    if (!product) return [];
    return Array.from(new Set([product.imageUrl, ...(product.gallery || [])].filter(Boolean)));
  }, [product]);

  const liveReviews = useMemo(() => {
    if (!product) return [];
    return productReviews.filter((r) => r.productId === product.id);
  }, [productReviews, product]);

  const related = useMemo(() => {
    if (!product) return [];
    return products
      .filter((p) => p.category === product.category && p.id !== product.id)
      .slice(0, 3);
  }, [products, product]);

  const recentlyViewedProducts = useMemo(() => {
    if (!product) return [];
    return recentlyViewedIds
      .filter((id) => id !== product.id)
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .slice(0, 3);
  }, [recentlyViewedIds, products, product]);

  if (!product) return null;

  const outOfStock = product.stock <= 0;
  const savings = Math.max(0, product.originalPrice - product.price);
  const wishlisted = isInWishlist(product.id);
  const categoryLabel = CATEGORY_DISPLAY_NAMES[product.category] || product.category;
  const totalReviewCount = product.reviewCount + liveReviews.length;

  const handleBuyNow = () => {
    addToCart(product.id, qty);
    setCartDrawerOpen(false);
    navigateTo('checkout');
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (!emailVerified && !isAdmin) {
      showToast('Please verify your email address before submitting a review.', 'error');
      return;
    }
    setReviewSubmitting(true);
    try {
      await submitProductReview({
        productId: product.id,
        rating: reviewRating,
        title: reviewTitle,
        comment: reviewComment,
      });
      setReviewTitle('');
      setReviewComment('');
      setReviewRating(5);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to post review.', 'error');
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
      <button
        type="button"
        onClick={() => navigateTo('catalog')}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#5C5B57] hover:text-[#141416] mb-8 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Catalog</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-7 lg:sticky lg:top-24 space-y-3">
          <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#F3EFE9] border border-black/8">
            <ProductImage
              src={galleryImages[activeImgIdx] || product.imageUrl}
              alt={product.title}
              loading="eager"
            />
          </div>

          {galleryImages.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              {galleryImages.map((imgUrl, idx) => (
                <button
                  key={`${imgUrl}-${idx}`}
                  type="button"
                  onClick={() => setActiveImgIdx(idx)}
                  className={`w-20 h-16 rounded-xl overflow-hidden border-2 shrink-0 bg-[#F3EFE9] transition-all cursor-pointer ${
                    activeImgIdx === idx
                      ? 'border-[#F97316] shadow-sm'
                      : 'border-black/8 opacity-75 hover:opacity-100'
                  }`}
                >
                  <ProductImage
                    src={imgUrl}
                    alt={`${product.title} view ${idx + 1}`}
                    fallbackTitle={product.title}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-black/8 rounded-2xl p-6 sm:p-8 space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C5B57] mb-2">
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

            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#141416] leading-tight mb-3">
              {product.title}
            </h1>

            <div className="flex items-center gap-3 text-sm tabular-nums">
              <div className="inline-flex items-center gap-1 font-semibold text-[#141416]">
                <Star className="w-4 h-4 fill-[#F97316] text-[#F97316]" />
                <span>{product.rating.toFixed(1)}</span>
              </div>
              <span className="text-[#5C5B57]">·</span>
              <span className="text-[#5C5B57]">{totalReviewCount} verified reviews</span>
            </div>
          </div>

          <div className="py-4 border-y border-black/8 space-y-1">
            <div className="flex items-baseline gap-3 tabular-nums flex-wrap">
              <span className="font-display text-3xl font-bold text-[#141416]">
                {formatINR(product.price)}
              </span>
              {product.originalPrice > product.price && (
                <span className="text-base text-[#5C5B57] line-through">
                  {formatINR(product.originalPrice)}
                </span>
              )}
              {product.discountPercent > 0 && (
                <span className="text-xs font-semibold text-[#EA580C]">
                  Save {product.discountPercent}% ({formatINR(savings)})
                </span>
              )}
            </div>
            <p className="text-xs text-[#5C5B57]">Inclusive of all taxes · Free delivery over ₹2,999</p>
          </div>

          <p className="text-sm text-[#5C5B57] leading-relaxed">{product.description}</p>

          {product.specs.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#141416] mb-2.5">
                Key Specifications
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {product.specs.map((spec) => (
                  <li key={spec} className="flex items-center gap-2 text-xs text-[#5C5B57]">
                    <Check className="w-3.5 h-3.5 text-[#F97316] shrink-0" />
                    <span>{spec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#141416]">
                Availability:{' '}
                <span className={outOfStock ? 'text-red-600' : 'text-emerald-700'}>
                  {outOfStock ? 'Out of Stock' : `In Stock (${product.stock} units available)`}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="inline-flex items-center border border-black/12 rounded-lg bg-[#FAF8F5]">
                <button
                  type="button"
                  disabled={qty <= 1 || outOfStock}
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="w-10 h-11 flex items-center justify-center text-[#141416] hover:bg-black/5 disabled:opacity-40 cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center text-sm font-semibold tabular-nums">{qty}</span>
                <button
                  type="button"
                  disabled={qty >= product.stock || outOfStock}
                  onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                  aria-label="Increase quantity"
                  className="w-10 h-11 flex items-center justify-center text-[#141416] hover:bg-black/5 disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                disabled={outOfStock}
                onClick={() => addToCart(product.id, qty)}
                className="flex-1 h-11 px-5 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{outOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={outOfStock}
                onClick={handleBuyNow}
                className="h-11 px-4 rounded-lg bg-[#141416] hover:bg-[#27272A] text-white text-sm font-semibold transition-colors disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
              >
                Buy Now
              </button>

              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                className={`h-11 px-4 rounded-lg border text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  wishlisted
                    ? 'border-[#F97316] bg-[#F97316]/8 text-[#EA580C]'
                    : 'border-black/15 bg-white hover:bg-[#F3EFE9] text-[#141416]'
                }`}
              >
                <Heart className={`w-4 h-4 ${wishlisted ? 'fill-[#F97316] text-[#F97316]' : ''}`} />
                <span>{wishlisted ? 'Saved' : 'Add to Wishlist'}</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-black/8 grid grid-cols-2 gap-3 text-xs text-[#5C5B57]">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#141416] shrink-0" />
              <span>Dispatched in 24 hours</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#141416] shrink-0" />
              <span>1-Year Brand Warranty</span>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Reviews & Ratings */}
      <section className="mt-16 pt-12 border-t border-black/8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 bg-white border border-black/8 rounded-2xl p-6 sm:p-7 space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#EA580C] mb-1">
              Customer Feedback
            </p>
            <h2 className="font-display text-2xl font-bold text-[#141416]">Ratings & Reviews</h2>
            <div className="flex items-center gap-3 mt-3">
              <span className="font-display text-4xl font-bold text-[#141416] tabular-nums">
                {product.rating.toFixed(1)}
              </span>
              <div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= Math.round(product.rating)
                          ? 'fill-[#F97316] text-[#F97316]'
                          : 'text-black/15'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-[#5C5B57] mt-0.5 tabular-nums">
                  Based on {totalReviewCount} customer ratings
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleReviewSubmit} className="pt-4 border-t border-black/8 space-y-3.5">
            <h3 className="text-sm font-semibold text-[#141416] flex items-center gap-2">
              <MessageSquarePlus className="w-4 h-4 text-[#F97316]" />
              <span>Write a Product Review</span>
            </h3>

            <div>
              <label className="block text-xs text-[#5C5B57] mb-1">Your Rating</label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setReviewRating(val)}
                    aria-label={`Rate ${val} out of 5 stars`}
                    className="p-1 cursor-pointer"
                  >
                    <Star
                      className={`w-5 h-5 transition-colors ${
                        val <= reviewRating
                          ? 'fill-[#F97316] text-[#F97316]'
                          : 'text-black/20 hover:text-[#F97316]'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#141416] mb-1">Headline</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                placeholder="Great build quality and fast shipping"
                className="w-full px-3.5 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-xs focus:bg-white focus:outline-none focus:border-[#F97316]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#141416] mb-1">Review</label>
              <textarea
                required
                minLength={5}
                maxLength={800}
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share what you liked about comfort, materials, or performance..."
                className="w-full px-3.5 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-xs focus:bg-white focus:outline-none focus:border-[#F97316]"
              />
            </div>

            {!user ? (
              <button
                type="button"
                onClick={() => navigateTo('signin')}
                className="w-full py-2.5 px-4 rounded-lg border border-black/15 bg-white hover:bg-[#F3EFE9] text-[#141416] text-xs font-semibold cursor-pointer"
              >
                Sign In to Submit Review
              </button>
            ) : !emailVerified && !isAdmin ? (
              <EmailVerificationInlineBanner actionLabel="submit a product review" />
            ) : (
              <button
                type="submit"
                disabled={reviewSubmitting}
                className="w-full py-2.5 px-4 rounded-lg bg-[#141416] hover:bg-[#27272A] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
              >
                {reviewSubmitting ? 'Publishing Review...' : 'Submit Review'}
              </button>
            )}
          </form>
        </div>

        <div className="lg:col-span-7 space-y-4">
          {liveReviews.length === 0 ? (
            <div className="bg-white border border-black/8 rounded-2xl p-8 text-center space-y-2">
              <p className="font-display text-lg font-semibold text-[#141416]">
                Be the first customer to review this edition
              </p>
              <p className="text-xs text-[#5C5B57] max-w-md mx-auto leading-relaxed">
                This product holds an overall {product.rating.toFixed(1)}★ rating across{' '}
                {product.reviewCount} verified buyer ratings. Share your hands-on feedback using the
                form.
              </p>
            </div>
          ) : (
            liveReviews.map((review) => (
              <article
                key={review.id}
                className="bg-white border border-black/8 rounded-2xl p-6 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3.5 h-3.5 ${
                          star <= review.rating
                            ? 'fill-[#F97316] text-[#F97316]'
                            : 'text-black/15'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-[#5C5B57]">
                    {formatOrderDate(review.createdAt)}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#141416]">{review.title}</h3>
                <p className="text-xs sm:text-sm text-[#5C5B57] leading-relaxed">
                  {review.comment}
                </p>
                <p className="text-[11px] font-medium text-[#141416]">
                  Verified Shopper · {review.authorName}
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-16 pt-12 border-t border-black/8">
          <h2 className="font-display text-2xl font-bold text-[#141416] mb-6">
            More in {categoryLabel}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}

      {recentlyViewedProducts.length > 0 && (
        <section className="mt-16 pt-12 border-t border-black/8">
          <h2 className="font-display text-2xl font-bold text-[#141416] mb-6">
            Recently Viewed
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
            {recentlyViewedProducts.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
