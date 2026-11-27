import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  Edit3,
  IndianRupee,
  Minus,
  Package,
  PackageCheck,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  Ticket,
  Trash2,
  TrendingUp,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { computeEffectiveOfferStatus, formatOfferBenefit } from '../data/defaultOffers';
import { formatINR, formatOrderDateTime } from '../lib/format';
import {
  CATEGORY_DISPLAY_NAMES,
  PRODUCT_CATEGORIES,
  type OfferDiscountType,
  type OfferRecord,
  type OfferStatus,
  type OrderStatus,
  type PaymentMethod,
  type Product,
  type ProductCategory,
} from '../types';
import { NovaCartLogo } from './NovaCartLogo';
import { ProductImage } from './ProductImage';

const EMPTY_FORM: Omit<Product, 'createdAt' | 'updatedAt'> = {
  id: '',
  title: '',
  brand: '',
  category: 'Electronics',
  subCategory: '',
  description: '',
  price: 2999,
  originalPrice: 3499,
  discountPercent: 14,
  rating: 4.8,
  reviewCount: 12,
  stock: 20,
  imageUrl: '/src/assets/images/product_wireless_headphones_1795615887812.jpg',
  featured: false,
  bestSeller: false,
  specialOffer: false,
  isNew: true,
  specs: ['Premium Finish', '1-Year Warranty'],
};

const EMPTY_OFFER_FORM: Omit<OfferRecord, 'createdAt' | 'updatedAt' | 'createdBy'> = {
  id: '',
  code: '',
  title: '',
  description: '',
  discountType: 'percentage',
  discountValue: 10,
  maxDiscount: 2000,
  minOrderAmount: 1000,
  oneTimeUse: false,
  status: 'Active',
  expiresAt: '',
};

const ORDER_STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: 'pending', label: 'Order Placed (Pending)' },
  { value: 'confirmed', label: 'Order Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: 'Cash on Delivery',
  upi: 'UPI / QR Code',
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  netbanking: 'Net Banking',
  debit_card: 'Debit Card',
  credit_card: 'Credit Card',
};

type AdminTab = 'inventory' | 'orders' | 'offers' | 'customers' | 'analytics';
type OrderFilter = 'all' | 'pending' | 'confirmed' | 'in_transit' | 'delivered' | 'cancelled';

