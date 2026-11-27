import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  Check,
  Copy,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  Undo2,
  X,
} from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useStore } from '../context/StoreContext';
import { computeEffectiveOfferStatus, formatOfferBenefit } from '../data/defaultOffers';
import { HERO_BANNER_IMAGE } from '../data/seedProducts';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import { CATEGORY_DISPLAY_NAMES, PRODUCT_CATEGORIES, type ProductCategory } from '../types';
import { ProductCard } from './ProductCard';
import { ProductImage } from './ProductImage';

const POPULAR_BRANDS = [
  { name: 'Klang', specialty: 'Studio Audio & Acoustics', category: 'Electronics' as ProductCategory },
  { name: 'Keycraft', specialty: 'Mechanical Keyboards & Mice', category: 'Electronics' as ProductCategory },
  { name: 'Savile', specialty: 'Tailored Outerwear & Suits', category: 'Fashion' as ProductCategory },
  { name: 'Solis', specialty: 'Architectural Lighting & Decor', category: 'Home' as ProductCategory },
  { name: 'Botanica', specialty: 'Clinical Botanical Skincare', category: 'Beauty' as ProductCategory },
  { name: 'Nomad', specialty: 'Chronographs & Travel Carry', category: 'Accessories' as ProductCategory },
  { name: 'Pace', specialty: 'Marathon & Training Footwear', category: 'Sports' as ProductCategory },
  { name: 'Barista', specialty: 'Precision Coffee & Kitchen', category: 'Home' as ProductCategory },
];

const TESTIMONIALS = [
  {
    name: 'Ananya Deshmukh',
    city: 'Pune',
    rating: 5,
    quote:
      'The CNC keyboard and brass desk lamp arrived within 48 hours in spotless packaging. Build quality feels far beyond the price point.',
  },
  {
    name: 'Rohan Kulkarni',
    city: 'Bengaluru',
    rating: 5,
    quote:
      'Ordered running shoes and a gym duffel together. Tracking updates at every stage gave complete peace of mind.',
  },
  {
    name: 'Meera Krishnan',
    city: 'Chennai',
    rating: 5,
    quote:
      'Consistent quality across fashion, skincare, and kitchenware. Customer support helped me swap a hoodie size effortlessly.',
  },
];

