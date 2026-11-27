import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, BOOTSTRAPPED_ADMIN_EMAIL, db, googleProvider } from '../lib/firebase';
import { extractReadableError, handleFirestoreError, OperationType } from '../lib/firestoreError';
import { coerceStoredPinCode } from '../lib/pinCode';
import { DEFAULT_STARTER_OFFERS } from '../data/defaultOffers';
import { SEED_PRODUCTS } from '../data/seedProducts';
import type {
  AppView,
  CartItem,
  CustomerAccountRecord,
  OfferDiscountType,
  OfferRecord,
  OfferRedemptionRecord,
  OfferStatus,
  OrderLineItem,
  OrderRecord,
  OrderStatus,
  PaymentMethod,
  Product,
  ProductCategory,
  ProductReview,
  SavedAddress,
  ShippingAddress,
  UserProfileData,
} from '../types';

const LOCAL_CART_KEY = 'novacart_cart_v1';
const LOCAL_WISHLIST_KEY = 'novacart_wishlist_v1';
const LOCAL_RECENT_KEY = 'novacart_recent_v1';

function parsePathToRoute(pathname: string): { view: AppView; productId: string | null } {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/') return { view: 'home', productId: null };
  if (clean === '/catalog') return { view: 'catalog', productId: null };
  if (clean === '/wishlist') return { view: 'wishlist', productId: null };
  if (clean === '/checkout') return { view: 'checkout', productId: null };
  if (clean === '/orders') return { view: 'orders', productId: null };
  if (clean === '/profile') return { view: 'profile', productId: null };
  if (clean === '/offers') return { view: 'offers', productId: null };
  if (clean === '/signin') return { view: 'signin', productId: null };
  if (clean === '/signup') return { view: 'signup', productId: null };
  if (clean === '/forgot-password') return { view: 'forgot-password', productId: null };
  if (clean === '/admin') return { view: 'admin', productId: null };
  if (clean.startsWith('/product/')) {
    const rawId = clean.slice('/product/'.length);
    try {
      const decoded = decodeURIComponent(rawId);
      if (decoded) return { view: 'product', productId: decoded };
    } catch {
      if (rawId) return { view: 'product', productId: rawId };
    }
  }
  return { view: 'home', productId: null };
}

function routeToPath(nextView: AppView, productId?: string | null): string {
  switch (nextView) {
    case 'home':
      return '/';
    case 'catalog':
      return '/catalog';
    case 'product':
      return productId ? `/product/${encodeURIComponent(productId)}` : '/catalog';
    case 'wishlist':
      return '/wishlist';
    case 'checkout':
      return '/checkout';
    case 'orders':
      return '/orders';
    case 'profile':
      return '/profile';
    case 'offers':
      return '/offers';
    case 'signin':
      return '/signin';
    case 'signup':
      return '/signup';
    case 'forgot-password':
      return '/forgot-password';
    case 'admin':
      return '/admin';
  }
}

export interface CheckoutInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  promoCode?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
}

interface StoreContextValue {
  view: AppView;
  navigateTo: (view: AppView, options?: { replace?: boolean }) => void;
  selectedCategory: ProductCategory | 'All';
  setSelectedCategory: (cat: ProductCategory | 'All') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedProductId: string | null;
  openProduct: (id: string) => void;

  quickViewProductId: string | null;
  setQuickViewProductId: (id: string | null) => void;

  trackedOrderId: string | null;
  setTrackedOrderId: (id: string | null) => void;
  openOrderTracking: (orderId: string) => void;

  products: Product[];
  productsLoading: boolean;
  isUsingSeedCatalog: boolean;
  unsyncedSeedCount: number;
  recentlyViewedIds: string[];

  productReviews: ProductReview[];
  submitProductReview: (input: {
    productId: string;
    rating: number;
    title: string;
    comment: string;
  }) => Promise<void>;

  user: User | null;
  authReady: boolean;
  emailVerified: boolean;
  adminCheckDone: boolean;
  isAdmin: boolean;
  accessDeniedMessage: string | null;
  dismissAccessDenied: () => void;
  userProfile: UserProfileData | null;
  savedAddresses: SavedAddress[];
  totalCustomers: number;
  customersList: CustomerAccountRecord[];
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshAuthVerification: () => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfileInfo: (data: {
    displayName: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
  }) => Promise<void>;
  saveAddress: (address: Omit<SavedAddress, 'id' | 'updatedAt'> & { id?: string }) => Promise<SavedAddress>;
  deleteAddress: (addressId: string) => Promise<void>;
  setDefaultAddress: (addressId: string) => Promise<void>;

  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  addToCart: (productId: string, qty?: number) => void;
  updateCartQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => Promise<void>;

  wishlistIds: string[];
  wishlistCount: number;
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (productId: string) => void;
  moveWishlistToCart: (productId: string) => void;

  orders: OrderRecord[];
  ordersLoading: boolean;
  placeOrder: (input: CheckoutInput) => Promise<OrderRecord>;
  cancelOrder: (orderId: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;

  offers: OfferRecord[];
  hasFirestoreOffers: boolean;
  offerRedemptions: OfferRedemptionRecord[];
  seedDefaultOffers: () => Promise<void>;
  saveOffer: (
    offer: Omit<OfferRecord, 'createdAt' | 'updatedAt' | 'createdBy'>,
    isNew: boolean
  ) => Promise<void>;
  toggleOfferStatus: (offerId: string, nextStatus: OfferStatus) => Promise<void>;
  deleteOffer: (offerId: string) => Promise<void>;

  seedCatalogToFirestore: () => Promise<void>;
  saveProduct: (product: Omit<Product, 'createdAt' | 'updatedAt'>, isNew: boolean) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  adjustProductStock: (productId: string, newStock: number) => Promise<void>;

  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function readLocalCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is CartItem =>
          Boolean(item) &&
          typeof item.productId === 'string' &&
          item.productId.length > 0 &&
          typeof item.quantity === 'number' &&
          Number.isInteger(item.quantity) &&
          item.quantity >= 1 &&
          item.quantity <= 99
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}

function readLocalIdList(storageKey: string, maxItems: number): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed.filter((id): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id))
      )
    ).slice(0, maxItems);
  } catch {
    return [];
  }
}

