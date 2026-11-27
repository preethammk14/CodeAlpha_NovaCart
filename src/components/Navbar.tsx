import React, { useState } from 'react';
import { Heart, Menu, Search, ShieldCheck, ShoppingBag, User, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type { AppView } from '../types';
import { NovaCartLogo } from './NovaCartLogo';

export function Navbar() {
  const {
    view,
    navigateTo,
    cartCount,
    wishlistCount,
    setCartDrawerOpen,
    user,
    emailVerified,
    isAdmin,
    searchQuery,
    setSearchQuery,
  } = useStore();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const navItems: Array<{ id: AppView; label: string }> = [
    { id: 'home', label: 'Home' },
    { id: 'catalog', label: 'Catalog' },
    { id: 'offers', label: 'Offers' },
    { id: 'orders', label: 'Orders' },
    { id: 'profile', label: 'Profile' },
  ];

  if (isAdmin && emailVerified) {
    navItems.push({ id: 'admin', label: 'Admin' });
  }

  const handleNav = (target: AppView) => {
    navigateTo(target);
    setMobileMenuOpen(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateTo('catalog');
    setSearchOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-black/8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Custom NovaCart SVG logo lockup */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          aria-label="NovaCart Home"
          className="whitespace-nowrap shrink-0 cursor-pointer hover:opacity-85 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F97316]"
        >
          <NovaCartLogo variant="light" size="md" />
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#5C5B57]">
          {navItems.map((item) => {
            const active = view === item.id || (item.id === 'catalog' && view === 'product');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F97316] ${
                  active ? 'text-[#141416] font-semibold' : 'hover:text-[#141416]'
                }`}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 right-0 -bottom-[1px] h-[2px] bg-[#F97316]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Action controls (Search, Wishlist, Account, Bag) */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setSearchOpen((prev) => !prev)}
            aria-label="Search catalog"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-[#141416] hover:bg-black/5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#F97316]"
          >
            <Search className="w-[18px] h-[18px]" />
          </button>

          <button
            type="button"
            onClick={() => handleNav('wishlist')}
            aria-label={`Open wishlist with ${wishlistCount} saved items`}
            className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#F97316] ${
              view === 'wishlist' ? 'bg-[#F3EFE9] text-[#EA580C]' : 'text-[#141416] hover:bg-black/5'
            }`}
          >
            <Heart className={`w-[18px] h-[18px] ${view === 'wishlist' ? 'fill-[#F97316] text-[#F97316]' : ''}`} />
            {wishlistCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#141416] text-white text-[10px] font-mono font-semibold flex items-center justify-center tabular-nums">
                {wishlistCount}
              </span>
            )}
          </button>

          {user ? (
            <button
              type="button"
              onClick={() => handleNav(isAdmin && emailVerified ? 'admin' : 'profile')}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[#141416] border border-black/10 bg-white hover:bg-[#F3EFE9] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#F97316]"
            >
              {isAdmin && emailVerified ? (
                <ShieldCheck className="w-3.5 h-3.5 text-[#EA580C]" />
              ) : (
                <User className="w-3.5 h-3.5 text-[#5C5B57]" />
              )}
              <span className="max-w-[110px] truncate">
                {user.displayName || user.email?.split('@')[0] || 'Account'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleNav('signin')}
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-[#141416] border border-black/10 bg-white hover:bg-[#F3EFE9] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#F97316]"
            >
              Sign In
            </button>
          )}

          <button
            type="button"
            onClick={() => setCartDrawerOpen(true)}
            aria-label={`Open shopping cart with ${cartCount} items`}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#141416] text-white text-xs font-semibold hover:bg-[#27272A] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316]"
          >
            <ShoppingBag className="w-4 h-4 text-[#F97316]" />
            <span>Bag</span>
            <span className="tabular-nums font-mono text-[11px] bg-[#F97316] text-white px-1.5 py-0.5 rounded">
              {cartCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            className="md:hidden w-10 h-10 rounded-lg flex items-center justify-center text-[#141416] hover:bg-black/5 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Expandable quick search bar */}
      {searchOpen && (
        <div className="border-t border-black/8 bg-white">
          <form
            onSubmit={handleSearchSubmit}
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3"
          >
            <Search className="w-4 h-4 text-[#5C5B57] shrink-0" />
            <input
              type="search"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search smartphones, hoodies, cookware, perfume, watches, cricket..."
              className="w-full text-sm text-[#141416] placeholder:text-[#5C5B57]/70 bg-transparent focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[#F97316] text-white text-xs font-semibold hover:bg-[#EA580C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              aria-label="Close search"
              className="p-1.5 text-[#5C5B57] hover:text-[#141416] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Mobile navigation drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-black/8 bg-white px-4 py-4 space-y-1.5">
          {navItems.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active ? 'bg-[#F3EFE9] text-[#141416] font-semibold' : 'text-[#5C5B57] hover:bg-black/5'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => handleNav('wishlist')}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between transition-colors cursor-pointer ${
              view === 'wishlist' ? 'bg-[#F3EFE9] text-[#141416] font-semibold' : 'text-[#5C5B57] hover:bg-black/5'
            }`}
          >
            <span>Wishlist</span>
            <span className="font-mono text-xs tabular-nums">{wishlistCount}</span>
          </button>
          {!user && (
            <div className="pt-1 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleNav('signin')}
                className="px-3 py-2.5 rounded-lg border border-black/15 text-xs font-semibold text-[#141416] hover:bg-[#F3EFE9] cursor-pointer"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => handleNav('signup')}
                className="px-3 py-2.5 rounded-lg bg-[#F97316] text-white text-xs font-semibold hover:bg-[#EA580C] cursor-pointer"
              >
                Create Account
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
