import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  Sparkles,
  Tag,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { computeEffectiveOfferStatus, formatOfferBenefit } from '../data/defaultOffers';
import { formatINR, formatOrderDate, formatOrderDateTime } from '../lib/format';

export function OffersView() {
  const {
    offers,
    offerRedemptions,
    user,
    emailVerified,
    isAdmin,
    cart,
    navigateTo,
    showToast,
  } = useStore();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const activeOffers = useMemo(
    () => offers.filter((offer) => computeEffectiveOfferStatus(offer) === 'Active'),
    [offers]
  );

  const redeemedCodeSet = useMemo(() => {
    const set = new Set<string>();
    for (const r of offerRedemptions) {
      if (r.status !== 'Cancelled') {
        set.add(r.offerCode.toUpperCase());
      }
    }
    return set;
  }, [offerRedemptions]);

  const handleCopyCode = (code: string) => {
    void navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    showToast(`Promo code ${code} copied to clipboard`);
    window.setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-20 space-y-12">
      <div className="bg-[#141416] text-white rounded-2xl p-8 sm:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2.5 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#F97316] inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>NovaCart Member Privileges</span>
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight">
            Active Promotional Offers &amp; Coupons
          </h1>
          <p className="text-sm text-white/75 leading-relaxed">
            Copy any active privilege code below and apply it at checkout. All discounts and
            one-time eligibility checks are validated live on our server prior to order placement.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigateTo(cart.length > 0 ? 'checkout' : 'catalog')}
          className="px-6 py-3 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 self-start lg:self-center cursor-pointer"
        >
          <span>{cart.length > 0 ? 'Go to Checkout' : 'Shop Catalog'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {activeOffers.length === 0 ? (
        <div className="bg-white border border-black/8 rounded-2xl p-12 text-center space-y-3">
          <Tag className="w-8 h-8 text-[#5C5B57] mx-auto" />
          <h2 className="font-display text-xl font-bold text-[#141416]">
            No active promotional campaigns right now
          </h2>
          <p className="text-sm text-[#5C5B57]">
            Check back soon for seasonal offers, or enjoy complimentary express shipping on orders
            over ₹2,999.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeOffers.map((offer) => {
            const alreadyRedeemed = offer.oneTimeUse && redeemedCodeSet.has(offer.code.toUpperCase());
            return (
              <article
                key={offer.id}
                className="bg-white border border-black/8 rounded-2xl p-6 flex flex-col justify-between gap-5 shadow-xs"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-[#EA580C] bg-[#F97316]/10 px-3 py-1 rounded-md">
                      {offer.code}
                    </span>
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                      {formatOfferBenefit(offer)}
                    </span>
                  </div>

                  <div>
                    <h2 className="font-display text-lg font-bold text-[#141416]">{offer.title}</h2>
                    <p className="text-xs text-[#5C5B57] mt-1 leading-relaxed">
                      {offer.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-black/6 space-y-1.5 text-xs text-[#5C5B57]">
                    <p className="flex items-center justify-between">
                      <span>Minimum order</span>
                      <span className="font-semibold text-[#141416] tabular-nums">
                        {offer.minOrderAmount > 0 ? formatINR(offer.minOrderAmount) : 'No minimum'}
                      </span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>Usage limit</span>
                      <span className="font-semibold text-[#141416]">
                        {offer.oneTimeUse ? 'One-time per customer' : 'Multiple orders'}
                      </span>
                    </p>
                    {offer.expiresAt && (
                      <p className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="w-3.5 h-3.5" />
                          <span>Valid until</span>
                        </span>
                        <span className="font-semibold text-[#141416]">
                          {formatOrderDate(offer.expiresAt)}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {alreadyRedeemed ? (
                  <div className="p-3 rounded-lg bg-[#F3EFE9] text-xs font-semibold text-[#5C5B57] flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>Already Redeemed on Your Account</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleCopyCode(offer.code)}
                      className="flex-1 py-2.5 px-3 rounded-lg border border-black/15 bg-[#FAF8F5] hover:bg-[#F3EFE9] text-[#141416] text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedCode === offer.code ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#EA580C]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleCopyCode(offer.code);
                        navigateTo(cart.length > 0 ? 'checkout' : 'catalog');
                      }}
                      className="py-2.5 px-4 rounded-lg bg-[#141416] hover:bg-[#27272A] text-white text-xs font-semibold cursor-pointer"
                    >
                      {cart.length > 0 ? 'Apply at Checkout' : 'Shop Now'}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {user && (emailVerified || isAdmin) && (
        <section className="bg-white border border-black/8 rounded-2xl p-6 sm:p-8 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#EA580C] mb-1">
              Your Savings Ledger
            </p>
            <h2 className="font-display text-xl font-bold text-[#141416]">
              Your Redeemed Offers ({offerRedemptions.length})
            </h2>
          </div>

          {offerRedemptions.length === 0 ? (
            <p className="text-xs text-[#5C5B57]">
              You haven&apos;t redeemed a promotional offer code on an order yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-black/8 text-[11px] uppercase tracking-wider text-[#5C5B57]">
                    <th className="py-2.5 pr-4">Offer Code</th>
                    <th className="py-2.5 px-4">Order</th>
                    <th className="py-2.5 px-4">Savings</th>
                    <th className="py-2.5 px-4">Date &amp; Time</th>
                    <th className="py-2.5 pl-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6">
                  {offerRedemptions.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-4">
                        <span className="font-mono font-bold text-[#141416]">{item.offerCode}</span>
                        <span className="block text-[11px] text-[#5C5B57]">{item.offerTitle}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[#141416]">{item.orderNumber}</td>
                      <td className="py-3 px-4 font-semibold text-emerald-700 tabular-nums">
                        {item.discountApplied > 0
                          ? `-${formatINR(item.discountApplied)}`
                          : 'Free Shipping'}
                      </td>
                      <td className="py-3 px-4 text-[#5C5B57]">
                        {formatOrderDateTime(item.redeemedAt)}
                      </td>
                      <td className="py-3 pl-4 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                            item.status === 'Redeemed'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-neutral-100 text-neutral-600'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