export function HomeView() {
  const {
    products,
    offers,
    recentlyViewedIds,
    navigateTo,
    setSelectedCategory,
    setSearchQuery,
    accessDeniedMessage,
    dismissAccessDenied,
    showToast,
  } = useStore();
  const [activeTab, setActiveTab] = useState<'trending' | 'bestsellers' | 'new' | 'deals'>('trending');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);

  const categoryCards = useMemo(() => {
    return PRODUCT_CATEGORIES.map((category: ProductCategory) => {
      const items = products.filter((p) => p.category === category);
      return {
        category,
        displayName: CATEGORY_DISPLAY_NAMES[category] || category,
        count: items.length,
        previewImg: items[0]?.imageUrl || '',
      };
    });
  }, [products]);

  const showcasedProducts = useMemo(() => {
    if (activeTab === 'trending') {
      return products.filter((p) => p.featured).slice(0, 6);
    }
    if (activeTab === 'bestsellers') {
      return products.filter((p) => p.bestSeller).slice(0, 6);
    }
    if (activeTab === 'new') {
      return products
        .filter((p) => p.isNew)
        .sort((a, b) => (b.createdOrder || 0) - (a.createdOrder || 0))
        .slice(0, 6);
    }
    return products
      .filter((p) => p.specialOffer || p.discountPercent >= 18)
      .sort((a, b) => b.discountPercent - a.discountPercent)
      .slice(0, 6);
  }, [products, activeTab]);

  const recentlyViewedProducts = useMemo(() => {
    return recentlyViewedIds
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .slice(0, 3);
  }, [recentlyViewedIds, products]);

  const recommendedProducts = useMemo(() => {
    const recentSet = new Set(recentlyViewedIds);
    return products
      .filter((p) => !recentSet.has(p.id) && p.rating >= 4.8)
      .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
      .slice(0, 3);
  }, [products, recentlyViewedIds]);

  const activeSpecialOffers = useMemo(
    () =>
      offers
        .filter((offer) => computeEffectiveOfferStatus(offer) === 'Active')
        .slice(0, 3),
    [offers]
  );

  const handleCopyCode = (code: string) => {
    void navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    showToast(`Promo code ${code} copied to clipboard`);
    window.setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newsletterEmail.trim().toLowerCase();
    if (!cleaned) return;
    setNewsletterSubmitting(true);

    try {
      const resp = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleaned }),
      });

      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: string };
        showToast(body.error || 'Please enter a valid email address.', 'error');
        return;
      }

      const subscriberId = cleaned.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
      try {
        await setDoc(doc(db, 'newsletter', subscriberId), {
          email: cleaned.slice(0, 200),
          subscribedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `newsletter/${subscriberId}`);
      }

      setNewsletterSuccess(true);
      setNewsletterEmail('');
      showToast('Subscribed to NovaCart seasonal drops.');
    } finally {
      setNewsletterSubmitting(false);
    }
  };

  return (
    <div className="space-y-20 pb-20">
      {accessDeniedMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 -mb-12">
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-900 rounded-xl px-4 py-3.5 flex items-center justify-between gap-4 text-xs sm:text-sm"
          >
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-red-700 shrink-0" />
              <span className="font-medium">{accessDeniedMessage}</span>
            </div>
            <button
              type="button"
              onClick={dismissAccessDenied}
              aria-label="Dismiss access denied notice"
              className="p-1 text-red-700 hover:bg-red-100 rounded-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 1. Storefront Hero Split */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          <div className="lg:col-span-5 flex flex-col justify-center py-2 sm:py-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#EA580C] mb-4">
              NovaCart Marketplace · 2026 Collection
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-[#141416] leading-[1.06] mb-5">
              Everything you love. One place.
            </h1>
            <p className="text-base text-[#5C5B57] leading-relaxed mb-8 max-w-md">
              Discover design-led electronics, tailored apparel, sculptural homeware, botanical
              skincare, fine accessories, and athletic gear curated for everyday longevity.
            </p>
            <div className="flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('All');
                  navigateTo('catalog');
                }}
                className="px-6 py-3.5 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Shop {products.length} Products</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('special-offers');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-5 py-3.5 rounded-lg border border-black/15 bg-white hover:bg-[#F3EFE9] text-[#141416] text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Seasonal Deals
              </button>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="relative h-full min-h-[280px] sm:min-h-[400px] rounded-2xl overflow-hidden bg-[#F3EFE9] border border-black/8">
              <img
                src={HERO_BANNER_IMAGE}
                alt="NovaCart curated collection featuring studio headphones, chronograph watch, botanical serum, and ceramic carafe"
                referrerPolicy="no-referrer"
                className="w-full h-full lg:h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent flex items-end p-6 sm:p-8">
                <div className="text-white flex items-center justify-between w-full gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/80">Season Highlights</p>
                    <p className="font-display text-lg sm:text-xl font-semibold">
                      {products.length} Curated Products Across 6 Departments
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateTo('catalog')}
                    className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-[#141416] text-xs font-semibold hover:bg-[#F3EFE9] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Explore All</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4-column anchor strip below hero */}
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4 border-y border-black/8 py-6">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-[#F97316] shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#141416]">Express Delivery</p>
              <p className="text-xs text-[#5C5B57]">Complimentary over ₹2,999</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-[#F97316] shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#141416]">Verified Quality</p>
              <p className="text-xs text-[#5C5B57]">Direct brand warranties</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Undo2 className="w-5 h-5 text-[#F97316] shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#141416]">7-Day Returns</p>
              <p className="text-xs text-[#5C5B57]">Hassle-free doorstep pickup</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#F97316] shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#141416]">UPI, Cards, NetBanking & COD</p>
              <p className="text-xs text-[#5C5B57]">8 secure payment options</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. 6 Shopping Departments */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#5C5B57] mb-1.5">
              6 Shopping Departments
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#141416]">
              Shop by Category
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('All');
              navigateTo('catalog');
            }}
            className="text-sm font-semibold text-[#141416] hover:text-[#EA580C] inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>All Products</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categoryCards.map(({ category, displayName, count, previewImg }) => (
            <button
              key={category}
              type="button"
              onClick={() => {
                setSelectedCategory(category);
                navigateTo('catalog');
              }}
              className="group bg-white border border-black/8 rounded-xl overflow-hidden text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
            >
              <div className="aspect-[4/3] bg-[#F3EFE9] overflow-hidden">
                <ProductImage
                  src={previewImg}
                  alt={displayName}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-3.5">
                <p className="font-display text-sm font-semibold text-[#141416] group-hover:text-[#EA580C] transition-colors truncate">
                  {displayName}
                </p>
                <p className="text-xs text-[#5C5B57] tabular-nums mt-0.5">{count} items</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 3. Trending, Best Sellers, New Arrivals & Seasonal Deals */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#5C5B57] mb-1.5">
              Curated Selection
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#141416]">
              {activeTab === 'trending'
                ? 'Trending Products'
                : activeTab === 'bestsellers'
                ? 'Best Sellers'
                : activeTab === 'new'
                ? 'New Arrivals'
                : 'Seasonal Deals'}
            </h2>
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-[#F3EFE9] rounded-lg self-start sm:self-auto overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setActiveTab('trending')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'trending'
                  ? 'bg-white text-[#141416] shadow-sm'
                  : 'text-[#5C5B57] hover:text-[#141416]'
              }`}
            >
              Trending
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bestsellers')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'bestsellers'
                  ? 'bg-white text-[#141416] shadow-sm'
                  : 'text-[#5C5B57] hover:text-[#141416]'
              }`}
            >
              Best Sellers
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('new')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'new'
                  ? 'bg-white text-[#141416] shadow-sm'
                  : 'text-[#5C5B57] hover:text-[#141416]'
              }`}
            >
              New Arrivals
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('deals')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'deals'
                  ? 'bg-white text-[#141416] shadow-sm'
                  : 'text-[#5C5B57] hover:text-[#141416]'
              }`}
            >
              Seasonal Deals
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {showcasedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* 4. Recently Viewed & Recommended for You */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {recentlyViewedProducts.length > 0 && (
          <div>
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#EA580C] mb-1">
                  Pick Up Where You Left Off
                </p>
                <h2 className="font-display text-2xl font-bold text-[#141416]">
                  Recently Viewed
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
              {recentlyViewedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#5C5B57] mb-1">
                Highest Customer Ratings
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#141416]">
                Recommended For You
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('catalog')}
              className="text-sm font-semibold text-[#141416] hover:text-[#EA580C] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Browse All</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
            {recommendedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* 5. Popular Brands & Customer Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
        <div>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#5C5B57] mb-1">
              Trusted Houses
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#141416]">
              Popular Brands
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {POPULAR_BRANDS.map((brand) => (
              <button
                key={brand.name}
                type="button"
                onClick={() => {
                  setSelectedCategory(brand.category);
                  setSearchQuery(brand.name);
                  navigateTo('catalog');
                }}
                className="bg-white border border-black/8 rounded-xl p-4 text-left hover:border-[#F97316] transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-display text-base font-bold text-[#141416] group-hover:text-[#EA580C]">
                    {brand.name}
                  </span>
                  <Award className="w-4 h-4 text-[#F97316]" />
                </div>
                <p className="text-xs text-[#5C5B57]">{brand.specialty}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#5C5B57] mb-1">
              Verified Reviews
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#141416]">
              Loved by Shoppers Across India
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((item) => (
              <blockquote
                key={item.name}
                className="bg-white border border-black/8 rounded-2xl p-6 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: item.rating }).map((_, idx) => (
                      <Star key={idx} className="w-3.5 h-3.5 fill-[#F97316] text-[#F97316]" />
                    ))}
                  </div>
                  <p className="text-sm text-[#141416] leading-relaxed">“{item.quote}”</p>
                </div>
                <footer className="text-xs text-[#5C5B57] pt-3 border-t border-black/6">
                  <span className="font-semibold text-[#141416]">{item.name}</span> · {item.city}
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Special Offers Spotlight & Newsletter */}
      <section id="special-offers" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="bg-[#141416] text-white rounded-2xl p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#F97316]">
              Limited Season Privilege
            </p>
            <h2 className="font-display text-2xl sm:text-4xl font-bold leading-tight">
              Save up to 15% on curated electronics, fashion &amp; homeware.
            </h2>
            <p className="text-sm text-white/75 max-w-xl leading-relaxed">
              Apply a member privilege code at checkout for instant savings on orders across every
              department, paired with complimentary shipping over ₹2,999.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigateTo('offers')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>View All Offers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-3">
            {activeSpecialOffers.length === 0 ? (
              <div className="bg-white/8 border border-white/12 rounded-xl p-5 text-xs text-white/80">
                Complimentary express delivery applies automatically to all orders over ₹2,999.
              </div>
            ) : (
              activeSpecialOffers.map((promo) => (
                <div
                  key={promo.id}
                  className="bg-white/8 border border-white/12 rounded-xl p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-semibold text-[#F97316]">{promo.code}</p>
                      <span className="text-[11px] text-white/70 font-medium">
                        {formatOfferBenefit(promo)}
                      </span>
                    </div>
                    <p className="text-xs text-white/75 mt-0.5">{promo.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(promo.code)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {copiedCode === promo.code ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#F97316]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Newsletter */}
        <div className="bg-[#F3EFE9] border border-black/8 rounded-2xl p-8 sm:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-lg">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#141416] mb-1.5">
              First access to new releases & private drops
            </h2>
            <p className="text-sm text-[#5C5B57]">
              Join the NovaCart dispatch for restock alerts and seasonal edits. Zero spam.
            </p>
          </div>

          {newsletterSuccess ? (
            <div className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-white border border-black/10 text-sm font-medium text-[#141416]">
              <Check className="w-4 h-4 text-[#EA580C]" />
              <span>You are subscribed to the NovaCart dispatch.</span>
            </div>
          ) : (
            <form
              onSubmit={handleNewsletterSubmit}
              className="flex flex-col sm:flex-row gap-2.5 w-full lg:w-auto"
            >
              <div className="relative flex-1 sm:w-72">
                <Mail className="w-4 h-4 text-[#5C5B57] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-white border border-black/12 text-sm text-[#141416] focus:outline-none focus:border-[#F97316]"
                />
              </div>
              <button
                type="submit"
                disabled={newsletterSubmitting}
                className="px-5 py-3 rounded-lg bg-[#141416] hover:bg-[#27272A] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                {newsletterSubmitting ? 'Subscribing...' : 'Subscribe'}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
