import React, { useState } from 'react';
import { Globe, Mail, MapPin, Phone, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { CATEGORY_DISPLAY_NAMES, PRODUCT_CATEGORIES } from '../types';
import { NovaCartLogo } from './NovaCartLogo';

type FooterTopic = 'about' | 'shipping' | 'returns' | 'privacy' | 'terms';

const TOPIC_CONTENT: Record<FooterTopic, { title: string; body: string[] }> = {
  about: {
    title: 'About NovaCart',
    body: [
      'NovaCart ("Everything you love. One place.") is a modern Indian marketplace curating design-led electronics, tailored apparel, sculptural homeware, clean beauty, everyday accessories, and performance sports equipment.',
      'Every product in our 96+ SKU catalog ships with direct manufacturer warranties, transparent INR pricing, and verified customer reviews.',
    ],
  },
  shipping: {
    title: 'Shipping & Express Delivery Policy',
    body: [
      'Orders placed before 2:00 PM IST are dispatched within 24 hours from our Bengaluru and Mumbai fulfillment centers. Typical doorstep delivery takes 3–5 business days across India.',
      'Orders above ₹2,999 qualify for complimentary express shipping automatically (or apply code FREESHIP at checkout).',
    ],
  },
  returns: {
    title: '7-Day Hassle-Free Returns',
    body: [
      'Unused items in original packaging with intact tags may be returned or exchanged within 7 days of delivery via complimentary doorstep pickup.',
      'Refunds for online Razorpay transactions are credited back to the original payment method within 3–5 business days after quality inspection.',
    ],
  },
  privacy: {
    title: 'Privacy & Data Security',
    body: [
      'Customer profiles, saved shipping addresses, and private order ledgers are isolated per authenticated account using Firebase Authentication and strict Cloud Firestore security rules.',
      'NovaCart never stores UPI PINs, ATM PINs, card CVVs, or net-banking credentials. Online payments are processed solely by Razorpay with server-side HMAC-SHA256 verification.',
    ],
  },
  terms: {
    title: 'Terms of Service',
    body: [
      'All listed product prices are in Indian Rupees (INR) and inclusive of applicable GST.',
      'Promotional codes and member offers are validated server-side against live expiry dates and single-use rules prior to final order placement.',
    ],
  },
};

export function Footer() {
  const { navigateTo, setSelectedCategory, setCartDrawerOpen } = useStore();
  const [activeTopic, setActiveTopic] = useState<FooterTopic | null>(null);

  return (
    <footer className="bg-[#141416] text-white border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-white/10">
          {/* Brand & Contact */}
          <div className="lg:col-span-4 space-y-4">
            <NovaCartLogo variant="dark" size="lg" />
            <p className="text-sm text-white/70 max-w-xs leading-relaxed">
              Everything you love. One place. Curated electronics, fashion, homeware, beauty,
              accessories, and athletic essentials.
            </p>
            <div className="space-y-1.5 text-xs text-white/70 pt-1">
              <p className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#F97316]" />
                <span>support@novacart.in</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#F97316]" />
                <span>+91 80 4123 8890 (Mon–Sat, 9 AM – 7 PM)</span>
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#F97316]" />
                <span>Indiranagar, Bengaluru 560038</span>
              </p>
            </div>
          </div>

          {/* 6 Shopping Categories */}
          <div className="lg:col-span-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-4">
              Departments
            </h3>
            <ul className="space-y-2.5 text-sm text-white/80">
              {PRODUCT_CATEGORIES.map((category) => (
                <li key={category}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory(category);
                      navigateTo('catalog');
                    }}
                    className="hover:text-[#F97316] transition-colors cursor-pointer text-left"
                  >
                    {CATEGORY_DISPLAY_NAMES[category]}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Account & Orders */}
          <div className="lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-4">
              Account
            </h3>
            <ul className="space-y-2.5 text-sm text-white/80">
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo('catalog')}
                  className="hover:text-[#F97316] transition-colors cursor-pointer"
                >
                  Full Catalog
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setCartDrawerOpen(true)}
                  className="hover:text-[#F97316] transition-colors cursor-pointer"
                >
                  Shopping Bag
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo('wishlist')}
                  className="hover:text-[#F97316] transition-colors cursor-pointer"
                >
                  Saved Wishlist
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo('orders')}
                  className="hover:text-[#F97316] transition-colors cursor-pointer"
                >
                  Track Orders
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo('offers')}
                  className="hover:text-[#F97316] transition-colors cursor-pointer"
                >
                  Promotional Offers
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo('profile')}
                  className="hover:text-[#F97316] transition-colors cursor-pointer"
                >
                  Saved Profile
                </button>
              </li>
            </ul>
          </div>

          {/* Policies & Social */}
          <div className="lg:col-span-3 space-y-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-4">
                Support & Policies
              </h3>
              <ul className="space-y-2.5 text-sm text-white/80">
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveTopic('about')}
                    className="hover:text-[#F97316] transition-colors cursor-pointer"
                  >
                    About NovaCart
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveTopic('shipping')}
                    className="hover:text-[#F97316] transition-colors cursor-pointer"
                  >
                    Shipping & Delivery
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveTopic('returns')}
                    className="hover:text-[#F97316] transition-colors cursor-pointer"
                  >
                    7-Day Returns Policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveTopic('privacy')}
                    className="hover:text-[#F97316] transition-colors cursor-pointer"
                  >
                    Privacy & Payments Security
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveTopic('terms')}
                    className="hover:text-[#F97316] transition-colors cursor-pointer"
                  >
                    Terms of Service
                  </button>
                </li>
              </ul>
            </div>

            <div className="flex items-center gap-3 text-xs text-white/70">
              <Globe className="w-4 h-4 text-[#F97316]" />
              <span>@novacart.in · Instagram · X · LinkedIn</span>
            </div>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/55">
          <p>© {new Date().getFullYear()} NovaCart Marketplace. All rights reserved.</p>
          <p>Free express delivery across India on orders over ₹2,999</p>
        </div>
      </div>

      {/* Policy / Info Modal */}
      {activeTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-[#141416]">
          <div
            className="fixed inset-0 bg-black/55 backdrop-blur-[2px]"
            onClick={() => setActiveTopic(null)}
          />
          <div className="relative z-10 w-full max-w-lg bg-white border border-black/10 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display text-xl font-bold text-[#141416]">
                {TOPIC_CONTENT[activeTopic].title}
              </h2>
              <button
                type="button"
                onClick={() => setActiveTopic(null)}
                aria-label="Close information dialog"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5C5B57] hover:bg-black/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-[#5C5B57] leading-relaxed">
              {TOPIC_CONTENT[activeTopic].body.map((para, idx) => (
                <p key={idx}>{para}</p>
              ))}
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveTopic(null)}
                className="px-5 py-2 rounded-lg bg-[#141416] text-white text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
