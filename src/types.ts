export type ProductCategory =
  | 'Electronics'
  | 'Fashion'
  | 'Home'
  | 'Beauty'
  | 'Accessories'
  | 'Sports';

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Electronics',
  'Fashion',
  'Home',
  'Beauty',
  'Accessories',
  'Sports',
];

export const CATEGORY_DISPLAY_NAMES: Record<ProductCategory, string> = {
  Electronics: 'Electronics',
  Fashion: 'Fashion',
  Home: 'Home & Living',
  Beauty: 'Beauty',
  Accessories: 'Accessories',
  Sports: 'Sports & Fitness',
};

export interface Product {
  id: string;
  title: string;
  brand: string;
  category: ProductCategory;
  subCategory?: string;
  description: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  rating: number;
  reviewCount: number;
  stock: number;
  imageUrl: string;
  gallery?: string[];
  featured: boolean;
  bestSeller: boolean;
  specialOffer: boolean;
  isNew?: boolean;
  createdOrder?: number;
  specs: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProductReview {
  id: string;
  productId: string;
  userId: string;
  authorName: string;
  rating: number;
  title: string;
  comment: string;
  createdAt?: unknown;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface SavedAddress {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  isDefault: boolean;
  updatedAt?: unknown;
}

export interface UserProfileData {
  uid: string;
  displayName: string;
  role: 'customer' | 'admin';
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface CustomerAccountRecord {
  uid: string;
  displayName: string;
  role: 'customer' | 'admin';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod =
  | 'cod'
  | 'upi'
  | 'gpay'
  | 'phonepe'
  | 'paytm'
  | 'netbanking'
  | 'debit_card'
  | 'credit_card';

export type PaymentStatus = 'pay_on_delivery' | 'paid' | 'pending_verification' | 'failed';

export interface OrderLineItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
  imageUrl: string;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentStatus;
  paymentGateway?: 'cod' | 'razorpay';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  estimatedDelivery?: string;
  promoCode?: string;
  items: OrderLineItem[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  status: OrderStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type OfferStatus = 'Active' | 'Expired' | 'Cancelled';
export type OfferDiscountType = 'percentage' | 'fixed' | 'free_shipping';

export interface OfferRecord {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: OfferDiscountType;
  discountValue: number;
  maxDiscount: number;
  minOrderAmount: number;
  oneTimeUse: boolean;
  status: OfferStatus;
  expiresAt?: string;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type OfferRedemptionStatus = 'Redeemed' | 'Cancelled';

export interface OfferRedemptionRecord {
  id: string;
  offerId: string;
  offerCode: string;
  offerTitle: string;
  discountType: OfferDiscountType;
  discountValue: number;
  discountApplied: number;
  userId: string;
  customerName: string;
  customerEmail: string;
  orderId: string;
  orderNumber: string;
  orderTotal: number;
  status: OfferRedemptionStatus;
  redeemedAt?: unknown;
  updatedAt?: unknown;
}

export type AppView =
  | 'home'
  | 'catalog'
  | 'product'
  | 'wishlist'
  | 'checkout'
  | 'orders'
  | 'profile'
  | 'offers'
  | 'signin'
  | 'signup'
  | 'forgot-password'
  | 'admin';