export function AdminView() {
  const {
    user,
    authReady,
    emailVerified,
    adminCheckDone,
    isAdmin,
    products,
    orders,
    offers,
    hasFirestoreOffers,
    offerRedemptions,
    totalCustomers,
    customersList,
    isUsingSeedCatalog,
    unsyncedSeedCount,
    navigateTo,
    seedCatalogToFirestore,
    saveProduct,
    deleteProduct,
    adjustProductStock,
    updateOrderStatus,
    seedDefaultOffers,
    saveOffer,
    toggleOfferStatus,
    deleteOffer,
    showToast,
  } = useStore();

  const [tab, setTab] = useState<AdminTab>('orders');
  const [adminCategoryFilter, setAdminCategoryFilter] = useState<ProductCategory | 'All'>('All');
  const [adminSearch, setAdminSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [redemptionSearch, setRedemptionSearch] = useState('');
  const [selectedOfferFilter, setSelectedOfferFilter] = useState<string>('ALL');
  const [serverAuthorized, setServerAuthorized] = useState<boolean | null>(null);

  // Product modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [isNewProduct, setIsNewProduct] = useState(true);
  const [formState, setFormState] = useState<Omit<Product, 'createdAt' | 'updatedAt'>>(EMPTY_FORM);
  const [specsText, setSpecsText] = useState('Premium Finish, 1-Year Warranty');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Offer modal state
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [isNewOffer, setIsNewOffer] = useState(true);
  const [offerForm, setOfferForm] =
    useState<Omit<OfferRecord, 'createdAt' | 'updatedAt' | 'createdBy'>>(EMPTY_OFFER_FORM);
  const [savingOffer, setSavingOffer] = useState(false);
  const [confirmDeleteOfferId, setConfirmDeleteOfferId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function verifyServerAdmin() {
      if (!user || !isAdmin || !emailVerified) {
        if (active) setServerAuthorized(false);
        return;
      }
      try {
        const token = await user.getIdToken();
        const resp = await fetch('/api/admin/authorize', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (active) setServerAuthorized(resp.ok);
      } catch {
        if (active) setServerAuthorized(false);
      }
    }
    void verifyServerAdmin();
    return () => {
      active = false;
    };
  }, [user, isAdmin, emailVerified]);

  const metrics = useMemo(() => {
    const lowStockProducts = products.filter((p) => p.stock <= 15);
    const activeOrders = orders.filter((o) => o.status !== 'cancelled');
    const pendingExactCount = orders.filter((o) => o.status === 'pending').length;
    const confirmedExactCount = orders.filter((o) => o.status === 'confirmed').length;
    const inTransitCount = orders.filter(
      (o) =>
        o.status === 'processing' ||
        o.status === 'shipped' ||
        o.status === 'out_for_delivery'
    ).length;
    const deliveredOrdersCount = orders.filter((o) => o.status === 'delivered').length;
    const cancelledOrders = orders.filter((o) => o.status === 'cancelled');

    const paidOrders = activeOrders.filter((o) => o.paymentStatus === 'paid');
    const verifiedPaidRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
    const deliveredRevenue = orders
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + o.total, 0);
    const pipelineRevenue = orders
      .filter((o) => o.status !== 'delivered' && o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.total, 0);
    const revenue = activeOrders.reduce((sum, o) => sum + o.total, 0);
    const cancelledValue = cancelledOrders.reduce((sum, o) => sum + o.total, 0);
    const averageOrderValue =
      activeOrders.length > 0 ? Math.round(revenue / activeOrders.length) : 0;

    const activeOffersCount = offers.filter(
      (o) => computeEffectiveOfferStatus(o) === 'Active'
    ).length;
    const redeemedOffersCount = offerRedemptions.filter((r) => r.status === 'Redeemed').length;

    return {
      totalProducts: products.length,
      lowStock: lowStockProducts.length,
      lowStockProducts,
      totalOrders: orders.length,
      pendingExactCount,
      confirmedExactCount,
      inTransitCount,
      deliveredOrdersCount,
      cancelledOrdersCount: cancelledOrders.length,
      cancelledValue,
      paidOrdersCount: paidOrders.length,
      verifiedPaidRevenue,
      revenue,
      deliveredRevenue,
      pipelineRevenue,
      averageOrderValue,
      totalOffersCount: offers.length,
      activeOffersCount,
      totalRedemptionsCount: offerRedemptions.length,
      redeemedOffersCount,
    };
  }, [products, orders, offers, offerRedemptions]);

  const categorySummary = useMemo(() => {
    const productCatMap = new Map<string, ProductCategory>(
      products.map((p) => [p.id, p.category])
    );

    const revByCat = new Map<ProductCategory, { revenue: number; unitsSold: number }>();
    for (const cat of PRODUCT_CATEGORIES) {
      revByCat.set(cat, { revenue: 0, unitsSold: 0 });
    }

    for (const ord of orders) {
      if (ord.status === 'cancelled') continue;
      for (const item of ord.items) {
        const cat = productCatMap.get(item.productId) || 'Electronics';
        const prev = revByCat.get(cat) || { revenue: 0, unitsSold: 0 };
        prev.revenue += item.price * item.quantity;
        prev.unitsSold += item.quantity;
        revByCat.set(cat, prev);
      }
    }

    return PRODUCT_CATEGORIES.map((category) => {
      const items = products.filter((p) => p.category === category);
      const totalUnits = items.reduce((sum, p) => sum + p.stock, 0);
      const sales = revByCat.get(category) || { revenue: 0, unitsSold: 0 };
      return {
        category,
        label: CATEGORY_DISPLAY_NAMES[category] || category,
        skuCount: items.length,
        totalUnits,
        salesRevenue: sales.revenue,
        unitsSold: sales.unitsSold,
      };
    });
  }, [products, orders]);

  const analytics = useMemo(() => {
    const paymentBreakdown = new Map<PaymentMethod, { count: number; total: number }>();
    const statusCounts = new Map<OrderStatus, number>();
    const skuSales = new Map<
      string,
      { productId: string; title: string; imageUrl: string; units: number; revenue: number }
    >();

    for (const opt of ORDER_STATUS_OPTIONS) {
      statusCounts.set(opt.value, 0);
    }

    for (const ord of orders) {
      statusCounts.set(ord.status, (statusCounts.get(ord.status) || 0) + 1);
      if (ord.status === 'cancelled') continue;

      const pm = ord.paymentMethod || 'cod';
      const pmPrev = paymentBreakdown.get(pm) || { count: 0, total: 0 };
      pmPrev.count += 1;
      pmPrev.total += ord.total;
      paymentBreakdown.set(pm, pmPrev);

      for (const li of ord.items) {
        const prev = skuSales.get(li.productId) || {
          productId: li.productId,
          title: li.title,
          imageUrl: li.imageUrl,
          units: 0,
          revenue: 0,
        };
        prev.units += li.quantity;
        prev.revenue += li.price * li.quantity;
        skuSales.set(li.productId, prev);
      }
    }

    const paymentRows = Array.from(paymentBreakdown.entries())
      .map(([method, data]) => ({
        method,
        label: PAYMENT_METHOD_LABELS[method] || method,
        count: data.count,
        total: data.total,
      }))
      .sort((a, b) => b.total - a.total);

    const topProducts = Array.from(skuSales.values())
      .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
      .slice(0, 6);

    const maxDeptRevenue = Math.max(1, ...categorySummary.map((c) => c.salesRevenue));

    return {
      paymentRows,
      statusCounts,
      topProducts,
      maxDeptRevenue,
    };
  }, [orders, categorySummary]);

  const enrichedCustomers = useMemo(() => {
    const orderAgg = new Map<
      string,
      {
        orderCount: number;
        totalSpent: number;
        paidSpent: number;
        email?: string;
        phone?: string;
        city?: string;
        lastOrderAt?: unknown;
      }
    >();

    for (const ord of orders) {
      const prev = orderAgg.get(ord.userId) || {
        orderCount: 0,
        totalSpent: 0,
        paidSpent: 0,
      };
      prev.orderCount += 1;
      if (ord.status !== 'cancelled') {
        prev.totalSpent += ord.total;
        if (ord.paymentStatus === 'paid') {
          prev.paidSpent += ord.total;
        }
      }
      if (!prev.email && ord.customerEmail) prev.email = ord.customerEmail;
      if (!prev.phone && ord.customerPhone) prev.phone = ord.customerPhone;
      if (!prev.city && ord.shippingAddress?.city) prev.city = ord.shippingAddress.city;
      if (!prev.lastOrderAt && ord.createdAt) prev.lastOrderAt = ord.createdAt;
      orderAgg.set(ord.userId, prev);
    }

    const merged = customersList.map((cust) => {
      const stats = orderAgg.get(cust.uid);
      return {
        ...cust,
        orderCount: stats?.orderCount || 0,
        totalSpent: stats?.totalSpent || 0,
        paidSpent: stats?.paidSpent || 0,
        email: stats?.email || '',
        phone: stats?.phone || '',
        city: stats?.city || '',
        lastOrderAt: stats?.lastOrderAt || cust.createdAt,
      };
    });

    const q = customerSearch.trim().toLowerCase();
    return merged
      .filter((c) => {
        if (!q) return true;
        return `${c.displayName} ${c.email} ${c.phone} ${c.city} ${c.uid}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => b.totalSpent - a.totalSpent || b.orderCount - a.orderCount);
  }, [customersList, orders, customerSearch]);

  const filteredAdminProducts = useMemo(() => {
    const q = adminSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (adminCategoryFilter !== 'All' && p.category !== adminCategoryFilter) return false;
      if (q) {
        const hay = `${p.title} ${p.brand} ${p.subCategory || ''} ${p.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, adminCategoryFilter, adminSearch]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((o) => {
      if (orderFilter === 'pending' && o.status !== 'pending') return false;
      if (orderFilter === 'confirmed' && o.status !== 'confirmed') return false;
      if (
        orderFilter === 'in_transit' &&
        o.status !== 'processing' &&
        o.status !== 'shipped' &&
        o.status !== 'out_for_delivery'
      ) {
        return false;
      }
      if (orderFilter === 'delivered' && o.status !== 'delivered') return false;
      if (orderFilter === 'cancelled' && o.status !== 'cancelled') return false;

      if (q) {
        const hay = `${o.orderNumber} ${o.id} ${o.customerName} ${o.customerEmail} ${o.customerPhone} ${o.promoCode || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, orderFilter, orderSearch]);

  const offerRedemptionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of offerRedemptions) {
      if (r.status === 'Redeemed') {
        const key = r.offerCode.toUpperCase();
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return counts;
  }, [offerRedemptions]);

  const filteredRedemptions = useMemo(() => {
    const q = redemptionSearch.trim().toLowerCase();
    return offerRedemptions.filter((r) => {
      if (selectedOfferFilter !== 'ALL' && r.offerCode.toUpperCase() !== selectedOfferFilter) {
        return false;
      }
      if (q) {
        const hay = `${r.customerName} ${r.customerEmail} ${r.offerCode} ${r.offerTitle} ${r.orderNumber}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [offerRedemptions, selectedOfferFilter, redemptionSearch]);

  if (!authReady || !adminCheckDone) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-black/8 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-28 bg-white border border-black/8 rounded-xl" />
          ))}
        </div>
        <div className="h-72 bg-white border border-black/8 rounded-2xl" />
      </div>
    );
  }

  if (!user || !emailVerified || !isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-5">
        <ShieldAlert className="w-10 h-10 text-[#EA580C] mx-auto" />
        <h1 className="font-display text-2xl font-bold text-[#141416]">
          Access Denied — Administrator Privileges Required
        </h1>
        <p className="text-sm text-[#5C5B57] leading-relaxed">
          Only the verified store administrator may access NovaCart orders, inventory, offers, and
          analytics.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigateTo('home', { replace: true })}
            className="px-6 py-3 rounded-lg bg-[#141416] hover:bg-[#27272A] text-white text-sm font-semibold cursor-pointer"
          >
            Return to Storefront
          </button>
          {!user && (
            <button
              type="button"
              onClick={() => navigateTo('signin')}
              className="px-6 py-3 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    );
  }

  const openNewModal = () => {
    const generatedId = `nc-prod-${Date.now()}`;
    setIsNewProduct(true);
    setFormState({ ...EMPTY_FORM, id: generatedId });
    setSpecsText(EMPTY_FORM.specs.join(', '));
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setIsNewProduct(false);
    setFormState({ ...product });
    setSpecsText(product.specs.join(', '));
    setModalOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formState.title.trim().length < 2 || formState.description.trim().length < 10) {
      showToast('Please provide a valid title and at least 10 characters of description.', 'error');
      return;
    }

    setSaving(true);
    try {
      const specs = specsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8);
      const orig = Math.max(formState.price, formState.originalPrice);
      const disc = orig > formState.price ? Math.round(((orig - formState.price) / orig) * 100) : 0;

      await saveProduct(
        {
          ...formState,
          originalPrice: orig,
          discountPercent: disc,
          specs,
        },
        isNewProduct
      );
      setModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save product.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openNewOfferModal = () => {
    setIsNewOffer(true);
    setOfferForm(EMPTY_OFFER_FORM);
    setOfferModalOpen(true);
  };

  const openEditOfferModal = (offer: OfferRecord) => {
    setIsNewOffer(false);
    setOfferForm({
      id: offer.id,
      code: offer.code,
      title: offer.title,
      description: offer.description,
      discountType: offer.discountType,
      discountValue: offer.discountValue,
      maxDiscount: offer.maxDiscount,
      minOrderAmount: offer.minOrderAmount,
      oneTimeUse: offer.oneTimeUse,
      status: offer.status,
      expiresAt: offer.expiresAt || '',
    });
    setOfferModalOpen(true);
  };

  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOffer(true);
    try {
      await saveOffer(offerForm, isNewOffer);
      setOfferModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save promotional offer.', 'error');
    } finally {
      setSavingOffer(false);
    }
  };

  const deliveredShare =
    metrics.revenue > 0 ? Math.round((metrics.deliveredRevenue / metrics.revenue) * 100) : 0;
  const pipelineShare = metrics.revenue > 0 ? Math.max(0, 100 - deliveredShare) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-20 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-black/8">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <NovaCartLogo variant="light" size="sm" />
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#EA580C]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {serverAuthorized ? `Verified Admin · ${user.email}` : `Admin · ${user.email}`}
              </span>
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold text-[#141416]">
            Admin Dashboard — Orders, Bookings, Offers &amp; Inventory
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isUsingSeedCatalog && (
            <button
              type="button"
              onClick={() => void seedCatalogToFirestore()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-black/15 bg-white hover:bg-[#F3EFE9] text-xs font-semibold text-[#141416] cursor-pointer"
            >
              <Database className="w-4 h-4 text-[#F97316]" />
              <span>
                {unsyncedSeedCount > 0
                  ? `Sync ${unsyncedSeedCount} Catalog Products`
                  : `Sync ${products.length} Products`}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={openNewOfferModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-black/15 bg-white hover:bg-[#F3EFE9] text-[#141416] text-xs font-semibold cursor-pointer"
          >
            <Tag className="w-4 h-4 text-[#F97316]" />
            <span>Create Offer</span>
          </button>
          <button
            type="button"
            onClick={openNewModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* 9 Required Live Dashboard Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Total registered customers */}
        <div className="bg-white border border-black/8 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#5C5B57]">
            <span>1. Total Registered Customers</span>
            <Users className="w-4 h-4 text-[#F97316]" />
          </div>
          <p className="font-display text-2xl font-bold text-[#141416] tabular-nums">
            {totalCustomers}
          </p>
          <p className="text-[11px] text-[#5C5B57]">Verified customer profiles in Firestore</p>
        </div>

        {/* 2. Total orders */}
        <div className="bg-white border border-black/8 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#5C5B57]">
            <span>2. Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-[#F97316]" />
          </div>
          <p className="font-display text-2xl font-bold text-[#141416] tabular-nums">
            {metrics.totalOrders}
          </p>
          <p className="text-[11px] text-[#5C5B57] tabular-nums">
            Avg order value {formatINR(metrics.averageOrderValue)}
          </p>
        </div>

        {/* 3. Pending orders */}
        <div className="bg-white border border-black/8 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#5C5B57]">
            <span>3. Pending Orders</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="font-display text-2xl font-bold text-[#141416] tabular-nums">
            {metrics.pendingExactCount}
          </p>
          <p className="text-[11px] text-[#5C5B57] tabular-nums">
            {metrics.inTransitCount} additional in processing/shipping
          </p>
        </div>

        {/* 4. Confirmed orders */}
        <div className="bg-white border border-black/8 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#5C5B57]">
            <span>4. Confirmed Orders</span>
            <PackageCheck className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-display text-2xl font-bold text-[#141416] tabular-nums">
            {metrics.confirmedExactCount}
          </p>
          <p className="text-[11px] text-[#5C5B57]">Awaiting dispatch &amp; fulfillment</p>
        </div>

        {/* 5. Delivered orders */}
        <div className="bg-white border border-black/8 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#5C5B57]">
            <span>5. Delivered Orders</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-display text-2xl font-bold text-[#141416] tabular-nums">
            {metrics.deliveredOrdersCount}
          </p>
          <p className="text-[11px] text-emerald-700 font-medium tabular-nums">
            {formatINR(metrics.deliveredRevenue)} delivered value
          </p>
        </div>

        {/* 6. Cancelled orders */}
        <div className="bg-white border border-black/8 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#5C5B57]">
            <span>6. Cancelled Orders</span>
            <XCircle className="w-4 h-4 text-[#5C5B57]" />
          </div>
          <p className="font-display text-2xl font-bold text-[#141416] tabular-nums">
            {metrics.cancelledOrdersCount}
          </p>
          <p className="text-[11px] text-[#5C5B57] tabular-nums">
            {formatINR(metrics.cancelledValue)} voided
          </p>
        </div>

        {/* 7. Total promotional offers */}
        <div className="bg-white border border-black/8 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#5C5B57]">
            <span>7. Total Promotional Offers</span>
            <Sparkles className="w-4 h-4 text-[#F97316]" />
          </div>
          <p className="font-display text-2xl font-bold text-[#141416] tabular-nums">
            {metrics.totalOffersCount}
          </p>
          <p className="text-[11px] text-[#5C5B57] tabular-nums">
            {metrics.activeOffersCount} currently active ·{' '}
            {hasFirestoreOffers ? 'Firestore live' : 'Starter set'}
          </p>
        </div>

        {/* 8. Total offer redemptions */}
        <div className="bg-white border border-black/8 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#5C5B57]">
            <span>8. Total Offer Redemptions</span>
            <Ticket className="w-4 h-4 text-[#F97316]" />
          </div>
          <p className="font-display text-2xl font-bold text-[#141416] tabular-nums">
            {metrics.redeemedOffersCount}
          </p>
          <p className="text-[11px] text-[#5C5B57] tabular-nums">
            {metrics.totalRedemptionsCount} total booking records
          </p>
        </div>

        {/* 9. Total sales from verified successful payments */}
        <div className="bg-white border border-black/8 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#5C5B57]">
            <span>9. Verified Paid Sales</span>
            <IndianRupee className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-display text-2xl font-bold text-[#141416] tabular-nums">
            {formatINR(metrics.verifiedPaidRevenue)}
          </p>
          <p className="text-[11px] text-emerald-700 font-medium tabular-nums">
            {metrics.paidOrdersCount} verified Razorpay paid orders
          </p>
        </div>
      </div>

      {/* Category Inventory Management & Gross Revenue Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-black/8 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-[#141416]">
                Department &amp; Category Management ({products.length} SKUs)
              </h2>
              <p className="text-xs text-[#5C5B57]">Click a department to filter SKU inventory</p>
            </div>
            {adminCategoryFilter !== 'All' && (
              <button
                type="button"
                onClick={() => setAdminCategoryFilter('All')}
                className="text-xs font-semibold text-[#EA580C] hover:underline cursor-pointer"
              >
                Show All ({products.length})
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {categorySummary.map((dept) => {
              const active = adminCategoryFilter === dept.category;
              return (
                <button
                  key={dept.category}
                  type="button"
                  onClick={() => {
                    setTab('inventory');
                    setAdminCategoryFilter(active ? 'All' : dept.category);
                  }}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    active
                      ? 'border-[#F97316] bg-[#F97316]/8'
                      : 'border-black/8 bg-[#FAF8F5] hover:bg-[#F3EFE9]'
                  }`}
                >
                  <p className="text-xs font-bold text-[#141416] truncate">{dept.label}</p>
                  <p className="text-[11px] text-[#5C5B57] tabular-nums mt-0.5">
                    {dept.skuCount} SKUs · {dept.totalUnits} units
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-black/8 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-[#141416]">
                Gross Active Order Volume
              </h2>
              <p className="text-xs text-[#5C5B57]">
                Includes verified Razorpay &amp; COD active orders
              </p>
            </div>
            <p className="font-display text-xl font-bold text-[#141416] tabular-nums">
              {formatINR(metrics.revenue)}
            </p>
          </div>

          <div className="space-y-3">
            <div className="w-full h-3 rounded-full bg-[#F3EFE9] overflow-hidden flex">
              <div
                className="h-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${deliveredShare}%` }}
              />
              <div
                className="h-full bg-[#F97316] transition-all duration-300"
                style={{ width: `${pipelineShare}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-[#141416] font-medium tabular-nums">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                Delivered: {formatINR(metrics.deliveredRevenue)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#141416] font-medium tabular-nums">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F97316]" />
                Active Pipeline: {formatINR(metrics.pipelineRevenue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Alerts & Recent Orders Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-black/8 rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#141416] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F97316]" />
              <span>Low-Stock Alerts (≤ 15 units)</span>
            </h2>
            <span className="text-xs font-mono text-[#5C5B57] tabular-nums">
              {metrics.lowStock} SKUs
            </span>
          </div>

          {metrics.lowStockProducts.length === 0 ? (
            <p className="text-xs text-[#5C5B57]">All products are well stocked above 15 units.</p>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {metrics.lowStockProducts.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-[#FAF8F5] border border-black/6 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#141416] truncate">{item.title}</p>
                    <p className="text-[11px] text-[#EA580C] font-mono tabular-nums">
                      {item.stock} units remaining
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void adjustProductStock(item.id, item.stock + 10)}
                    className="px-2.5 py-1.5 rounded-md bg-[#141416] hover:bg-[#27272A] text-white text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    +10 Restock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 bg-white border border-black/8 rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#141416]">Recent Orders</h2>
            <button
              type="button"
              onClick={() => setTab('orders')}
              className="text-xs font-semibold text-[#EA580C] hover:underline cursor-pointer"
            >
              Manage All ({orders.length})
            </button>
          </div>

          {orders.length === 0 ? (
            <p className="text-xs text-[#5C5B57]">No recent customer orders recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {orders.slice(0, 5).map((ord) => (
                <div
                  key={ord.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-[#FAF8F5] border border-black/6 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-mono font-bold text-[#141416] truncate">
                      {ord.orderNumber}{' '}
                      <span className="font-sans font-medium text-[#5C5B57]">
                        · {ord.customerName}
                      </span>
                    </p>
                    <p className="text-[11px] text-[#5C5B57]">
                      {formatOrderDateTime(ord.createdAt)} · {ord.status.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <span className="font-semibold text-[#141416] tabular-nums shrink-0">
                    {formatINR(ord.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section Tabs + Contextual Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-[#F3EFE9] rounded-lg self-start overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setTab('orders')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'orders' ? 'bg-white text-[#141416] shadow-sm' : 'text-[#5C5B57]'
            }`}
          >
            Customer Orders ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('offers')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'offers' ? 'bg-white text-[#141416] shadow-sm' : 'text-[#5C5B57]'
            }`}
          >
            Customer Bookings &amp; Offers ({offers.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('inventory')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'inventory' ? 'bg-white text-[#141416] shadow-sm' : 'text-[#5C5B57]'
            }`}
          >
            Products &amp; Inventory ({filteredAdminProducts.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('customers')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'customers' ? 'bg-white text-[#141416] shadow-sm' : 'text-[#5C5B57]'
            }`}
          >
            Customers ({totalCustomers})
          </button>
          <button
            type="button"
            onClick={() => setTab('analytics')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              tab === 'analytics' ? 'bg-white text-[#141416] shadow-sm' : 'text-[#5C5B57]'
            }`}
          >
            Sales Analytics
          </button>
        </div>

        {tab === 'inventory' && (
          <div className="relative w-full lg:w-72">
            <Search className="w-3.5 h-3.5 text-[#5C5B57] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={adminSearch}
              onChange={(e) => setAdminSearch(e.target.value)}
              placeholder="Filter SKU, brand, or title..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-black/12 text-xs focus:outline-none focus:border-[#F97316]"
            />
          </div>
        )}

        {tab === 'orders' && (
          <div className="relative w-full lg:w-72">
            <Search className="w-3.5 h-3.5 text-[#5C5B57] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              placeholder="Search order ID, customer, email, phone..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-black/12 text-xs focus:outline-none focus:border-[#F97316]"
            />
          </div>
        )}

        {tab === 'customers' && (
          <div className="relative w-full lg:w-72">
            <Search className="w-3.5 h-3.5 text-[#5C5B57] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Search customer name, email, or city..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-black/12 text-xs focus:outline-none focus:border-[#F97316]"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Customer Orders */}
      {tab === 'orders' && (
        <div className="space-y-4">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-white border border-black/10 rounded-lg">
            {(
              [
                { id: 'all', label: `All (${orders.length})` },
                { id: 'pending', label: `Pending (${metrics.pendingExactCount})` },
                { id: 'confirmed', label: `Confirmed (${metrics.confirmedExactCount})` },
                { id: 'in_transit', label: `In Transit (${metrics.inTransitCount})` },
                { id: 'delivered', label: `Delivered (${metrics.deliveredOrdersCount})` },
                { id: 'cancelled', label: `Cancelled (${metrics.cancelledOrdersCount})` },
              ] as Array<{ id: OrderFilter; label: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setOrderFilter(opt.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  orderFilter === opt.id
                    ? 'bg-[#141416] text-white'
                    : 'text-[#5C5B57] hover:text-[#141416]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {filteredOrders.length === 0 ? (
            <div className="bg-white border border-black/8 rounded-2xl p-12 text-center">
              <Package className="w-8 h-8 text-[#5C5B57] mx-auto mb-3" />
              <p className="text-sm text-[#5C5B57]">No orders match this filter yet.</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white border border-black/8 rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-start justify-between gap-5"
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-[#141416]">{order.orderNumber}</span>
                    <span className="text-[11px] font-mono text-[#5C5B57]">({order.id})</span>
                    <span className="text-[#5C5B57]">·</span>
                    <span className="font-medium text-[#141416]">
                      {formatOrderDateTime(order.createdAt)}
                    </span>
                    {order.promoCode && (
                      <span className="px-2 py-0.5 rounded bg-[#F97316]/10 text-[#EA580C] font-mono text-[11px] font-semibold">
                        Offer: {order.promoCode} (-{formatINR(order.discount)})
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="font-semibold text-[#141416]">{order.customerName}</span>
                    <span className="text-[#5C5B57]">{order.customerEmail}</span>
                    <span className="text-[#5C5B57]">·</span>
                    <span className="font-mono text-[#141416]">{order.customerPhone}</span>
                  </div>

                  <div className="text-xs text-[#141416] bg-[#FAF8F5] border border-black/6 rounded-lg p-2.5">
                    <span className="font-semibold">Items: </span>
                    <span className="text-[#5C5B57]">
                      {order.items
                        .map((i) => `${i.title} ×${i.quantity} (${formatINR(i.price * i.quantity)})`)
                        .join(' · ')}
                    </span>
                  </div>

                  <p className="text-xs text-[#5C5B57]">
                    <span className="font-semibold text-[#141416]">Delivery Address: </span>
                    {order.shippingAddress.street}, {order.shippingAddress.city},{' '}
                    {order.shippingAddress.state} —{' '}
                    <span className="font-mono">{order.shippingAddress.postalCode}</span>
                  </p>

                  {order.razorpayPaymentId && (
                    <p className="text-[11px] font-mono text-emerald-700">
                      Razorpay Ref: {order.razorpayPaymentId}
                    </p>
                  )}
                </div>

                <div className="flex sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 shrink-0">
                  <div className="lg:text-right">
                    <p className="text-xs text-[#5C5B57]">
                      {PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod} ·{' '}
                      <span
                        className={
                          order.paymentStatus === 'paid'
                            ? 'text-emerald-700 font-semibold'
                            : 'text-amber-700 font-semibold'
                        }
                      >
                        {order.paymentStatus === 'paid' ? 'Paid (Verified)' : 'Pay on Delivery'}
                      </span>
                    </p>
                    <p className="text-lg font-bold text-[#141416] tabular-nums">
                      {formatINR(order.total)}
                    </p>
                  </div>

                  <select
                    aria-label={`Order status for ${order.orderNumber}`}
                    value={order.status}
                    onChange={(e) => void updateOrderStatus(order.id, e.target.value as OrderStatus)}
                    className="px-3 py-2 rounded-lg border border-black/15 bg-[#FAF8F5] text-xs font-semibold text-[#141416] focus:outline-none focus:border-[#F97316] cursor-pointer"
                  >
                    {ORDER_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Customer Bookings & Offers */}
      {tab === 'offers' && (
        <div className="space-y-8">
          {/* Promotional Offers CRUD */}
          <section className="bg-white border border-black/8 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-[#141416]">
                  Promotional Offers &amp; Coupon Rules
                </h2>
                <p className="text-xs text-[#5C5B57] mt-0.5">
                  Manage live promo codes, expiry dates, minimum order rules, and one-time-use limits.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {!hasFirestoreOffers && (
                  <button
                    type="button"
                    onClick={() => void seedDefaultOffers()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-black/15 bg-[#FAF8F5] hover:bg-[#F3EFE9] text-xs font-semibold text-[#141416] cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5 text-[#F97316]" />
                    <span>Sync Starter Offers to Firestore</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={openNewOfferModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Promotional Offer</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {offers.map((offer) => {
                const effectiveStatus = computeEffectiveOfferStatus(offer);
                const redeemedCount = offerRedemptionCounts.get(offer.code.toUpperCase()) || 0;
                const statusColors =
                  effectiveStatus === 'Active'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : effectiveStatus === 'Expired'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-neutral-100 text-neutral-700 border-neutral-200';

                return (
                  <article
                    key={offer.id}
                    className="p-4 rounded-xl border border-black/10 bg-[#FAF8F5] flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold text-[#EA580C]">
                          {offer.code}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${statusColors}`}
                        >
                          {effectiveStatus}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-[#141416]">{offer.title}</h3>
                      <p className="text-xs text-[#5C5B57] leading-relaxed">{offer.description}</p>
                      <div className="text-[11px] text-[#5C5B57] space-y-0.5 pt-1">
                        <p>
                          Benefit:{' '}
                          <strong className="text-[#141416]">{formatOfferBenefit(offer)}</strong>
                        </p>
                        <p>
                          Min order:{' '}
                          <strong className="text-[#141416]">
                            {offer.minOrderAmount > 0 ? formatINR(offer.minOrderAmount) : 'None'}
                          </strong>{' '}
                          · {offer.oneTimeUse ? 'One-time use' : 'Multi-use'}
                        </p>
                        {offer.expiresAt && (
                          <p>
                            Expires: <strong className="text-[#141416]">{offer.expiresAt}</strong>
                          </p>
                        )}
                        <p>
                          Redeemed:{' '}
                          <strong className="text-[#141416] tabular-nums">
                            {redeemedCount} {redeemedCount === 1 ? 'customer' : 'customers'}
                          </strong>
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-black/8 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedOfferFilter(offer.code.toUpperCase())}
                        className="font-semibold text-[#EA580C] hover:underline cursor-pointer"
                      >
                        View Redeemers ({redeemedCount})
                      </button>

                      <div className="inline-flex items-center gap-1.5">
                        {effectiveStatus !== 'Active' ? (
                          <button
                            type="button"
                            onClick={() => void toggleOfferStatus(offer.id, 'Active')}
                            className="px-2 py-1 rounded bg-emerald-600 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            Activate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void toggleOfferStatus(offer.id, 'Cancelled')}
                            className="px-2 py-1 rounded border border-black/15 bg-white text-[#141416] text-[11px] font-semibold cursor-pointer"
                          >
                            Cancel Offer
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditOfferModal(offer)}
                          aria-label={`Edit offer ${offer.code}`}
                          className="p-1.5 rounded-lg text-[#5C5B57] hover:text-[#141416] hover:bg-white cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {confirmDeleteOfferId === offer.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                void deleteOffer(offer.id);
                                setConfirmDeleteOfferId(null);
                              }}
                              className="px-2 py-1 rounded bg-red-600 text-white text-[11px] font-semibold cursor-pointer"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteOfferId(null)}
                              className="px-2 py-1 rounded border border-black/15 bg-white text-[11px] cursor-pointer"
                            >
                              Keep
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteOfferId(offer.id)}
                            aria-label={`Delete offer ${offer.code}`}
                            className="p-1.5 rounded-lg text-[#5C5B57] hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Real Customer Bookings & Offer Redemptions Ledger */}
          <section className="bg-white border border-black/8 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-black/8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold text-[#141416]">
                  Customer Offer Redemptions &amp; Bookings ({filteredRedemptions.length})
                </h2>
                <p className="text-xs text-[#5C5B57] mt-0.5">
                  Live Firestore audit log of customers who redeemed promotional offers on orders.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {selectedOfferFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setSelectedOfferFilter('ALL')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F97316]/12 text-[#EA580C] text-xs font-semibold cursor-pointer"
                  >
                    <span>Offer: {selectedOfferFilter}</span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-[#5C5B57] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={redemptionSearch}
                    onChange={(e) => setRedemptionSearch(e.target.value)}
                    placeholder="Filter customer, email, offer code..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#FAF8F5] border border-black/12 text-xs focus:bg-white focus:outline-none focus:border-[#F97316]"
                  />
                </div>
              </div>
            </div>

            {filteredRedemptions.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Ticket className="w-8 h-8 text-[#5C5B57] mx-auto" />
                <p className="text-sm font-medium text-[#141416]">
                  No offer redemptions recorded yet
                </p>
                <p className="text-xs text-[#5C5B57]">
                  When customers apply promotional codes during checkout, real redemption bookings
                  will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-black/8 bg-[#FAF8F5] text-[11px] font-semibold uppercase tracking-wider text-[#5C5B57]">
                      <th className="py-3.5 px-5">Customer</th>
                      <th className="py-3.5 px-4">Offer / Coupon</th>
                      <th className="py-3.5 px-4">Discount</th>
                      <th className="py-3.5 px-4">Order</th>
                      <th className="py-3.5 px-4">Booking Date &amp; Time</th>
                      <th className="py-3.5 px-5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/6">
                    {filteredRedemptions.map((rec) => {
                      const discountDisplay =
                        rec.discountType === 'percentage'
                          ? `${rec.discountValue}% (${formatINR(rec.discountApplied)})`
                          : rec.discountType === 'free_shipping'
                          ? 'Free Shipping'
                          : formatINR(rec.discountApplied || rec.discountValue);

                      return (
                        <tr key={rec.id} className="hover:bg-[#FAF8F5]/60">
                          <td className="py-3.5 px-5">
                            <p className="font-semibold text-[#141416]">{rec.customerName}</p>
                            <p className="text-[11px] text-[#5C5B57]">{rec.customerEmail}</p>
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-mono font-bold text-[#EA580C]">{rec.offerCode}</p>
                            <p className="text-[11px] text-[#5C5B57]">{rec.offerTitle}</p>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-emerald-700 tabular-nums">
                            {discountDisplay}
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-mono font-semibold text-[#141416]">
                              {rec.orderNumber}
                            </p>
                            <p className="text-[11px] text-[#5C5B57] tabular-nums">
                              Total {formatINR(rec.orderTotal)}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 text-[#5C5B57]">
                            {formatOrderDateTime(rec.redeemedAt)}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold ${
                                rec.status === 'Redeemed'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-neutral-100 text-neutral-600'
                              }`}
                            >
                              {rec.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Tab 3: Products & Inventory */}
      {tab === 'inventory' && (
        <div className="bg-white border border-black/8 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/8 bg-[#FAF8F5] text-[11px] font-semibold uppercase tracking-wider text-[#5C5B57]">
                  <th className="py-3.5 px-5">Product</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Price</th>
                  <th className="py-3.5 px-4">Inventory</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6 text-sm">
                {filteredAdminProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-[#FAF8F5]/60">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-9 rounded-md overflow-hidden bg-[#F3EFE9] shrink-0">
                          <ProductImage src={product.imageUrl} alt={product.title} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#141416] truncate max-w-[260px]">
                            {product.title}
                          </p>
                          <p className="text-xs text-[#5C5B57]">
                            {product.brand}
                            {product.subCategory ? ` · ${product.subCategory}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#5C5B57]">
                      {CATEGORY_DISPLAY_NAMES[product.category] || product.category}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#141416] tabular-nums">
                      {formatINR(product.price)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-1.5 border border-black/10 rounded-lg bg-[#FAF8F5] p-0.5">
                        <button
                          type="button"
                          onClick={() => void adjustProductStock(product.id, product.stock - 1)}
                          aria-label={`Decrease stock for ${product.title}`}
                          className="w-7 h-7 rounded flex items-center justify-center hover:bg-white cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span
                          className={`w-9 text-center text-xs font-mono font-semibold tabular-nums ${
                            product.stock <= 15 ? 'text-[#EA580C]' : 'text-[#141416]'
                          }`}
                        >
                          {product.stock}
                        </span>
                        <button
                          type="button"
                          onClick={() => void adjustProductStock(product.id, product.stock + 1)}
                          aria-label={`Increase stock for ${product.title}`}
                          className="w-7 h-7 rounded flex items-center justify-center hover:bg-white cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      {confirmDeleteId === product.id ? (
                        <div className="inline-flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              void deleteProduct(product.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2.5 py-1 rounded bg-red-600 text-white font-semibold cursor-pointer"
                          >
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1 rounded border border-black/15 text-[#141416] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(product)}
                            aria-label={`Edit ${product.title}`}
                            className="p-2 rounded-lg text-[#5C5B57] hover:text-[#141416] hover:bg-black/5 cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(product.id)}
                            aria-label={`Delete ${product.title}`}
                            className="p-2 rounded-lg text-[#5C5B57] hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Customer Management */}
      {tab === 'customers' && (
        <div className="bg-white border border-black/8 rounded-2xl overflow-hidden">
          {enrichedCustomers.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Users className="w-8 h-8 text-[#5C5B57] mx-auto" />
              <p className="text-sm text-[#5C5B57]">No registered customer accounts found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-black/8 bg-[#FAF8F5] text-[11px] font-semibold uppercase tracking-wider text-[#5C5B57]">
                    <th className="py-3.5 px-5">Customer</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Location / Contact</th>
                    <th className="py-3.5 px-4">Orders</th>
                    <th className="py-3.5 px-4">Verified Paid</th>
                    <th className="py-3.5 px-5 text-right">Total Spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6 text-xs">
                  {enrichedCustomers.map((cust) => (
                    <tr key={cust.uid} className="hover:bg-[#FAF8F5]/60">
                      <td className="py-3.5 px-5">
                        <p className="text-sm font-semibold text-[#141416]">{cust.displayName}</p>
                        <p className="font-mono text-[11px] text-[#5C5B57]">
                          UID: {cust.uid.slice(0, 12)}…
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${
                            cust.role === 'admin'
                              ? 'bg-[#F97316]/12 text-[#EA580C]'
                              : 'bg-[#F3EFE9] text-[#141416]'
                          }`}
                        >
                          {cust.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[#5C5B57]">
                        {cust.email ? <p className="text-[#141416]">{cust.email}</p> : <p>—</p>}
                        {cust.phone && <p className="font-mono text-[11px]">{cust.phone}</p>}
                        {cust.city && <p className="text-[11px]">{cust.city}</p>}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#141416] tabular-nums">
                        {cust.orderCount}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-emerald-700 tabular-nums">
                        {formatINR(cust.paidSpent)}
                      </td>
                      <td className="py-3.5 px-5 text-right font-bold text-[#141416] tabular-nums">
                        {formatINR(cust.totalSpent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Sales Analytics */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-black/8 rounded-2xl p-6 space-y-5">
              <div>
                <h2 className="font-display text-base font-bold text-[#141416] flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#F97316]" />
                  <span>Department Revenue Breakdown</span>
                </h2>
                <p className="text-xs text-[#5C5B57]">
                  Active sales revenue &amp; units sold across all 6 shopping categories
                </p>
              </div>

              <div className="space-y-3.5">
                {categorySummary.map((dept) => {
                  const pct =
                    dept.salesRevenue > 0
                      ? Math.max(4, Math.round((dept.salesRevenue / analytics.maxDeptRevenue) * 100))
                      : 0;
                  return (
                    <div key={dept.category} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#141416]">{dept.label}</span>
                        <span className="text-[#5C5B57] tabular-nums">
                          {dept.unitsSold} sold ·{' '}
                          <strong className="text-[#141416]">{formatINR(dept.salesRevenue)}</strong>
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-[#F3EFE9] overflow-hidden">
                        <div
                          className="h-full bg-[#F97316] rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-black/8 rounded-2xl p-6 space-y-4">
                <h2 className="font-display text-base font-bold text-[#141416] flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#F97316]" />
                  <span>Payment Method Mix</span>
                </h2>
                {analytics.paymentRows.length === 0 ? (
                  <p className="text-xs text-[#5C5B57]">
                    Payment method metrics will appear once customer orders are placed.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {analytics.paymentRows.map((row) => (
                      <div
                        key={row.method}
                        className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-[#FAF8F5] border border-black/6"
                      >
                        <div>
                          <p className="font-semibold text-[#141416]">{row.label}</p>
                          <p className="text-[11px] text-[#5C5B57] tabular-nums">
                            {row.count} {row.count === 1 ? 'order' : 'orders'}
                          </p>
                        </div>
                        <span className="font-bold text-[#141416] tabular-nums">
                          {formatINR(row.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-black/8 rounded-2xl p-6 space-y-3">
                <h2 className="font-display text-base font-bold text-[#141416]">
                  Order Status Distribution
                </h2>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {ORDER_STATUS_OPTIONS.map((opt) => (
                    <div
                      key={opt.value}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#FAF8F5] border border-black/6"
                    >
                      <span className="text-[#5C5B57]">{opt.label}</span>
                      <span className="font-mono font-bold text-[#141416] tabular-nums">
                        {analytics.statusCounts.get(opt.value) || 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-black/8 rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-base font-bold text-[#141416] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#F97316]" />
              <span>Top Selling Products</span>
            </h2>
            {analytics.topProducts.length === 0 ? (
              <p className="text-xs text-[#5C5B57]">
                Top selling product rankings will populate after completed orders.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {analytics.topProducts.map((sku) => (
                  <div
                    key={sku.productId}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[#FAF8F5] border border-black/6"
                  >
                    <div className="w-12 h-10 rounded-lg overflow-hidden bg-white shrink-0 border border-black/6">
                      <ProductImage src={sku.imageUrl} alt={sku.title} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#141416] truncate">{sku.title}</p>
                      <p className="text-[11px] text-[#5C5B57] tabular-nums">
                        {sku.units} units ·{' '}
                        <span className="font-semibold text-[#141416]">
                          {formatINR(sku.revenue)}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Promotional Offer Modal */}
      {offerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setOfferModalOpen(false)}
          />

          <div className="relative z-10 w-full max-w-lg bg-white border border-black/10 rounded-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-bold text-[#141416]">
                {isNewOffer ? 'Create Promotional Offer' : `Edit Offer (${offerForm.code})`}
              </h2>
              <button
                type="button"
                onClick={() => setOfferModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5C5B57] hover:bg-black/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOffer} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#141416] mb-1">
                    Coupon Code
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isNewOffer}
                    minLength={2}
                    maxLength={32}
                    value={offerForm.code}
                    onChange={(e) =>
                      setOfferForm((s) => ({
                        ...s,
                        code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
                      }))
                    }
                    placeholder="FESTIVE20"
                    className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm font-mono uppercase focus:bg-white focus:outline-none focus:border-[#F97316] disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#141416] mb-1">Status</label>
                  <select
                    value={offerForm.status}
                    onChange={(e) =>
                      setOfferForm((s) => ({ ...s, status: e.target.value as OfferStatus }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm focus:bg-white focus:outline-none focus:border-[#F97316]"
                  >
                    <option value="Active">Active</option>
                    <option value="Expired">Expired</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#141416] mb-1">Offer Title</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  value={offerForm.title}
                  onChange={(e) => setOfferForm((s) => ({ ...s, title: e.target.value }))}
                  placeholder="Monsoon Celebration 20% Off"
                  className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm focus:bg-white focus:outline-none focus:border-[#F97316]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#141416] mb-1">
                  Description
                </label>
                <textarea
                  required
                  minLength={4}
                  maxLength={500}
                  rows={2}
                  value={offerForm.description}
                  onChange={(e) => setOfferForm((s) => ({ ...s, description: e.target.value }))}
                  placeholder="20% off orders ₹2,000+ (up to ₹3,000)"
                  className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm focus:bg-white focus:outline-none focus:border-[#F97316]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#141416] mb-1">
                    Discount Type
                  </label>
                  <select
                    value={offerForm.discountType}
                    onChange={(e) =>
                      setOfferForm((s) => ({
                        ...s,
                        discountType: e.target.value as OfferDiscountType,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-xs focus:bg-white focus:outline-none focus:border-[#F97316]"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Flat INR (₹)</option>
                    <option value="free_shipping">Free Shipping</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#141416] mb-1">
                    {offerForm.discountType === 'percentage'
                      ? 'Discount %'
                      : offerForm.discountType === 'fixed'
                      ? 'Discount ₹'
                      : 'Shipping Value'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={offerForm.discountType === 'percentage' ? 90 : 100000}
                    disabled={offerForm.discountType === 'free_shipping'}
                    value={offerForm.discountType === 'free_shipping' ? 0 : offerForm.discountValue}
                    onChange={(e) =>
                      setOfferForm((s) => ({ ...s, discountValue: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm tabular-nums focus:bg-white focus:outline-none focus:border-[#F97316] disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#141416] mb-1">
                    Max Cap (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={offerForm.maxDiscount}
                    onChange={(e) =>
                      setOfferForm((s) => ({ ...s, maxDiscount: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm tabular-nums focus:bg-white focus:outline-none focus:border-[#F97316]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#141416] mb-1">
                    Minimum Order Amount (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={offerForm.minOrderAmount}
                    onChange={(e) =>
                      setOfferForm((s) => ({ ...s, minOrderAmount: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm tabular-nums focus:bg-white focus:outline-none focus:border-[#F97316]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#141416] mb-1">
                    Expiry Date <span className="text-[#5C5B57] font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={offerForm.expiresAt || ''}
                    onChange={(e) => setOfferForm((s) => ({ ...s, expiresAt: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm focus:bg-white focus:outline-none focus:border-[#F97316]"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-[#141416] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={offerForm.oneTimeUse}
                  onChange={(e) => setOfferForm((s) => ({ ...s, oneTimeUse: e.target.checked }))}
                  className="accent-[#F97316]"
                />
                <span>Restrict to one-time redemption per customer account</span>
              </label>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOfferModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-black/12 text-xs font-semibold text-[#141416] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingOffer}
                  className="px-5 py-2 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {savingOffer ? 'Saving...' : isNewOffer ? 'Create Offer' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setModalOpen(false)}
          />

          <div className="relative z-10 w-full max-w-xl bg-white border border-black/10 rounded-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-bold text-[#141416]">
                {isNewProduct ? 'Add New Product' : 'Edit Product'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5C5B57] hover:bg-black/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#141416] mb-1">
                    Product Title
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={140}
                    value={formState.title}
                    onChange={(e) => setFormState((s) => ({ ...s, title: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm focus:bg-white focus:outline-none focus:border-[#F97316]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#141416] mb-1">Brand</label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={formState.brand}
                    onChange={(e) => setFormState((s) => ({ ...s, brand: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm focus:bg-white focus:outline-none focus:border-[#F97316]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-[#141416] mb-1">Category</label>
                  <select
                    value={formState.category}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, category: e.target.value as ProductCategory }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm focus:bg-white focus:outline-none focus:border-[#F97316]"
                  >
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_DISPLAY_NAMES[cat]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#141416] mb-1">
                    Price (INR)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formState.price}
                    onChange={(e) => setFormState((s) => ({ ...s, price: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm tabular-nums focus:bg-white focus:outline-none focus:border-[#F97316]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#141416] mb-1">
                    MRP (INR)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formState.originalPrice}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, originalPrice: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm tabular-nums focus:bg-white focus:outline-none focus:border-[#F97316]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#141416] mb-1">Stock</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formState.stock}
                    onChange={(e) => setFormState((s) => ({ ...s, stock: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm tabular-nums focus:bg-white focus:outline-none focus:border-[#F97316]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#141416] mb-1">
                    Sub-Category
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={formState.subCategory || ''}
                    onChange={(e) => setFormState((s) => ({ ...s, subCategory: e.target.value }))}
                    placeholder="Smartphones, Hoodies, Yoga Mats..."
                    className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm focus:bg-white focus:outline-none focus:border-[#F97316]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#141416] mb-1">Image Path</label>
                  <input
                    type="text"
                    required
                    maxLength={500}
                    value={formState.imageUrl}
                    onChange={(e) => setFormState((s) => ({ ...s, imageUrl: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-xs font-mono focus:bg-white focus:outline-none focus:border-[#F97316]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#141416] mb-1">Description</label>
                <textarea
                  required
                  minLength={10}
                  maxLength={1200}
                  rows={3}
                  value={formState.description}
                  onChange={(e) => setFormState((s) => ({ ...s, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm focus:bg-white focus:outline-none focus:border-[#F97316]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#141416] mb-1">
                  Specifications (comma-separated)
                </label>
                <input
                  type="text"
                  value={specsText}
                  onChange={(e) => setSpecsText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm focus:bg-white focus:outline-none focus:border-[#F97316]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-5 pt-1 text-xs font-medium text-[#141416]">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.featured}
                    onChange={(e) => setFormState((s) => ({ ...s, featured: e.target.checked }))}
                    className="accent-[#F97316]"
                  />
                  <span>Trending / Featured</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.bestSeller}
                    onChange={(e) => setFormState((s) => ({ ...s, bestSeller: e.target.checked }))}
                    className="accent-[#F97316]"
                  />
                  <span>Best Seller</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.specialOffer}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, specialOffer: e.target.checked }))
                    }
                    className="accent-[#F97316]"
                  />
                  <span>Seasonal Deal</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formState.isNew)}
                    onChange={(e) => setFormState((s) => ({ ...s, isNew: e.target.checked }))}
                    className="accent-[#F97316]"
                  />
                  <span>New Arrival</span>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-black/12 text-xs font-semibold text-[#141416] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'Saving...' : isNewProduct ? 'Create Product' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
