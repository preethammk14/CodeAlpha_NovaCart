import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Percent, RotateCcw, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { CATEGORY_DISPLAY_NAMES, PRODUCT_CATEGORIES, type ProductCategory } from '../types';
import { ProductCard } from './ProductCard';

type SortOption =
  | 'featured'
  | 'popularity'
  | 'newest'
  | 'price-asc'
  | 'price-desc'
  | 'rating'
  | 'discount';
type PriceRangeOption = 'all' | 'under-2500' | '2500-7500' | '7500-15000' | 'above-15000';
type RatingFilterOption = 'all' | '4.5' | '4.8' | '4.9';
type DiscountFilterOption = 'all' | '10' | '15' | '20';

const PAGE_SIZE = 12;

export function CatalogView() {
  const {
    products,
    productsLoading,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
  } = useStore();

  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [priceRange, setPriceRange] = useState<PriceRangeOption>('all');
  const [minRating, setMinRating] = useState<RatingFilterOption>('all');
  const [minDiscount, setMinDiscount] = useState<DiscountFilterOption>('all');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [onlyOffers, setOnlyOffers] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedCategory, searchQuery, sortBy, priceRange, minRating, minDiscount, inStockOnly, onlyOffers]);

  const hasActiveFilters =
    selectedCategory !== 'All' ||
    searchQuery.trim() !== '' ||
    priceRange !== 'all' ||
    minRating !== 'all' ||
    minDiscount !== 'all' ||
    inStockOnly ||
    onlyOffers ||
    sortBy !== 'featured';

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: products.length };
    for (const cat of PRODUCT_CATEGORIES) {
      counts[cat] = products.filter((p) => p.category === cat).length;
    }
    return counts;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = products.filter((p) => {
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
      if (onlyOffers && !p.specialOffer && p.discountPercent < 15) return false;
      if (inStockOnly && p.stock <= 0) return false;

      if (priceRange === 'under-2500' && p.price >= 2500) return false;
      if (priceRange === '2500-7500' && (p.price < 2500 || p.price > 7500)) return false;
      if (priceRange === '7500-15000' && (p.price < 7500 || p.price > 15000)) return false;
      if (priceRange === 'above-15000' && p.price <= 15000) return false;

      if (minRating === '4.5' && p.rating < 4.5) return false;
      if (minRating === '4.8' && p.rating < 4.8) return false;
      if (minRating === '4.9' && p.rating < 4.9) return false;

      if (minDiscount === '10' && p.discountPercent < 10) return false;
      if (minDiscount === '15' && p.discountPercent < 15) return false;
      if (minDiscount === '20' && p.discountPercent < 20) return false;

      if (q) {
        const displayCat = CATEGORY_DISPLAY_NAMES[p.category] || p.category;
        const hay = `${p.title} ${p.brand} ${p.category} ${displayCat} ${p.subCategory || ''} ${p.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    switch (sortBy) {
      case 'popularity':
        return [...list].sort(
          (a, b) => b.reviewCount - a.reviewCount || Number(b.bestSeller) - Number(a.bestSeller)
        );
      case 'newest':
        return [...list].sort(
          (a, b) =>
            Number(Boolean(b.isNew)) - Number(Boolean(a.isNew)) ||
            (b.createdOrder || 0) - (a.createdOrder || 0)
        );
      case 'price-asc':
        return [...list].sort((a, b) => a.price - b.price);
      case 'price-desc':
        return [...list].sort((a, b) => b.price - a.price);
      case 'rating':
        return [...list].sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
      case 'discount':
        return [...list].sort((a, b) => b.discountPercent - a.discountPercent);
      default:
        return [...list].sort(
          (a, b) => Number(b.featured) - Number(a.featured) || Number(b.bestSeller) - Number(a.bestSeller)
        );
    }
  }, [
    products,
    selectedCategory,
    searchQuery,
    sortBy,
    priceRange,
    minRating,
    minDiscount,
    inStockOnly,
    onlyOffers,
  ]);

  const displayedProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  );

  const categories: Array<ProductCategory | 'All'> = ['All', ...PRODUCT_CATEGORIES];

  const resetFilters = () => {
    setSelectedCategory('All');
    setSearchQuery('');
    setSortBy('featured');
    setPriceRange('all');
    setMinRating('all');
    setMinDiscount('all');
    setInStockOnly(false);
    setOnlyOffers(false);
    setVisibleCount(PAGE_SIZE);
  };

  const headingLabel =
    selectedCategory === 'All'
      ? 'All Departments'
      : CATEGORY_DISPLAY_NAMES[selectedCategory] || selectedCategory;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8 border-b border-black/8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#EA580C] mb-1.5">
            Marketplace Catalog · {products.length} Curated Products
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#141416]">
            {headingLabel}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm text-[#5C5B57] tabular-nums">
            Showing{' '}
            <span className="font-semibold text-[#141416]">{displayedProducts.length}</span> of{' '}
            <span className="font-semibold text-[#141416]">{filteredProducts.length}</span>{' '}
            matching products
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#EA580C] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Sort Controls */}
      <div className="py-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#5C5B57] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search laptops, hoodies, cookware, perfume, cricket..."
              className="w-full pl-10 pr-9 py-2.5 rounded-lg bg-white border border-black/12 text-sm text-[#141416] focus:outline-none focus:border-[#F97316]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search query"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#5C5B57] hover:text-[#141416] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-black/12">
              <label htmlFor="price-filter" className="text-xs text-[#5C5B57] whitespace-nowrap">
                Price:
              </label>
              <select
                id="price-filter"
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value as PriceRangeOption)}
                className="text-xs font-semibold text-[#141416] bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="all">All Prices</option>
                <option value="under-2500">Under ₹2,500</option>
                <option value="2500-7500">₹2,500 – ₹7,500</option>
                <option value="7500-15000">₹7,500 – ₹15,000</option>
                <option value="above-15000">Above ₹15,000</option>
              </select>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-black/12">
              <Star className="w-3.5 h-3.5 text-[#F97316] fill-[#F97316]" />
              <label htmlFor="rating-filter" className="sr-only">
                Minimum rating
              </label>
              <select
                id="rating-filter"
                value={minRating}
                onChange={(e) => setMinRating(e.target.value as RatingFilterOption)}
                className="text-xs font-semibold text-[#141416] bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="all">All Ratings</option>
                <option value="4.5">4.5★ & above</option>
                <option value="4.8">4.8★ & above</option>
                <option value="4.9">4.9★ Top Rated</option>
              </select>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-black/12">
              <Percent className="w-3.5 h-3.5 text-[#EA580C]" />
              <label htmlFor="discount-filter" className="sr-only">
                Minimum discount
              </label>
              <select
                id="discount-filter"
                value={minDiscount}
                onChange={(e) => setMinDiscount(e.target.value as DiscountFilterOption)}
                className="text-xs font-semibold text-[#141416] bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="all">Any Discount</option>
                <option value="10">10% Off & more</option>
                <option value="15">15% Off & more</option>
                <option value="20">20% Off & more</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setInStockOnly((prev) => !prev)}
              className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                inStockOnly
                  ? 'bg-[#141416] text-white border-[#141416]'
                  : 'bg-white text-[#141416] border-black/12 hover:bg-[#F3EFE9]'
              }`}
            >
              In Stock Only
            </button>

            <button
              type="button"
              onClick={() => setOnlyOffers((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                onlyOffers
                  ? 'bg-[#F97316] text-white border-[#F97316]'
                  : 'bg-white text-[#141416] border-black/12 hover:bg-[#F3EFE9]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Offers</span>
            </button>

            <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-black/12">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#5C5B57]" />
              <label htmlFor="catalog-sort" className="sr-only">
                Sort products
              </label>
              <select
                id="catalog-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="text-xs font-semibold text-[#141416] bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="featured">Sort: Featured</option>
                <option value="popularity">Sort: Popularity</option>
                <option value="newest">Sort: New Arrivals</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
                <option value="discount">Biggest Discount</option>
              </select>
            </div>
          </div>
        </div>

        {/* Interactive Department Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            const label = cat === 'All' ? 'All Departments' : CATEGORY_DISPLAY_NAMES[cat];
            const count = categoryCounts[cat] ?? 0;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
                  active
                    ? 'bg-[#141416] text-white'
                    : 'bg-[#F3EFE9] text-[#5C5B57] hover:text-[#141416]'
                }`}
              >
                <span>{label}</span>
                <span className={`tabular-nums text-[10px] ${active ? 'text-white/75' : 'text-[#5C5B57]'}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {productsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7 pt-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="bg-white border border-black/8 rounded-xl overflow-hidden">
              <div className="aspect-[4/3] bg-[#F3EFE9] animate-pulse" />
              <div className="p-5 space-y-3">
                <div className="h-3 w-28 bg-[#F3EFE9] rounded animate-pulse" />
                <div className="h-5 w-3/4 bg-[#F3EFE9] rounded animate-pulse" />
                <div className="h-8 w-full bg-[#F3EFE9] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white border border-black/8 rounded-2xl p-12 text-center my-8">
          <h2 className="font-display text-xl font-semibold text-[#141416] mb-2">
            No matching products found
          </h2>
          <p className="text-sm text-[#5C5B57] mb-6">
            Try widening your price range, clearing search keywords, or switching back to all
            departments.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#141416] text-white text-sm font-medium hover:bg-[#27272A] cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Clear All Filters</span>
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7 pt-2">
            {displayedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {filteredProducts.length > visibleCount && (
            <div className="mt-12 flex flex-col items-center gap-3">
              <p className="text-xs text-[#5C5B57] tabular-nums">
                Displaying {displayedProducts.length} of {filteredProducts.length} products
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                  className="px-6 py-3 rounded-lg bg-[#141416] hover:bg-[#27272A] text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  Load {Math.min(PAGE_SIZE, filteredProducts.length - visibleCount)} More Products
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleCount(filteredProducts.length)}
                  className="px-5 py-3 rounded-lg border border-black/15 bg-white hover:bg-[#F3EFE9] text-[#141416] text-sm font-semibold transition-colors cursor-pointer"
                >
                  Show All ({filteredProducts.length})
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