function sanitizeProductForFirestore(product: Omit<Product, 'createdAt' | 'updatedAt'>) {
  const payload: Record<string, unknown> = {
    id: product.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128),
    title: product.title.trim().slice(0, 140),
    brand: product.brand.trim().slice(0, 60),
    category: product.category,
    description: product.description.trim().slice(0, 1200),
    price: Math.max(1, Math.round(product.price)),
    originalPrice: Math.max(Math.round(product.price), Math.round(product.originalPrice)),
    discountPercent: Math.min(90, Math.max(0, Math.round(product.discountPercent))),
    rating: Math.min(5, Math.max(0, Number(product.rating.toFixed(1)))),
    reviewCount: Math.max(0, Math.round(product.reviewCount)),
    stock: Math.max(0, Math.round(product.stock)),
    imageUrl: product.imageUrl.trim().slice(0, 500),
    featured: Boolean(product.featured),
    bestSeller: Boolean(product.bestSeller),
    specialOffer: Boolean(product.specialOffer),
    specs: product.specs.map((s) => s.trim().slice(0, 120)).filter(Boolean).slice(0, 8),
  };

  if (product.subCategory && product.subCategory.trim()) {
    payload.subCategory = product.subCategory.trim().slice(0, 60);
  }
  if (Array.isArray(product.gallery) && product.gallery.length > 0) {
    payload.gallery = product.gallery.map((g) => g.trim().slice(0, 500)).filter(Boolean).slice(0, 6);
  }
  if (typeof product.isNew === 'boolean') {
    payload.isNew = product.isNew;
  }
  if (typeof product.createdOrder === 'number' && Number.isFinite(product.createdOrder)) {
    payload.createdOrder = Math.max(0, Math.min(100000, Math.round(product.createdOrder)));
  }

  return payload;
}

