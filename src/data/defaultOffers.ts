import type { OfferRecord, OfferStatus } from '../types';
import { formatINR } from '../lib/format';

export const DEFAULT_STARTER_OFFERS: OfferRecord[] = [
  {
    id: 'NOVA10',
    code: 'NOVA10',
    title: 'Member 10% Storewide Privilege',
    description: '10% off orders ₹1,000+ (up to ₹2,500) across all 6 departments.',
    discountType: 'percentage',
    discountValue: 10,
    maxDiscount: 2500,
    minOrderAmount: 1000,
    oneTimeUse: false,
    status: 'Active',
  },
  {
    id: 'WELCOME15',
    code: 'WELCOME15',
    title: 'Welcome 15% Signature Savings',
    description: '15% off first large order ₹5,000+ (up to ₹4,000, one-time per customer).',
    discountType: 'percentage',
    discountValue: 15,
    maxDiscount: 4000,
    minOrderAmount: 5000,
    oneTimeUse: true,
    status: 'Active',
  },
  {
    id: 'FREESHIP',
    code: 'FREESHIP',
    title: 'Complimentary Express Delivery',
    description: 'Waives the ₹149 express courier fee on any eligible order.',
    discountType: 'free_shipping',
    discountValue: 0,
    maxDiscount: 149,
    minOrderAmount: 0,
    oneTimeUse: false,
    status: 'Active',
  },
];

export function isOfferDateExpired(expiresAt?: string): boolean {
  if (!expiresAt || !expiresAt.trim()) return false;
  const trimmed = expiresAt.trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T23:59:59.999Z`)
    : new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return false;
  return Date.now() > parsed.getTime();
}

export function computeEffectiveOfferStatus(offer: OfferRecord): OfferStatus {
  if (offer.status === 'Cancelled') return 'Cancelled';
  if (offer.status === 'Expired' || isOfferDateExpired(offer.expiresAt)) return 'Expired';
  return 'Active';
}

export function formatOfferBenefit(offer: OfferRecord): string {
  if (offer.discountType === 'free_shipping') {
    return 'Free Express Shipping';
  }
  if (offer.discountType === 'fixed') {
    return `Flat ${formatINR(offer.discountValue)} OFF`;
  }
  return offer.maxDiscount > 0
    ? `${offer.discountValue}% OFF (up to ${formatINR(offer.maxDiscount)})`
    : `${offer.discountValue}% OFF`;
}