function computeEstimatedDeliveryWindow(): string {
  const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const end = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function toTimestampMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof (value as { toMillis: unknown }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value &&
    typeof (value as { seconds: unknown }).seconds === 'number'
  ) {
    return (value as { seconds: number }).seconds * 1000;
  }
  return 0;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const initialRoute = useMemo(() => parsePathToRoute(window.location.pathname), []);
  const [view, setView] = useState<AppView>(initialRoute.view);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(initialRoute.productId);
  const [quickViewProductId, setQuickViewProductId] = useState<string | null>(null);
  const [trackedOrderId, setTrackedOrderId] = useState<string | null>(null);

  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productReviews, setProductReviews] = useState<ProductReview[]>([]);

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [adminCheckDone, setAdminCheckDone] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [customersList, setCustomersList] = useState<CustomerAccountRecord[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [cart, setCart] = useState<CartItem[]>(() => readLocalCart());
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  const [wishlistIds, setWishlistIds] = useState<string[]>(() =>
    readLocalIdList(LOCAL_WISHLIST_KEY, 100)
  );
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() =>
    readLocalIdList(LOCAL_RECENT_KEY, 12)
  );

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [firestoreOffers, setFirestoreOffers] = useState<OfferRecord[]>([]);
  const [offerRedemptions, setOfferRedemptions] = useState<OfferRedemptionRecord[]>([]);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const seededOnceRef = useRef(false);
  const authSeqRef = useRef(0);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3600);
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const dismissAccessDenied = useCallback(() => {
    setAccessDeniedMessage(null);
  }, []);

  const navigateTo = useCallback((nextView: AppView, options?: { replace?: boolean }) => {
    setView(nextView);
    const nextPath = routeToPath(nextView, selectedProductId);
    if (window.location.pathname !== nextPath) {
      if (options?.replace) {
        window.history.replaceState(null, '', nextPath);
      } else {
        window.history.pushState(null, '', nextPath);
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedProductId]);

  // Browser back/forward popstate listener
  useEffect(() => {
    const onPopState = () => {
      const parsed = parsePathToRoute(window.location.pathname);
      setView(parsed.view);
      if (parsed.productId) {
        setSelectedProductId(parsed.productId);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openProduct = useCallback((id: string) => {
    setSelectedProductId(id);
    setQuickViewProductId(null);
    setView('product');
    const nextPath = routeToPath('product', id);
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, '', nextPath);
    }
    setRecentlyViewedIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 12);
      try {
        localStorage.setItem(LOCAL_RECENT_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota issues
      }
      return next;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openOrderTracking = useCallback((orderId: string) => {
    setTrackedOrderId(orderId);
    navigateTo('orders');
  }, [navigateTo]);

  // Live Firestore products listener
  useEffect(() => {
    const q = query(collection(db, 'products'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: Product[] = snapshot.docs.map((d) => d.data() as Product);
        setFirestoreProducts(loaded);
        setProductsLoading(false);
      },
      (error) => {
        setProductsLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'products');
      }
    );
    return () => unsubscribe();
  }, []);

  // Live Firestore product reviews listener
  useEffect(() => {
    const q = query(collection(db, 'productReviews'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: ProductReview[] = snapshot.docs.map((d) => d.data() as ProductReview);
        setProductReviews(loaded);
      },
      () => {
        // Reviews listener is non-fatal if collection does not exist yet
      }
    );
    return () => unsubscribe();
  }, []);

  const firestoreMap = useMemo(
    () => new Map(firestoreProducts.map((p) => [p.id, p])),
    [firestoreProducts]
  );

  const unsyncedSeedProducts = useMemo(
    () =>
      SEED_PRODUCTS.filter((seed) => {
        const live = firestoreMap.get(seed.id);
        if (!live) return true;
        return (
          live.imageUrl !== seed.imageUrl &&
          live.imageUrl.startsWith('/src/assets/images/product_')
        );
      }),
    [firestoreMap]
  );

  const isUsingSeedCatalog = firestoreProducts.length === 0 || unsyncedSeedProducts.length > 0;
  const unsyncedSeedCount = unsyncedSeedProducts.length;

  // Merge live Firestore docs with SEED_PRODUCTS while healing any legacy duplicated product_* image URLs
  const products = useMemo(() => {
    const mergedMap = new Map<string, Product>();
    for (const seed of SEED_PRODUCTS) {
      mergedMap.set(seed.id, seed);
    }
    for (const live of firestoreProducts) {
      const seedMatch = mergedMap.get(live.id);
      if (!seedMatch) {
        mergedMap.set(live.id, live);
        continue;
      }
      const hasLegacyStaleImage =
        live.imageUrl !== seedMatch.imageUrl &&
        live.imageUrl.startsWith('/src/assets/images/product_');
      mergedMap.set(
        live.id,
        hasLegacyStaleImage
          ? {
              ...seedMatch,
              ...live,
              imageUrl: seedMatch.imageUrl,
              gallery: seedMatch.gallery,
            }
          : { ...seedMatch, ...live }
      );
    }
    return Array.from(mergedMap.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [firestoreProducts]);

  // Seed missing or image-outdated catalog items into Firestore (Admin only, chunked safely)
  const seedCatalogToFirestore = useCallback(async () => {
    const targets = unsyncedSeedProducts.length > 0 ? unsyncedSeedProducts : SEED_PRODUCTS;
    try {
      for (let i = 0; i < targets.length; i += 200) {
        const chunk = targets.slice(i, i + 200);
        const batch = writeBatch(db);
        for (const item of chunk) {
          const ref = doc(db, 'products', item.id);
          const liveMatch = firestoreMap.get(item.id);
          const payload = liveMatch
            ? sanitizeProductForFirestore({
                ...item,
                stock: liveMatch.stock,
                price: liveMatch.price,
              })
            : sanitizeProductForFirestore(item);
          batch.set(
            ref,
            {
              ...payload,
              ...(liveMatch ? {} : { createdAt: serverTimestamp() }),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
        await batch.commit();
      }
      showToast(`Synced ${targets.length} products to Cloud Firestore (${SEED_PRODUCTS.length} total catalog).`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  }, [unsyncedSeedProducts, firestoreMap, showToast]);

  const verifyUserRoleFromBackend = useCallback(async (firebaseUser: User): Promise<boolean> => {
    let verifiedAdmin = false;
    try {
      const idToken = await firebaseUser.getIdToken();
      const resp = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (resp.ok) {
        const data = (await resp.json()) as { isAdmin?: boolean; emailVerified?: boolean };
        const normalizedEmail = (firebaseUser.email || '').trim().toLowerCase();
        const isBootstrappedEmail = normalizedEmail === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
        verifiedAdmin = Boolean(
          data.isAdmin &&
            (data.emailVerified ?? firebaseUser.emailVerified) &&
            isBootstrappedEmail
        );
      }
    } catch {
      verifiedAdmin = false;
    }
    return verifiedAdmin;
  }, []);

  // Auth state listener, profile sync, cart sync, and wishlist sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const eventSeq = ++authSeqRef.current;
      setUser(firebaseUser);
      setAuthReady(true);

      if (!firebaseUser) {
        setEmailVerified(false);
        setIsAdmin(false);
        setAdminCheckDone(true);
        setUserProfile(null);
        setSavedAddresses([]);
        setOrders([]);
        setOfferRedemptions([]);
        setTotalCustomers(0);
        setCustomersList([]);
        return;
      }

      setEmailVerified(Boolean(firebaseUser.emailVerified));
      setIsAdmin(false);
      setAdminCheckDone(false);
      const verifiedAdmin = await verifyUserRoleFromBackend(firebaseUser);
      if (authSeqRef.current !== eventSeq) return;

      setIsAdmin(verifiedAdmin);
      setAdminCheckDone(true);
      if (verifiedAdmin) {
        setAccessDeniedMessage(null);
      }

      const uid = firebaseUser.uid;
      const userRef = doc(db, 'users', uid);
      const privateRef = doc(db, 'users', uid, 'private', 'info');

      try {
        const [userSnap, privSnap] = await Promise.all([getDoc(userRef), getDoc(privateRef)]);

        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid,
            displayName: (firebaseUser.displayName || 'NovaCart Shopper').slice(0, 100),
            role: 'customer',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        if (!privSnap.exists()) {
          await setDoc(privateRef, {
            uid,
            email: (firebaseUser.email || '').slice(0, 200),
            phone: '',
            street: '',
            city: '',
            state: '',
            postalCode: '',
            updatedAt: serverTimestamp(),
          });
        }

        const refreshedPriv = privSnap.exists()
          ? (privSnap.data() as Partial<UserProfileData>)
          : {};
        const refreshedUser = userSnap.exists()
          ? (userSnap.data() as Partial<UserProfileData>)
          : {};

        setUserProfile({
          uid,
          displayName: refreshedUser.displayName || firebaseUser.displayName || 'NovaCart Shopper',
          role: verifiedAdmin ? 'admin' : 'customer',
          email: refreshedPriv.email || firebaseUser.email || '',
          phone: refreshedPriv.phone || '',
          street: refreshedPriv.street || '',
          city: String(refreshedPriv.city ?? ''),
          state: String(refreshedPriv.state ?? ''),
          postalCode: coerceStoredPinCode(refreshedPriv.postalCode),
        });

        // Merge local cart with top-level /carts/{uid}
        const cartRef = doc(db, 'carts', uid);
        const cartSnap = await getDoc(cartRef);
        const localItems = readLocalCart();
        if (cartSnap.exists()) {
          const remoteItems = ((cartSnap.data()?.items || []) as CartItem[]).filter(
            (i) => typeof i.productId === 'string' && typeof i.quantity === 'number'
          );
          const mergedMap = new Map<string, number>();
          for (const item of remoteItems) {
            mergedMap.set(item.productId, Math.min(99, item.quantity));
          }
          for (const item of localItems) {
            const prev = mergedMap.get(item.productId) || 0;
            mergedMap.set(item.productId, Math.min(99, Math.max(prev, item.quantity)));
          }
          const merged = Array.from(mergedMap.entries())
            .map(([productId, quantity]) => ({ productId, quantity }))
            .slice(0, 50);
          setCart(merged);
          localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(merged));
          if (localItems.length > 0) {
            await updateDoc(cartRef, {
              items: merged,
              updatedAt: serverTimestamp(),
            });
          }
        } else if (localItems.length > 0) {
          await setDoc(cartRef, {
            uid,
            items: localItems,
            updatedAt: serverTimestamp(),
          });
        }

        // Merge local wishlist with top-level /wishlists/{uid}
        const wishRef = doc(db, 'wishlists', uid);
        const wishSnap = await getDoc(wishRef);
        const localWish = readLocalIdList(LOCAL_WISHLIST_KEY, 100);
        if (wishSnap.exists()) {
          const remoteWish = ((wishSnap.data()?.productIds || []) as string[]).filter(
            (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id)
          );
          const mergedWish = Array.from(new Set([...remoteWish, ...localWish])).slice(0, 100);
          setWishlistIds(mergedWish);
          localStorage.setItem(LOCAL_WISHLIST_KEY, JSON.stringify(mergedWish));
          if (localWish.length > 0) {
            await updateDoc(wishRef, {
              productIds: mergedWish,
              updatedAt: serverTimestamp(),
            });
          }
        } else if (localWish.length > 0) {
          await setDoc(wishRef, {
            uid,
            productIds: localWish,
            updatedAt: serverTimestamp(),
          });
        }
      } catch {
        setUserProfile({
          uid,
          displayName: firebaseUser.displayName || 'NovaCart Shopper',
          role: verifiedAdmin ? 'admin' : 'customer',
          email: firebaseUser.email || '',
          phone: '',
          street: '',
          city: '',
          state: '',
          postalCode: '',
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Strict route guard for /admin: immediately redirect unauthorized/unverified users back to Home
  useEffect(() => {
    if (!authReady || !adminCheckDone) return;
    if (view === 'admin' && (!user || !emailVerified || !isAdmin)) {
      const msg =
        'Access Denied: Only the verified store administrator may open the Admin Dashboard.';
      setAccessDeniedMessage(msg);
      showToast('Access Denied: Administrator privileges required.', 'error');
      navigateTo('home', { replace: true });
    }
  }, [authReady, adminCheckDone, view, user, emailVerified, isAdmin, navigateTo, showToast]);

  // Live saved delivery addresses listener (/users/{uid}/addresses — requires verified email)
  useEffect(() => {
    if (!authReady || !adminCheckDone || !user || (!emailVerified && !isAdmin)) {
      setSavedAddresses([]);
      return;
    }

    const q = query(collection(db, 'users', user.uid, 'addresses'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => {
            const raw = d.data() as SavedAddress & { postalCode?: unknown };
            return {
              ...raw,
              postalCode: coerceStoredPinCode(raw.postalCode),
            };
          })
          .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.label.localeCompare(b.label));
        setSavedAddresses(list);
      },
      () => {
        // Non-fatal if user has no saved addresses collection yet
      }
    );

    return () => unsubscribe();
  }, [authReady, adminCheckDone, user, emailVerified, isAdmin]);

  // Automatically sync missing seed products once when admin signs in
  useEffect(() => {
    if (authReady && adminCheckDone && isAdmin && !productsLoading && unsyncedSeedCount > 0 && !seededOnceRef.current) {
      seededOnceRef.current = true;
      void seedCatalogToFirestore();
    }
  }, [authReady, adminCheckDone, isAdmin, productsLoading, unsyncedSeedCount, seedCatalogToFirestore]);

  // Live promotional offers listener (/offers)
  useEffect(() => {
    const q = query(collection(db, 'offers'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => d.data() as OfferRecord);
        setFirestoreOffers(list);
      },
      () => {
        // Non-fatal fallback to starter offers
      }
    );
    return () => unsubscribe();
  }, []);

  const hasFirestoreOffers = firestoreOffers.length > 0;
  const offers = useMemo(() => {
    const source = firestoreOffers.length > 0 ? firestoreOffers : DEFAULT_STARTER_OFFERS;
    return [...source].sort((a, b) => a.code.localeCompare(b.code));
  }, [firestoreOffers]);

  // Orders listener (isolated to verified current user unless verified admin)
  useEffect(() => {
    if (!authReady || !adminCheckDone || !user || (!emailVerified && !isAdmin)) {
      setOrders([]);
      setOrdersLoading(false);
      return;
    }

    setOrdersLoading(true);
    const ordersQuery = isAdmin
      ? query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'orders'), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => d.data() as OrderRecord)
          .sort((a, b) => toTimestampMillis(b.createdAt) - toTimestampMillis(a.createdAt));
        setOrders(list);
        setOrdersLoading(false);
      },
      (error) => {
        setOrdersLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }
    );

    return () => unsubscribe();
  }, [authReady, adminCheckDone, user, emailVerified, isAdmin]);

  // Customer offer bookings & redemptions listener (isolated to verified user unless admin)
  useEffect(() => {
    if (!authReady || !adminCheckDone || !user || (!emailVerified && !isAdmin)) {
      setOfferRedemptions([]);
      return;
    }

    const redemptionsQuery = isAdmin
      ? query(collection(db, 'offerRedemptions'), orderBy('redeemedAt', 'desc'))
      : query(collection(db, 'offerRedemptions'), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(
      redemptionsQuery,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => d.data() as OfferRedemptionRecord)
          .sort((a, b) => toTimestampMillis(b.redeemedAt) - toTimestampMillis(a.redeemedAt));
        setOfferRedemptions(list);
      },
      () => {
        // Non-fatal if no redemptions exist yet
      }
    );

    return () => unsubscribe();
  }, [authReady, adminCheckDone, user, emailVerified, isAdmin]);

  // Admin customers directory & count listener
  useEffect(() => {
    if (!authReady || !adminCheckDone || !user || !isAdmin) {
      setTotalCustomers(0);
      setCustomersList([]);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setTotalCustomers(snapshot.size);
        const list = snapshot.docs.map((d) => {
          const data = d.data() as Partial<CustomerAccountRecord>;
          return {
            uid: data.uid || d.id,
            displayName: data.displayName || 'NovaCart Customer',
            role: data.role === 'admin' ? 'admin' : 'customer',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          } satisfies CustomerAccountRecord;
        });
        setCustomersList(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    );

    return () => unsubscribe();
  }, [authReady, adminCheckDone, user, isAdmin]);

  // Persist cart to localStorage and top-level /carts/{uid}
  const persistCart = useCallback(
    async (nextCart: CartItem[]) => {
      const sanitized = nextCart
        .filter((i) => i.quantity >= 1 && i.quantity <= 99)
        .slice(0, 50);
      localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(sanitized));

      if (user) {
        const cartRef = doc(db, 'carts', user.uid);
        try {
          const snap = await getDoc(cartRef);
          if (snap.exists()) {
            await updateDoc(cartRef, {
              items: sanitized,
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(cartRef, {
              uid: user.uid,
              items: sanitized,
              updatedAt: serverTimestamp(),
            });
          }
        } catch {
          // Non-fatal sync failure; localStorage already updated
        }
      }
    },
    [user]
  );

  // Persist wishlist to localStorage and top-level /wishlists/{uid}
  const persistWishlist = useCallback(
    async (nextIds: string[]) => {
      const sanitized = Array.from(
        new Set(nextIds.filter((id) => /^[a-zA-Z0-9_-]{1,128}$/.test(id)))
      ).slice(0, 100);
      localStorage.setItem(LOCAL_WISHLIST_KEY, JSON.stringify(sanitized));

      if (user) {
        const wishRef = doc(db, 'wishlists', user.uid);
        try {
          const snap = await getDoc(wishRef);
          if (snap.exists()) {
            await updateDoc(wishRef, {
              productIds: sanitized,
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(wishRef, {
              uid: user.uid,
              productIds: sanitized,
              updatedAt: serverTimestamp(),
            });
          }
        } catch {
          // Non-fatal sync failure; localStorage already updated
        }
      }
    },
    [user]
  );

  const addToCart = useCallback(
    (productId: string, qty = 1) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;
      if (product.stock <= 0) {
        showToast('This item is currently out of stock.', 'error');
        return;
      }

      setCart((prev) => {
        const existing = prev.find((i) => i.productId === productId);
        let next: CartItem[];
        if (existing) {
          const updatedQty = Math.min(product.stock, Math.min(99, existing.quantity + qty));
          next = prev.map((i) =>
            i.productId === productId ? { ...i, quantity: updatedQty } : i
          );
        } else {
          next = [...prev, { productId, quantity: Math.min(product.stock, Math.max(1, qty)) }].slice(0, 50);
        }
        void persistCart(next);
        return next;
      });
      showToast(`Added ${product.title} to your bag`);
    },
    [products, persistCart, showToast]
  );

  const updateCartQty = useCallback(
    (productId: string, qty: number) => {
      const product = products.find((p) => p.id === productId);
      const maxAllowed = product ? Math.max(1, Math.min(99, product.stock)) : 99;
      setCart((prev) => {
        const next =
          qty <= 0
            ? prev.filter((i) => i.productId !== productId)
            : prev.map((i) =>
                i.productId === productId
                  ? { ...i, quantity: Math.min(maxAllowed, qty) }
                  : i
              );
        void persistCart(next);
        return next;
      });
    },
    [products, persistCart]
  );

  const removeFromCart = useCallback(
    (productId: string) => {
      setCart((prev) => {
        const next = prev.filter((i) => i.productId !== productId);
        void persistCart(next);
        return next;
      });
      showToast('Removed item from bag', 'info');
    },
    [persistCart, showToast]
  );

  const clearCart = useCallback(async () => {
    setCart([]);
    await persistCart([]);
  }, [persistCart]);

  const isInWishlist = useCallback(
    (productId: string) => wishlistIds.includes(productId),
    [wishlistIds]
  );

  const toggleWishlist = useCallback(
    (productId: string) => {
      const product = products.find((p) => p.id === productId);
      setWishlistIds((prev) => {
        const exists = prev.includes(productId);
        const next = exists
          ? prev.filter((id) => id !== productId)
          : [productId, ...prev].slice(0, 100);
        void persistWishlist(next);
        showToast(
          exists
            ? `Removed ${product?.title || 'item'} from wishlist`
            : `Saved ${product?.title || 'item'} to wishlist`,
          exists ? 'info' : 'success'
        );
        return next;
      });
    },
    [products, persistWishlist, showToast]
  );

  const moveWishlistToCart = useCallback(
    (productId: string) => {
      const product = products.find((p) => p.id === productId);
      if (!product || product.stock <= 0) {
        showToast('This item is currently out of stock.', 'error');
        return;
      }
      addToCart(productId, 1);
      setWishlistIds((prev) => {
        const next = prev.filter((id) => id !== productId);
        void persistWishlist(next);
        return next;
      });
    },
    [products, addToCart, persistWishlist, showToast]
  );

  const cartCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  const cartSubtotal = useMemo(
    () =>
      cart.reduce((sum, item) => {
        const product = products.find((p) => p.id === item.productId);
        return sum + (product ? product.price * item.quantity : 0);
      }, 0),
    [cart, products]
  );

  const wishlistCount = wishlistIds.length;

  const signInWithGoogle = useCallback(async () => {
    await setPersistence(auth, browserLocalPersistence);
    await signInWithPopup(auth, googleProvider);
    setAuthModalOpen(false);
    setAccessDeniedMessage(null);
    showToast('Welcome back to NovaCart.');
  }, [showToast]);

  const signInWithEmail = useCallback(
    async (email: string, password: string, rememberMe = true) => {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      setAuthModalOpen(false);
      setAccessDeniedMessage(null);
      if (!cred.user.emailVerified) {
        showToast('Signed in! Please verify your email address to unlock account features.', 'info');
      } else {
        showToast('Signed in successfully.');
      }
    },
    [showToast]
  );

  const registerWithEmail = useCallback(
    async (name: string, email: string, password: string, phone?: string) => {
      await setPersistence(auth, browserLocalPersistence);
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const cleanName = name.trim().slice(0, 100) || 'NovaCart Shopper';
      const cleanPhone = (phone || '').trim().slice(0, 24);

      await updateProfile(cred.user, { displayName: cleanName });

      const uid = cred.user.uid;
      try {
        const batch = writeBatch(db);
        batch.set(
          doc(db, 'users', uid),
          {
            uid,
            displayName: cleanName,
            role: 'customer',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        batch.set(
          doc(db, 'users', uid, 'private', 'info'),
          {
            uid,
            email: (cred.user.email || email.trim()).slice(0, 200),
            phone: cleanPhone,
            street: '',
            city: '',
            state: '',
            postalCode: '',
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        await batch.commit();
        setUserProfile((prev) => ({
          uid,
          displayName: cleanName,
          role: 'customer',
          email: cred.user.email || email.trim(),
          phone: cleanPhone,
          street: prev?.street || '',
          city: prev?.city || '',
          state: prev?.state || '',
          postalCode: prev?.postalCode || '',
        }));
      } catch {
        // Profile initialization also runs cleanly inside onAuthStateChanged
      }

      try {
        await sendEmailVerification(cred.user);
      } catch {
        // User can also trigger Resend Verification Email from the verification gate
      }
      setAuthModalOpen(false);
      showToast('Account created! Please verify your email inbox to unlock full access.', 'info');
    },
    [showToast]
  );

  const sendPasswordReset = useCallback(
    async (email: string) => {
      await sendPasswordResetEmail(auth, email.trim());
      showToast('Password reset link sent to your email.', 'info');
    },
    [showToast]
  );

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
    showToast('Verification email sent. Check your inbox and spam folder.', 'info');
  }, [showToast]);

  const refreshAuthVerification = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    const verified = Boolean(auth.currentUser.emailVerified);
    setEmailVerified(verified);
    setUser(auth.currentUser);
    if (verified) {
      const verifiedAdmin = await verifyUserRoleFromBackend(auth.currentUser);
      setIsAdmin(verifiedAdmin);
      setAdminCheckDone(true);
      showToast('Email verified! Full NovaCart account features unlocked.');
    } else {
      showToast('Email is still unverified. Click the link in your inbox first.', 'info');
    }
    return verified;
  }, [verifyUserRoleFromBackend, showToast]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setAccessDeniedMessage(null);
    navigateTo('home', { replace: true });
    showToast('Signed out of NovaCart.', 'info');
  }, [navigateTo, showToast]);

  const updateProfileInfo = useCallback(
    async (data: {
      displayName: string;
      phone: string;
      street: string;
      city: string;
      state: string;
      postalCode: string;
    }) => {
      if (!user) throw new Error('Please sign in first.');
      if (!emailVerified && !isAdmin) {
        throw new Error('Please verify your email address before updating profile details.');
      }
      const uid = user.uid;
      const cleanName = data.displayName.trim().slice(0, 100) || 'NovaCart Shopper';
      const cleanPhone = data.phone.trim().slice(0, 24);
      const cleanStreet = data.street.trim().slice(0, 240);
      const cleanCity = data.city.trim().slice(0, 80);
      const cleanState = data.state.trim().slice(0, 80);
      const cleanPostal = coerceStoredPinCode(data.postalCode);

      try {
        await updateProfile(user, { displayName: cleanName });
        const batch = writeBatch(db);
        const userRef = doc(db, 'users', uid);
        const privRef = doc(db, 'users', uid, 'private', 'info');

        batch.set(
          userRef,
          {
            uid,
            displayName: cleanName,
            role: userProfile?.role || 'customer',
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        batch.set(privRef, {
          uid,
          email: (user.email || '').slice(0, 200),
          phone: cleanPhone,
          street: cleanStreet,
          city: cleanCity,
          state: cleanState,
          postalCode: cleanPostal,
          updatedAt: serverTimestamp(),
        });

        await batch.commit();
        setUserProfile((prev) =>
          prev
            ? {
                ...prev,
                displayName: cleanName,
                phone: cleanPhone,
                street: cleanStreet,
                city: cleanCity,
                state: cleanState,
                postalCode: cleanPostal,
              }
            : null
        );
        showToast('Profile details updated.');
      } catch (error) {
        throw new Error(extractReadableError(error, 'Unable to update profile details.'));
      }
    },
    [user, emailVerified, isAdmin, userProfile?.role, showToast]
  );

  const saveAddress = useCallback(
    async (
      address: Omit<SavedAddress, 'id' | 'updatedAt'> & { id?: string }
    ): Promise<SavedAddress> => {
      if (!user) throw new Error('Please sign in to save an address.');
      if (!emailVerified && !isAdmin) {
        throw new Error('Please verify your email address before saving delivery addresses.');
      }
      const uid = user.uid;
      const addressId =
        address.id && /^[a-zA-Z0-9_-]{3,80}$/.test(address.id)
          ? address.id
          : `addr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const makeDefault = Boolean(address.isDefault) || savedAddresses.length === 0;
      const cleanRecord: SavedAddress = {
        id: addressId,
        label: (address.label || 'Home').trim().slice(0, 40) || 'Home',
        recipientName: address.recipientName.trim().slice(0, 100),
        phone: address.phone.trim().slice(0, 24),
        street: address.street.trim().slice(0, 240),
        city: address.city.trim().slice(0, 80),
        state: address.state.trim().slice(0, 80),
        postalCode: coerceStoredPinCode(address.postalCode),
        isDefault: makeDefault,
      };

      try {
        const batch = writeBatch(db);
        if (makeDefault) {
          for (const existing of savedAddresses) {
            if (existing.id !== addressId && existing.isDefault) {
              batch.update(doc(db, 'users', uid, 'addresses', existing.id), {
                isDefault: false,
                updatedAt: serverTimestamp(),
              });
            }
          }
          batch.set(
            doc(db, 'users', uid, 'private', 'info'),
            {
              uid,
              email: (user.email || '').slice(0, 200),
              phone: cleanRecord.phone,
              street: cleanRecord.street,
              city: cleanRecord.city,
              state: cleanRecord.state,
              postalCode: cleanRecord.postalCode,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }

        batch.set(doc(db, 'users', uid, 'addresses', addressId), {
          ...cleanRecord,
          updatedAt: serverTimestamp(),
        });

        await batch.commit();

        if (makeDefault) {
          setUserProfile((prev) =>
            prev
              ? {
                  ...prev,
                  phone: cleanRecord.phone || prev.phone,
                  street: cleanRecord.street,
                  city: cleanRecord.city,
                  state: cleanRecord.state,
                  postalCode: cleanRecord.postalCode,
                }
              : null
          );
        }

        showToast(address.id ? 'Delivery address updated.' : 'Delivery address saved.');
        return cleanRecord;
      } catch (error) {
        throw new Error(extractReadableError(error, 'Unable to save delivery address.'));
      }
    },
    [user, emailVerified, isAdmin, savedAddresses, showToast]
  );

  const deleteAddress = useCallback(
    async (addressId: string) => {
      if (!user) throw new Error('Please sign in first.');
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'addresses', addressId));
        showToast('Delivery address removed.', 'info');
      } catch (error) {
        throw new Error(extractReadableError(error, 'Unable to remove delivery address.'));
      }
    },
    [user, showToast]
  );

  const setDefaultAddress = useCallback(
    async (addressId: string) => {
      if (!user) throw new Error('Please sign in first.');
      const target = savedAddresses.find((a) => a.id === addressId);
      if (!target) return;
      await saveAddress({ ...target, isDefault: true });
    },
    [user, savedAddresses, saveAddress]
  );

  const submitProductReview = useCallback(
    async (input: { productId: string; rating: number; title: string; comment: string }) => {
      if (!user) throw new Error('Please sign in to submit a review.');
      if (!emailVerified && !isAdmin) {
        throw new Error('Please verify your email address before submitting a product review.');
      }

      const reviewId = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const cleanTitle = input.title.trim().slice(0, 120);
      const cleanComment = input.comment.trim().slice(0, 800);
      const cleanRating = Math.min(5, Math.max(1, Math.round(input.rating)));

      if (cleanTitle.length < 2) throw new Error('Review headline must be at least 2 characters.');
      if (cleanComment.length < 5) throw new Error('Review comment must be at least 5 characters.');

      const payload = {
        id: reviewId,
        productId: input.productId,
        userId: user.uid,
        authorName: (userProfile?.displayName || user.displayName || 'NovaCart Customer').slice(0, 100),
        rating: cleanRating,
        title: cleanTitle,
        comment: cleanComment,
      };

      try {
        await setDoc(doc(db, 'productReviews', reviewId), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        showToast('Thank you! Your review has been published.');
      } catch (error) {
        throw new Error(extractReadableError(error, 'Unable to publish review right now.'));
      }
    },
    [user, emailVerified, isAdmin, userProfile, showToast]
  );

  const placeOrder = useCallback(
    async (input: CheckoutInput): Promise<OrderRecord> => {
      if (!user) throw new Error('Please sign in to place an order.');
      if (!emailVerified && !isAdmin) {
        throw new Error('Please verify your email address before placing an order.');
      }
      if (cart.length === 0) throw new Error('Your shopping cart is empty.');

      const isCod = input.paymentMethod === 'cod';
      if (!isCod && (!input.razorpayOrderId || !input.razorpayPaymentId)) {
        throw new Error('Online payment must be verified through Razorpay before order confirmation.');
      }

      if (
        !isCod &&
        input.razorpayPaymentId &&
        orders.some((existing) => existing.razorpayPaymentId === input.razorpayPaymentId)
      ) {
        throw new Error('This payment has already been processed into a confirmed order.');
      }

      // Verify authoritative product prices & totals on trusted backend
      const idToken = await user.getIdToken();
      const quoteResp = await fetch('/api/checkout/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          items: cart.map((ci) => ({
            productId: ci.productId,
            quantity: ci.quantity,
          })),
          promoCode: input.promoCode || '',
        }),
      });

      if (!quoteResp.ok) {
        const errBody = (await quoteResp.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Could not verify order totals.');
      }

      const quote = (await quoteResp.json()) as {
        verifiedItems: Array<{ productId: string; title: string; price: number; quantity: number }>;
        subtotal: number;
        discount: number;
        shippingFee: number;
        total: number;
        appliedPromo: string | null;
        appliedOffer?: {
          id: string;
          code: string;
          title: string;
          discountType: OfferDiscountType;
          discountValue: number;
          oneTimeUse: boolean;
        } | null;
      };

      const lineItems: OrderLineItem[] = quote.verifiedItems.map((vi) => {
        const prod = products.find((p) => p.id === vi.productId);
        return {
          productId: vi.productId,
          title: vi.title.slice(0, 140),
          price: vi.price,
          quantity: vi.quantity,
          imageUrl: (prod?.imageUrl || '').slice(0, 500),
        };
      });

      // Use deterministic document ID for online Razorpay payments to prevent duplicate orders atomically
      const sanitizedPayId = (input.razorpayPaymentId || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const orderId =
        !isCod && sanitizedPayId.length >= 6
          ? `ord_${sanitizedPayId}`.slice(0, 120)
          : `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const orderNumber = `NC-${Math.floor(100000 + Math.random() * 899999)}`;
      const estimatedDelivery = computeEstimatedDeliveryWindow();

      const orderPayload: OrderRecord = {
        id: orderId,
        orderNumber,
        userId: user.uid,
        customerName: input.customerName.trim().slice(0, 100),
        customerEmail: input.customerEmail.trim().slice(0, 200),
        customerPhone: input.customerPhone.trim().slice(0, 24),
        shippingAddress: {
          street: input.shippingAddress.street.trim().slice(0, 240),
          city: input.shippingAddress.city.trim().slice(0, 80),
          state: input.shippingAddress.state.trim().slice(0, 80),
          postalCode: input.shippingAddress.postalCode.trim().slice(0, 20),
        },
        paymentMethod: input.paymentMethod,
        paymentStatus: isCod ? 'pay_on_delivery' : 'paid',
        paymentGateway: isCod ? 'cod' : 'razorpay',
        estimatedDelivery,
        items: lineItems,
        subtotal: quote.subtotal,
        shippingFee: quote.shippingFee,
        discount: quote.discount,
        total: quote.total,
        status: isCod ? 'pending' : 'confirmed',
      };

      if (!isCod && input.razorpayOrderId && input.razorpayPaymentId) {
        orderPayload.razorpayOrderId = input.razorpayOrderId.slice(0, 128);
        orderPayload.razorpayPaymentId = input.razorpayPaymentId.slice(0, 128);
      }
      if (quote.appliedPromo) {
        orderPayload.promoCode = quote.appliedPromo.slice(0, 32);
      }

      const appliedOffer = quote.appliedOffer || null;
      const redemptionId = appliedOffer
        ? appliedOffer.oneTimeUse
          ? `${appliedOffer.code}__${user.uid}`.slice(0, 128)
          : `${appliedOffer.code}__${orderId}`.slice(0, 128)
        : null;

      try {
        await runTransaction(db, async (tx) => {
          const orderRef = doc(db, 'orders', orderId);
          if (!isCod) {
            const existingOrderSnap = await tx.get(orderRef);
            if (existingOrderSnap.exists()) {
              throw new Error('This payment has already been processed into an order.');
            }
          }

          let existingRedemptionCancelled = false;
          const redemptionRef = redemptionId ? doc(db, 'offerRedemptions', redemptionId) : null;
          if (redemptionRef && appliedOffer) {
            const redemptionSnap = await tx.get(redemptionRef);
            if (redemptionSnap.exists()) {
              const prevStatus = redemptionSnap.data()?.status;
              if (appliedOffer.oneTimeUse && prevStatus !== 'Cancelled') {
                throw new Error(
                  `Promo code ${appliedOffer.code} is one-time use and has already been redeemed.`
                );
              }
              existingRedemptionCancelled = true;
            }
          }

          // Read all product snapshots first before any writes
          const stockUpdates: Array<{
            ref: ReturnType<typeof doc>;
            nextStock: number;
          }> = [];

          for (const li of lineItems) {
            const prodRef = doc(db, 'products', li.productId);
            const snap = await tx.get(prodRef);
            if (snap.exists()) {
              const liveData = snap.data() as { stock?: number; title?: string };
              const liveStock = typeof liveData.stock === 'number' ? liveData.stock : 0;
              if (liveStock < li.quantity) {
                throw new Error(
                  `Insufficient stock for "${liveData.title || li.title}". Only ${liveStock} unit(s) left.`
                );
              }
              const nextStock = Math.max(0, liveStock - li.quantity);
              if (nextStock < liveStock) {
                stockUpdates.push({ ref: prodRef, nextStock });
              }
            }
          }

          tx.set(orderRef, {
            ...orderPayload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          if (redemptionRef && appliedOffer && !existingRedemptionCancelled) {
            tx.set(redemptionRef, {
              id: redemptionId,
              offerId: appliedOffer.id,
              offerCode: appliedOffer.code,
              offerTitle: appliedOffer.title.slice(0, 120),
              discountType: appliedOffer.discountType,
              discountValue: appliedOffer.discountValue,
              discountApplied: Math.max(0, quote.discount),
              userId: user.uid,
              customerName: orderPayload.customerName,
              customerEmail: orderPayload.customerEmail,
              orderId,
              orderNumber,
              orderTotal: orderPayload.total,
              status: 'Redeemed',
              redeemedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else if (redemptionRef && appliedOffer && existingRedemptionCancelled) {
            tx.update(redemptionRef, {
              orderId,
              orderNumber,
              orderTotal: orderPayload.total,
              discountApplied: Math.max(0, quote.discount),
              status: 'Redeemed',
              updatedAt: serverTimestamp(),
            });
          }

          for (const upd of stockUpdates) {
            tx.update(upd.ref, {
              stock: upd.nextStock,
              updatedAt: serverTimestamp(),
            });
          }
        });
      } catch (error) {
        const msg = extractReadableError(error, 'Unable to place your order. Please try again.');
        try {
          handleFirestoreError(error, OperationType.CREATE, `orders/${orderId}`);
        } catch {
          // Logging hook only; surface clean readable message to UI
        }
        throw new Error(msg);
      }

      if (!isCod && input.razorpayPaymentId) {
        void fetch('/api/payments/razorpay/mark-consumed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ razorpayPaymentId: input.razorpayPaymentId }),
        }).catch(() => {});
      }

      // Clear cart post-commit so a transient cart sync issue never masks a confirmed order
      await clearCart().catch(() => {});
      showToast(`Order ${orderNumber} confirmed successfully!`);
      return orderPayload;
    },
    [user, emailVerified, isAdmin, cart, products, orders, clearCart, showToast]
  );

  const cancelOrder = useCallback(
    async (orderId: string) => {
      try {
        await updateDoc(doc(db, 'orders', orderId), {
          status: 'cancelled',
          updatedAt: serverTimestamp(),
        });
        const linkedRedemption = offerRedemptions.find(
          (r) => r.orderId === orderId && r.status === 'Redeemed'
        );
        if (linkedRedemption) {
          await updateDoc(doc(db, 'offerRedemptions', linkedRedemption.id), {
            status: 'Cancelled',
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
        showToast('Order cancelled.', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
      }
    },
    [offerRedemptions, showToast]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      try {
        await updateDoc(doc(db, 'orders', orderId), {
          status,
          updatedAt: serverTimestamp(),
        });
        if (status === 'cancelled') {
          const linkedRedemption = offerRedemptions.find(
            (r) => r.orderId === orderId && r.status === 'Redeemed'
          );
          if (linkedRedemption) {
            await updateDoc(doc(db, 'offerRedemptions', linkedRedemption.id), {
              status: 'Cancelled',
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
        }
        showToast(`Order status updated to ${status.replace(/_/g, ' ')}.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
      }
    },
    [offerRedemptions, showToast]
  );

  const seedDefaultOffers = useCallback(async () => {
    if (!isAdmin || !user) return;
    try {
      const batch = writeBatch(db);
      for (const offer of DEFAULT_STARTER_OFFERS) {
        batch.set(doc(db, 'offers', offer.code), {
          id: offer.code,
          code: offer.code,
          title: offer.title,
          description: offer.description,
          discountType: offer.discountType,
          discountValue: offer.discountValue,
          maxDiscount: offer.maxDiscount,
          minOrderAmount: offer.minOrderAmount,
          oneTimeUse: offer.oneTimeUse,
          status: offer.status,
          createdBy: (user.email || '').slice(0, 200),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      showToast('Synced starter promotional offers to Cloud Firestore.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'offers');
    }
  }, [isAdmin, user, showToast]);

  const saveOffer = useCallback(
    async (
      offerInput: Omit<OfferRecord, 'createdAt' | 'updatedAt' | 'createdBy'>,
      isNew: boolean
    ) => {
      if (!isAdmin || !user) throw new Error('Administrator authorization required.');
      const cleanCode = offerInput.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
      if (!/^[A-Z0-9_-]{2,32}$/.test(cleanCode)) {
        throw new Error('Offer code must be 2–32 uppercase letters, numbers, underscores, or hyphens.');
      }
      const cleanTitle = offerInput.title.trim().slice(0, 120);
      const cleanDesc = offerInput.description.trim().slice(0, 500);
      if (cleanTitle.length < 2 || cleanDesc.length < 4) {
        throw new Error('Please enter a valid offer title and description.');
      }

      const payload: Record<string, unknown> = {
        id: cleanCode,
        code: cleanCode,
        title: cleanTitle,
        description: cleanDesc,
        discountType: offerInput.discountType,
        discountValue:
          offerInput.discountType === 'free_shipping'
            ? 0
            : offerInput.discountType === 'percentage'
            ? Math.min(90, Math.max(1, Math.round(offerInput.discountValue)))
            : Math.max(1, Math.round(offerInput.discountValue)),
        maxDiscount: Math.max(0, Math.round(offerInput.maxDiscount)),
        minOrderAmount: Math.max(0, Math.round(offerInput.minOrderAmount)),
        oneTimeUse: Boolean(offerInput.oneTimeUse),
        status: offerInput.status,
        createdBy: (user.email || '').slice(0, 200),
      };
      if (offerInput.expiresAt && offerInput.expiresAt.trim()) {
        payload.expiresAt = offerInput.expiresAt.trim().slice(0, 40);
      }

      const ref = doc(db, 'offers', cleanCode);
      try {
        if (isNew) {
          await setDoc(ref, {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          showToast(`Created promotional offer ${cleanCode}.`);
        } else {
          await updateDoc(ref, {
            ...payload,
            updatedAt: serverTimestamp(),
          });
          showToast(`Updated promotional offer ${cleanCode}.`);
        }
      } catch (error) {
        throw new Error(extractReadableError(error, 'Unable to save promotional offer.'));
      }
    },
    [isAdmin, user, showToast]
  );

  const toggleOfferStatus = useCallback(
    async (offerId: string, nextStatus: OfferStatus) => {
      if (!isAdmin) throw new Error('Administrator authorization required.');
      try {
        await updateDoc(doc(db, 'offers', offerId), {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
        showToast(`Offer ${offerId} marked ${nextStatus}.`);
      } catch (error) {
        throw new Error(extractReadableError(error, 'Unable to update offer status.'));
      }
    },
    [isAdmin, showToast]
  );

  const deleteOffer = useCallback(
    async (offerId: string) => {
      if (!isAdmin) throw new Error('Administrator authorization required.');
      try {
        await deleteDoc(doc(db, 'offers', offerId));
        showToast(`Deleted promotional offer ${offerId}.`, 'info');
      } catch (error) {
        throw new Error(extractReadableError(error, 'Unable to delete promotional offer.'));
      }
    },
    [isAdmin, showToast]
  );

  const saveProduct = useCallback(
    async (product: Omit<Product, 'createdAt' | 'updatedAt'>, isNew: boolean) => {
      const sanitized = sanitizeProductForFirestore(product);
      const ref = doc(db, 'products', sanitized.id as string);

      try {
        if (isNew) {
          await setDoc(ref, {
            ...sanitized,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          showToast(`Created product "${sanitized.title}".`);
        } else {
          await updateDoc(ref, {
            ...sanitized,
            updatedAt: serverTimestamp(),
          });
          showToast(`Updated product "${sanitized.title}".`);
        }
      } catch (error) {
        handleFirestoreError(
          error,
          isNew ? OperationType.CREATE : OperationType.UPDATE,
          `products/${product.id}`
        );
      }
    },
    [showToast]
  );

  const deleteProduct = useCallback(
    async (productId: string) => {
      try {
        await deleteDoc(doc(db, 'products', productId));
        showToast('Product removed from catalog.', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `products/${productId}`);
      }
    },
    [showToast]
  );

  const adjustProductStock = useCallback(
    async (productId: string, newStock: number) => {
      const clamped = Math.max(0, Math.min(100000, Math.round(newStock)));
      try {
        await updateDoc(doc(db, 'products', productId), {
          stock: clamped,
          updatedAt: serverTimestamp(),
        });
        showToast(`Inventory updated to ${clamped} units.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `products/${productId}`);
      }
    },
    [showToast]
  );

  const value: StoreContextValue = {
    view,
    navigateTo,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    selectedProductId,
    openProduct,
    quickViewProductId,
    setQuickViewProductId,
    trackedOrderId,
    setTrackedOrderId,
    openOrderTracking,
    products,
    productsLoading,
    isUsingSeedCatalog,
    unsyncedSeedCount,
    recentlyViewedIds,
    productReviews,
    submitProductReview,
    user,
    authReady,
    emailVerified,
    adminCheckDone,
    isAdmin,
    accessDeniedMessage,
    dismissAccessDenied,
    userProfile,
    savedAddresses,
    totalCustomers,
    customersList,
    authModalOpen,
    setAuthModalOpen,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    sendPasswordReset,
    resendVerificationEmail,
    refreshAuthVerification,
    logout,
    updateProfileInfo,
    saveAddress,
    deleteAddress,
    setDefaultAddress,
    cart,
    cartCount,
    cartSubtotal,
    cartDrawerOpen,
    setCartDrawerOpen,
    addToCart,
    updateCartQty,
    removeFromCart,
    clearCart,
    wishlistIds,
    wishlistCount,
    isInWishlist,
    toggleWishlist,
    moveWishlistToCart,
    orders,
    ordersLoading,
    placeOrder,
    cancelOrder,
    updateOrderStatus,
    offers,
    hasFirestoreOffers,
    offerRedemptions,
    seedDefaultOffers,
    saveOffer,
    toggleOfferStatus,
    deleteOffer,
    seedCatalogToFirestore,
    saveProduct,
    deleteProduct,
    adjustProductStock,
    toast,
    showToast,
    dismissToast,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

