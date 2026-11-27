import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Loader2,
  Lock,
  MapPin,
  PackageCheck,
  QrCode,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Tag,
  Truck,
  Wallet,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { computeEffectiveOfferStatus, formatOfferBenefit } from '../data/defaultOffers';
import { extractReadableError } from '../lib/firestoreError';
import { formatINR } from '../lib/format';
import {
  coerceStoredPinCode,
  normalizeIndianPinInput,
  validateIndianPinCode,
} from '../lib/pinCode';
import type { OrderRecord, PaymentMethod, SavedAddress } from '../types';
import { EmailVerificationGate } from './EmailVerificationGate';
import { NovaCartLogo } from './NovaCartLogo';
import { ProductImage } from './ProductImage';

interface RazorpaySuccessPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayFailurePayload {
  error?: {
    code?: string;
    description?: string;
    reason?: string;
    step?: string;
  };
}

interface RazorpayCheckoutInstance {
  open: () => void;
  on: (event: string, cb: (resp: RazorpayFailurePayload) => void) => void;
}

interface QrCheckoutSession {
  qrId: string;
  imageUrl: string;
  qrImageDataUrl: string | null;
  amountPaise: number;
  closeBy: number;
  paymentMethod: PaymentMethod;
  status: 'awaiting_scan' | 'verifying' | 'failed' | 'expired';
  errorMessage?: string | null;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckoutInstance;
  }
}

const PAYMENT_OPTIONS: Array<{
  id: PaymentMethod;
  label: string;
  subtitle: string;
  group: 'cod' | 'upi' | 'banking_card';
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'cod',
    label: 'Cash on Delivery (COD)',
    subtitle: 'Pay in cash or doorstep UPI scan upon delivery',
    group: 'cod',
    icon: Truck,
  },
  {
    id: 'upi',
    label: 'UPI / QR Code',
    subtitle: 'Instant UPI ID or QR authorization via Razorpay',
    group: 'upi',
    icon: Smartphone,
  },
  {
    id: 'gpay',
    label: 'Google Pay',
    subtitle: 'Fast UPI approval in your Google Pay app',
    group: 'upi',
    icon: Wallet,
  },
  {
    id: 'phonepe',
    label: 'PhonePe',
    subtitle: 'One-tap UPI approval in PhonePe',
    group: 'upi',
    icon: Smartphone,
  },
  {
    id: 'paytm',
    label: 'Paytm UPI / Wallet',
    subtitle: 'Pay seamlessly with Paytm UPI or wallet',
    group: 'upi',
    icon: Wallet,
  },
  {
    id: 'netbanking',
    label: 'Net Banking',
    subtitle: 'HDFC, ICICI, SBI, Axis & 40+ Indian banks',
    group: 'banking_card',
    icon: Building2,
  },
  {
    id: 'debit_card',
    label: 'Debit Card',
    subtitle: 'Visa, Mastercard & RuPay debit cards',
    group: 'banking_card',
    icon: CreditCard,
  },
  {
    id: 'credit_card',
    label: 'Credit Card',
    subtitle: 'Visa, Mastercard, RuPay & Amex credit cards',
    group: 'banking_card',
    icon: CreditCard,
  },
];

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cod: 'Cash on Delivery',
  upi: 'UPI / QR Code',
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  netbanking: 'Net Banking',
  debit_card: 'Debit Card',
  credit_card: 'Credit Card',
};

function buildRazorpayDisplayConfig(method: PaymentMethod): Record<string, unknown> {
  if (method === 'upi' || method === 'gpay' || method === 'phonepe' || method === 'paytm') {
    const isPaytm = method === 'paytm';
    const label =
      method === 'gpay'
        ? 'Google Pay & UPI'
        : method === 'phonepe'
        ? 'PhonePe & UPI'
        : method === 'paytm'
        ? 'Paytm Wallet & UPI'
        : 'Pay via UPI / QR Code';

    const instruments: Array<Record<string, unknown>> = [{ method: 'upi' }];
    if (isPaytm) {
      instruments.push({ method: 'wallet', wallets: ['paytm'] });
    }

    return {
      display: {
        blocks: {
          preferred_upi: {
            name: label,
            instruments,
          },
        },
        sequence: ['block.preferred_upi'],
        preferences: {
          show_default_blocks: true,
        },
      },
    };
  }

  if (method === 'netbanking') {
    return {
      display: {
        blocks: {
          preferred_nb: {
            name: 'Net Banking (All Major Indian Banks)',
            instruments: [{ method: 'netbanking' }],
          },
        },
        sequence: ['block.preferred_nb'],
        preferences: {
          show_default_blocks: true,
        },
      },
    };
  }

  return {
    display: {
      blocks: {
        preferred_card: {
          name: method === 'debit_card' ? 'Debit Card' : 'Credit Card',
          instruments: [{ method: 'card' }],
        },
      },
      sequence: ['block.preferred_card'],
      preferences: {
        show_default_blocks: true,
      },
    },
  };
}

function loadRazorpayCheckoutScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existing) {
      if (existing.dataset.rzpFailed === '1') {
        existing.remove();
      } else {
        const timer = window.setTimeout(() => resolve(Boolean(window.Razorpay)), 8000);
        existing.addEventListener(
          'load',
          () => {
            window.clearTimeout(timer);
            resolve(Boolean(window.Razorpay));
          },
          { once: true }
        );
        existing.addEventListener(
          'error',
          () => {
            window.clearTimeout(timer);
            existing.dataset.rzpFailed = '1';
            resolve(false);
          },
          { once: true }
        );
        return;
      }
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    const timer = window.setTimeout(() => {
      if (!window.Razorpay) {
        script.dataset.rzpFailed = '1';
      }
      resolve(Boolean(window.Razorpay));
    }, 10000);
    script.onload = () => {
      window.clearTimeout(timer);
      resolve(Boolean(window.Razorpay));
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      script.dataset.rzpFailed = '1';
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export function CheckoutView() {
  const {
    user,
    emailVerified,
    isAdmin,
    userProfile,
    savedAddresses,
    offers,
    offerRedemptions,
    cart,
    products,
    cartSubtotal,
    navigateTo,
    openOrderTracking,
    setAuthModalOpen,
    placeOrder,
    saveAddress,
    showToast,
  } = useStore();

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [saveAddressChecked, setSaveAddressChecked] = useState(true);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [upiFlowMode, setUpiFlowMode] = useState<'qr' | 'checkout'>('checkout');
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [razorpayConfigured, setRazorpayConfigured] = useState<boolean | null>(null);
  const [razorpayMode, setRazorpayMode] = useState<'test' | 'live' | 'unconfigured'>('unconfigured');
  const [qrApiAvailable, setQrApiAvailable] = useState<boolean>(false);

  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string>('');
  const [promoFeedback, setPromoFeedback] = useState<string | null>(null);
  const [quote, setQuote] = useState<{
    subtotal: number;
    discount: number;
    shippingFee: number;
    total: number;
  } | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [qrSession, setQrSession] = useState<QrCheckoutSession | null>(null);
  const [qrGenerating, setQrGenerating] = useState(false);
  const [qrPollingNow, setQrPollingNow] = useState(false);
  const [qrSecondsLeft, setQrSecondsLeft] = useState<number>(0);
  const [qrImageLoadFailed, setQrImageLoadFailed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const placingVerifiedQrRef = useRef(false);
  const deliverySectionRef = useRef<HTMLDivElement>(null);
  const activeQrIdRef = useRef<string | null>(null);
  const consumedPaymentIdsRef = useRef<Set<string>>(new Set());
  const hasHydratedSavedAddressRef = useRef(false);
  const hasUserEditedDeliveryRef = useRef(false);
  const lastHydratedUidRef = useRef<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderRecord | null>(null);

  useEffect(() => {
    const checkViewport = () => {
      const mobile = window.matchMedia('(max-width: 767px)').matches;
      setIsMobileViewport(mobile);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/payments/config')
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            razorpayConfigured?: boolean;
            razorpayMode?: 'test' | 'live' | 'unconfigured';
            qrApiAvailable?: boolean;
          } | null
        ) => {
          if (active && data) {
            const configured = Boolean(data.razorpayConfigured);
            const hasQrApi = Boolean(data.qrApiAvailable);
            setRazorpayConfigured(configured);
            setRazorpayMode(
              data.razorpayMode || (configured ? 'test' : 'unconfigured')
            );
            setQrApiAvailable(hasQrApi);
            if (!hasQrApi) {
              setUpiFlowMode('checkout');
            }
            if (configured) {
              void loadRazorpayCheckoutScript();
            }
          }
        }
      )
      .catch(() => {
        if (active) {
          setRazorpayConfigured(false);
          setRazorpayMode('unconfigured');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const markDeliveryEdited = () => {
    hasUserEditedDeliveryRef.current = true;
    setSelectedAddressId(null);
  };

  const applySavedAddress = (addr: SavedAddress) => {
    hasHydratedSavedAddressRef.current = true;
    setSelectedAddressId(addr.id);
    setCustomerName(String(addr.recipientName ?? ''));
    setCustomerPhone(String(addr.phone ?? ''));
    setStreet(String(addr.street ?? ''));
    setCity(String(addr.city ?? ''));
    setStateName(String(addr.state ?? ''));
    setPostalCode(coerceStoredPinCode(addr.postalCode));
    setPinError(null);
    setFormError(null);
    setSaveAddressChecked(false);
  };

  useEffect(() => {
    const currentUid = user?.uid ?? null;
    if (lastHydratedUidRef.current !== currentUid) {
      lastHydratedUidRef.current = currentUid;
      hasHydratedSavedAddressRef.current = false;
      hasUserEditedDeliveryRef.current = false;
    }

    if (user?.email) {
      setCustomerEmail((prev) => prev || user.email || '');
    }

    // Never overwrite fields once the user has started editing delivery details
    if (hasUserEditedDeliveryRef.current) {
      return;
    }

    if (savedAddresses.length > 0 && !hasHydratedSavedAddressRef.current) {
      const def = savedAddresses.find((a) => a.isDefault) || savedAddresses[0];
      applySavedAddress(def);
      return;
    }

    if (userProfile && !hasHydratedSavedAddressRef.current) {
      setCustomerName((prev) => prev || String(userProfile.displayName ?? ''));
      setCustomerEmail((prev) => prev || String(userProfile.email ?? ''));
      setCustomerPhone((prev) => prev || String(userProfile.phone ?? ''));
      setStreet((prev) => prev || String(userProfile.street ?? ''));
      setCity((prev) => prev || String(userProfile.city ?? ''));
      setStateName((prev) => prev || String(userProfile.state ?? ''));
      setPostalCode((prev) => prev || coerceStoredPinCode(userProfile.postalCode));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userProfile, savedAddresses]);

  const enrichedCart = useMemo(
    () =>
      cart
        .map((ci) => {
          const product = products.find((p) => p.id === ci.productId);
          return product ? { ...ci, product } : null;
        })
        .filter(
          (x): x is { productId: string; quantity: number; product: NonNullable<typeof x>['product'] } =>
            x !== null
        ),
    [cart, products]
  );

  const fallbackShipping = cartSubtotal >= 2999 || cartSubtotal === 0 ? 0 : 149;
  const activeTotals = quote || {
    subtotal: cartSubtotal,
    discount: 0,
    shippingFee: fallbackShipping,
    total: cartSubtotal + fallbackShipping,
  };

  const availableCheckoutOffers = useMemo(() => {
    const redeemedCodes = new Set(
      offerRedemptions
        .filter((r) => r.status !== 'Cancelled')
        .map((r) => r.offerCode.toUpperCase())
    );
    return offers.filter((offer) => {
      if (computeEffectiveOfferStatus(offer) !== 'Active') return false;
      if (offer.oneTimeUse && redeemedCodes.has(offer.code.toUpperCase())) return false;
      return true;
    });
  }, [offers, offerRedemptions]);

  const fetchQuote = async (code: string) => {
    if (!user || (!emailVerified && !isAdmin) || enrichedCart.length === 0) return;
    setQuoting(true);
    try {
      const idToken = await user.getIdToken();
      const resp = await fetch('/api/checkout/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          items: enrichedCart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          promoCode: code,
        }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as {
          subtotal: number;
          discount: number;
          shippingFee: number;
          total: number;
          appliedPromo: string | null;
          promoMessage: string | null;
        };
        setQuote({
          subtotal: data.subtotal,
          discount: data.discount,
          shippingFee: data.shippingFee,
          total: data.total,
        });
        setAppliedPromo(data.appliedPromo || '');
        setPromoFeedback(code.trim() ? data.promoMessage : null);
      } else {
        const errBody = (await resp.json().catch(() => ({}))) as { error?: string };
        if (errBody.error) {
          setPromoFeedback(errBody.error);
        }
      }
    } catch {
      // Ignore transient quote failure
    } finally {
      setQuoting(false);
    }
  };

  useEffect(() => {
    if (user && (emailVerified || isAdmin) && enrichedCart.length > 0) {
      void fetchQuote(appliedPromo);
    } else {
      setQuote(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, emailVerified, isAdmin, enrichedCart.length, cartSubtotal]);

  if (confirmedOrder) {
    const isCodOrder = confirmedOrder.paymentMethod === 'cod';
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 pb-20">
        <div className="bg-white border border-black/8 rounded-2xl p-6 sm:p-10 shadow-sm space-y-8">
          <div className="flex items-center justify-between pb-4 border-b border-black/8">
            <NovaCartLogo variant="light" size="sm" />
            <span className="text-[11px] font-mono font-semibold text-emerald-700 uppercase tracking-wider">
              Official Order Receipt
            </span>
          </div>

          <div className="text-center space-y-3">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto"
            >
              <CheckCircle2 className="w-9 h-9" />
            </motion.div>

            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
              Confirmation Receipt
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#141416]">
              Order Confirmed Successfully!
            </h1>
            <p className="text-sm text-[#5C5B57] max-w-lg mx-auto leading-relaxed">
              Thank you for shopping with NovaCart. Your order has been placed and verified.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF8F5] border border-black/8 rounded-xl p-4 text-xs">
            <div>
              <span className="block uppercase tracking-wider text-[10px] text-[#5C5B57]">
                Order ID
              </span>
              <span className="font-mono font-bold text-[#141416] text-sm">
                {confirmedOrder.orderNumber}
              </span>
            </div>
            <div>
              <span className="block uppercase tracking-wider text-[10px] text-[#5C5B57]">
                Payment Method
              </span>
              <span className="font-semibold text-[#141416]">
                {PAYMENT_LABELS[confirmedOrder.paymentMethod]}
              </span>
            </div>
            <div>
              <span className="block uppercase tracking-wider text-[10px] text-[#5C5B57]">
                Payment Status
              </span>
              <span
                className={`font-semibold ${
                  isCodOrder ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {isCodOrder ? 'Pay on Delivery' : 'Paid (Verified)'}
              </span>
            </div>
            <div>
              <span className="block uppercase tracking-wider text-[10px] text-[#5C5B57]">
                Estimated Delivery
              </span>
              <span className="font-semibold text-[#141416]">
                {confirmedOrder.estimatedDelivery || '3–5 business days'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-black/8 rounded-xl p-5 text-xs">
            <div className="space-y-1">
              <p className="font-semibold text-[#141416] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#F97316]" />
                <span>Customer & Delivery Address</span>
              </p>
              <p className="font-medium text-[#141416] pt-1">{confirmedOrder.customerName}</p>
              <p className="text-[#5C5B57]">{confirmedOrder.shippingAddress.street}</p>
              <p className="text-[#5C5B57]">
                {confirmedOrder.shippingAddress.city}, {confirmedOrder.shippingAddress.state}{' '}
                {confirmedOrder.shippingAddress.postalCode}
              </p>
              <p className="text-[#5C5B57]">{confirmedOrder.customerPhone}</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-[#141416] flex items-center gap-1.5">
                <PackageCheck className="w-3.5 h-3.5 text-[#F97316]" />
                <span>Fulfillment Details</span>
              </p>
              <p className="text-[#5C5B57] pt-1">Email: {confirmedOrder.customerEmail}</p>
              <p className="text-[#5C5B57]">
                Status:{' '}
                <span className="font-semibold text-[#141416] capitalize">
                  {confirmedOrder.status === 'pending' ? 'Order Placed' : 'Order Confirmed'}
                </span>
              </p>
              {confirmedOrder.razorpayPaymentId && (
                <p className="text-[#5C5B57] font-mono">Ref: {confirmedOrder.razorpayPaymentId}</p>
              )}
            </div>
          </div>

          <div className="bg-[#FAF8F5] border border-black/8 rounded-xl p-5 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#5C5B57]">
              Ordered Items ({confirmedOrder.items.reduce((acc, i) => acc + i.quantity, 0)})
            </h2>
            <div className="space-y-2.5 pb-3 border-b border-black/8">
              {confirmedOrder.items.map((item) => (
                <div key={item.productId} className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-white shrink-0 border border-black/6">
                      <ProductImage src={item.imageUrl} alt={item.title} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[#141416] font-semibold truncate">{item.title}</p>
                      <p className="text-[#5C5B57] tabular-nums">
                        Qty {item.quantity} × {formatINR(item.price)}
                      </p>
                    </div>
                  </div>
                  <span className="tabular-nums font-semibold text-[#141416] shrink-0">
                    {formatINR(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-[#5C5B57]">
                <span>Subtotal</span>
                <span className="tabular-nums font-medium text-[#141416]">
                  {formatINR(confirmedOrder.subtotal)}
                </span>
              </div>
              {confirmedOrder.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>
                    Promo Discount {confirmedOrder.promoCode ? `(${confirmedOrder.promoCode})` : ''}
                  </span>
                  <span className="tabular-nums font-medium">
                    -{formatINR(confirmedOrder.discount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-[#5C5B57]">
                <span>Shipping</span>
                <span className="tabular-nums font-medium text-[#141416]">
                  {confirmedOrder.shippingFee === 0
                    ? 'Complimentary'
                    : formatINR(confirmedOrder.shippingFee)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-[#141416] pt-2 border-t border-black/8">
                <span>{isCodOrder ? 'Total Payable on Delivery' : 'Total Paid'}</span>
                <span className="tabular-nums">{formatINR(confirmedOrder.total)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
            <button
              type="button"
              onClick={() => openOrderTracking(confirmedOrder.id)}
              className="px-6 py-3 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold cursor-pointer"
            >
              Track My Order
            </button>
            <button
              type="button"
              onClick={() => navigateTo('catalog')}
              className="px-6 py-3 rounded-lg bg-[#141416] hover:bg-[#27272A] text-white text-sm font-semibold cursor-pointer"
            >
              Continue Shopping
            </button>
            <button
              type="button"
              onClick={() => navigateTo('orders')}
              className="px-6 py-3 rounded-lg border border-black/15 bg-white hover:bg-[#F3EFE9] text-[#141416] text-sm font-semibold cursor-pointer"
            >
              View My Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (enrichedCart.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-[#F3EFE9] flex items-center justify-center mx-auto">
          <ShoppingBag className="w-6 h-6 text-[#5C5B57]" />
        </div>
        <h1 className="font-display text-2xl font-bold text-[#141416]">
          Your checkout bag is empty
        </h1>
        <p className="text-sm text-[#5C5B57]">
          Add items from the NovaCart catalog before proceeding to checkout.
        </p>
        <button
          type="button"
          onClick={() => navigateTo('catalog')}
          className="px-6 py-3 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold cursor-pointer"
        >
          Browse Catalog
        </button>
      </div>
    );
  }

  const isOnlineMethod = paymentMethod !== 'cod';
  const isUpiCapableMethod =
    paymentMethod === 'upi' ||
    paymentMethod === 'gpay' ||
    paymentMethod === 'phonepe' ||
    paymentMethod === 'paytm';

  const shouldUseQrFlow =
    qrApiAvailable &&
    isUpiCapableMethod &&
    (paymentMethod === 'upi' ? upiFlowMode === 'qr' : !isMobileViewport && upiFlowMode === 'qr');

  const surfaceValidationError = (msg: string) => {
    setFormError(msg);
    showToast(msg, 'error');
    deliverySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const validateDeliveryDetails = (): {
    ok: true;
    emailClean: string;
    phoneDigits: string;
    pinClean: string;
  } | { ok: false; error: string } => {
    const emailClean = customerEmail.trim();
    const phoneDigits = customerPhone.replace(/\D/g, '');
    const pinClean = postalCode.trim();

    if (customerName.trim().length < 2) {
      return { ok: false, error: 'Please enter your full name (at least 2 characters).' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      return { ok: false, error: 'Please enter a valid contact email address.' };
    }
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      return { ok: false, error: 'Please enter a valid 10-digit mobile phone number.' };
    }
    if (street.trim().length < 5) {
      return { ok: false, error: 'Please enter your complete street address and house/flat number.' };
    }
    if (city.trim().length < 2 || stateName.trim().length < 2) {
      return { ok: false, error: 'Please enter both city and state.' };
    }
    const pinValidationError = validateIndianPinCode(pinClean);
    if (pinValidationError) {
      setPinError(pinValidationError);
      return { ok: false, error: pinValidationError };
    }
    setPinError(null);
    return { ok: true, emailClean, phoneDigits, pinClean };
  };

  const persistAddressIfRequested = useCallback(
    async (pinClean: string) => {
      if (!saveAddressChecked || selectedAddressId) return;
      const alreadyExists = savedAddresses.some(
        (a) =>
          a.street.toLowerCase() === street.trim().toLowerCase() &&
          a.postalCode.toLowerCase() === pinClean.toLowerCase()
      );
      if (!alreadyExists) {
        await saveAddress({
          label: savedAddresses.length === 0 ? 'Home' : 'Delivery',
          recipientName: customerName.trim(),
          phone: customerPhone.trim(),
          street: street.trim(),
          city: city.trim(),
          state: stateName.trim(),
          postalCode: pinClean,
          isDefault: savedAddresses.length === 0,
        }).catch(() => {});
      }
    },
    [saveAddressChecked, selectedAddressId, savedAddresses, street, saveAddress, customerName, customerPhone, city, stateName]
  );

  const closeQrOnServer = useCallback(
    async (qrId: string | null) => {
      if (!qrId || !user) return;
      try {
        const idToken = await user.getIdToken();
        await fetch(`/api/payments/razorpay/qr-close/${encodeURIComponent(qrId)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}` },
        });
      } catch {
        // Best-effort cleanup
      }
    },
    [user]
  );

  const handleCancelQrSession = useCallback(() => {
    const prevId = activeQrIdRef.current;
    activeQrIdRef.current = null;
    setQrSession(null);
    setQrImageLoadFailed(false);
    setQrSecondsLeft(0);
    if (prevId) {
      void closeQrOnServer(prevId);
    }
  }, [closeQrOnServer]);

  // Close active QR session on unmount to avoid leaving orphan QRs active
  useEffect(() => {
    return () => {
      const qrId = activeQrIdRef.current;
      if (qrId && user) {
        void user
          .getIdToken()
          .then((token) =>
            fetch(`/api/payments/razorpay/qr-close/${encodeURIComponent(qrId)}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
            })
          )
          .catch(() => {});
      }
    };
  }, [user]);

  const launchStandardRazorpayCheckout = async (methodToUse: PaymentMethod) => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    const validation = validateDeliveryDetails();
    if (!validation.ok) {
      surfaceValidationError(validation.error);
      return;
    }
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setFormError(null);

    try {
      const idToken = await user.getIdToken();
      const createResp = await fetch('/api/payments/razorpay/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          items: enrichedCart.map((ci) => ({
            productId: ci.productId,
            quantity: ci.quantity,
          })),
          promoCode: appliedPromo,
          paymentMethod: methodToUse,
        }),
      });

      const createData = (await createResp.json().catch(() => ({}))) as {
        configured?: boolean;
        orderId?: string;
        amount?: number;
        currency?: string;
        keyId?: string;
        error?: string;
      };

      if (!createResp.ok || !createData.orderId || !createData.keyId) {
        if (createData.configured === false) {
          setRazorpayConfigured(false);
          setRazorpayMode('unconfigured');
        }
        throw new Error(
          createData.error || 'Could not initiate online payment gateway. Try Cash on Delivery.'
        );
      }

      const loaded = await loadRazorpayCheckoutScript();
      if (!loaded || !window.Razorpay) {
        throw new Error(
          'Unable to load Razorpay Checkout script. Check your internet connection or use Cash on Delivery.'
        );
      }

      const formattedContact =
        validation.phoneDigits.length === 10
          ? `+91${validation.phoneDigits}`
          : `+${validation.phoneDigits}`;

      const paymentProof = await new Promise<RazorpaySuccessPayload>((resolve, reject) => {
        let settled = false;
        const RazorpayCtor = window.Razorpay!;
        const rzp = new RazorpayCtor({
          key: createData.keyId,
          amount: createData.amount,
          currency: createData.currency || 'INR',
          name: 'NovaCart Marketplace',
          description: `Order payment via ${PAYMENT_LABELS[methodToUse]}`,
          order_id: createData.orderId,
          prefill: {
            name: customerName.trim(),
            email: validation.emailClean,
            contact: formattedContact,
          },
          config: buildRazorpayDisplayConfig(methodToUse),
          notes: {
            selected_method: methodToUse,
          },
          retry: {
            enabled: true,
            max_count: 3,
          },
          timeout: 300,
          send_sms_hash: true,
          theme: {
            color: '#F97316',
            backdrop_color: '#141416',
          },
          handler: (response: RazorpaySuccessPayload) => {
            if (settled) return;
            settled = true;
            resolve(response);
          },
          modal: {
            backdropclose: false,
            escape: true,
            confirm_close: true,
            ondismiss: () => {
              if (settled) return;
              settled = true;
              reject(new Error('Payment window was closed before completing authorization.'));
            },
          },
        });

        rzp.on('payment.failed', (failure) => {
          if (settled) return;
          settled = true;
          const desc = failure?.error?.description;
          const reason = failure?.error?.reason
            ? ` (${failure.error.reason.replace(/_/g, ' ')})`
            : '';
          reject(
            new Error(
              desc
                ? `${desc}${reason}`
                : 'Payment authorization failed at the gateway. Please retry or switch payment methods.'
            )
          );
        });

        rzp.open();
      });

      if (consumedPaymentIdsRef.current.has(paymentProof.razorpay_payment_id)) {
        throw new Error('This payment transaction has already been processed.');
      }

      const verifyResp = await fetch('/api/payments/razorpay/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          ...paymentProof,
          items: enrichedCart.map((ci) => ({
            productId: ci.productId,
            quantity: ci.quantity,
          })),
          promoCode: appliedPromo,
        }),
      });

      const verifyData = (await verifyResp.json().catch(() => ({}))) as {
        verified?: boolean;
        duplicate?: boolean;
        razorpayOrderId?: string;
        razorpayPaymentId?: string;
        error?: string;
      };

      if (!verifyResp.ok || !verifyData.verified || !verifyData.razorpayPaymentId) {
        throw new Error(verifyData.error || 'Payment signature verification failed.');
      }

      consumedPaymentIdsRef.current.add(verifyData.razorpayPaymentId);

      const created = await placeOrder({
        customerName,
        customerEmail: validation.emailClean,
        customerPhone,
        shippingAddress: {
          street,
          city,
          state: stateName,
          postalCode: validation.pinClean,
        },
        paymentMethod: methodToUse,
        promoCode: appliedPromo,
        razorpayOrderId: verifyData.razorpayOrderId,
        razorpayPaymentId: verifyData.razorpayPaymentId,
      });
      void persistAddressIfRequested(validation.pinClean);
      setConfirmedOrder(created);
    } catch (err) {
      const msg = extractReadableError(err, 'Unable to complete payment. Please retry.');
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const generateUpiQrSession = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    const validation = validateDeliveryDetails();
    if (!validation.ok) {
      surfaceValidationError(validation.error);
      return;
    }
    if (qrGenerating || submittingRef.current) return;

    setFormError(null);
    setQrGenerating(true);
    setQrImageLoadFailed(false);

    try {
      const idToken = await user.getIdToken();
      const resp = await fetch('/api/payments/razorpay/create-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          items: enrichedCart.map((ci) => ({
            productId: ci.productId,
            quantity: ci.quantity,
          })),
          promoCode: appliedPromo,
          paymentMethod,
          previousQrId: activeQrIdRef.current || undefined,
        }),
      });

      const data = (await resp.json().catch(() => ({}))) as {
        configured?: boolean;
        qrSupported?: boolean;
        fallbackToCheckout?: boolean;
        qrId?: string;
        imageUrl?: string;
        qrImageDataUrl?: string | null;
        amountPaise?: number;
        closeBy?: number;
        serverNow?: number;
        error?: string;
      };

      if (data.configured === false) {
        setRazorpayConfigured(false);
        setRazorpayMode('unconfigured');
      }

      if (!resp.ok || !data.qrId || !data.imageUrl) {
        if (data.qrSupported === false) {
          setQrApiAvailable(false);
          setUpiFlowMode('checkout');
        }
        if (data.fallbackToCheckout && data.configured !== false) {
          showToast(
            'Opening Razorpay Checkout with UPI QR & UPI App authorization.',
            'info'
          );
          setQrGenerating(false);
          await launchStandardRazorpayCheckout(paymentMethod);
          return;
        }
        throw new Error(
          data.error || 'Unable to generate Razorpay UPI QR code right now.'
        );
      }

      const nowSec = data.serverNow || Math.floor(Date.now() / 1000);
      const closeBy = data.closeBy || nowSec + 960;
      activeQrIdRef.current = data.qrId;
      placingVerifiedQrRef.current = false;
      setQrSecondsLeft(Math.max(0, closeBy - nowSec));
      setQrSession({
        qrId: data.qrId,
        imageUrl: data.imageUrl,
        qrImageDataUrl: data.qrImageDataUrl || null,
        amountPaise: data.amountPaise || Math.round(activeTotals.total * 100),
        closeBy,
        paymentMethod,
        status: 'awaiting_scan',
        errorMessage: null,
      });
    } catch (err) {
      const msg = extractReadableError(err, 'Unable to create UPI QR payment request.');
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setQrGenerating(false);
    }
  };

  const pollQrPaymentStatus = useCallback(
    async (qrId: string, manualCheck = false) => {
      if (!user || placingVerifiedQrRef.current) return;
      if (manualCheck) setQrPollingNow(true);
      try {
        const idToken = await user.getIdToken();
        const resp = await fetch(`/api/payments/razorpay/qr-status/${encodeURIComponent(qrId)}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = (await resp.json().catch(() => ({}))) as {
          status?: 'waiting' | 'paid' | 'failed' | 'expired';
          verified?: boolean;
          razorpayOrderId?: string;
          razorpayPaymentId?: string;
          closeBy?: number;
          serverNow?: number;
          error?: string;
        };

        if (activeQrIdRef.current !== qrId) return;

        if (data.status === 'paid' && data.verified && data.razorpayPaymentId) {
          if (
            placingVerifiedQrRef.current ||
            consumedPaymentIdsRef.current.has(data.razorpayPaymentId)
          ) {
            return;
          }
          placingVerifiedQrRef.current = true;
          consumedPaymentIdsRef.current.add(data.razorpayPaymentId);
          setQrSession((prev) =>
            prev && prev.qrId === qrId ? { ...prev, status: 'verifying', errorMessage: null } : prev
          );

          const emailClean = customerEmail.trim();
          const pinClean = postalCode.trim();
          const created = await placeOrder({
            customerName,
            customerEmail: emailClean,
            customerPhone,
            shippingAddress: {
              street,
              city,
              state: stateName,
              postalCode: pinClean,
            },
            paymentMethod,
            promoCode: appliedPromo,
            razorpayOrderId: data.razorpayOrderId || qrId,
            razorpayPaymentId: data.razorpayPaymentId,
          });
          activeQrIdRef.current = null;
          setQrSession(null);
          void persistAddressIfRequested(pinClean);
          setConfirmedOrder(created);
          return;
        }

        if (data.status === 'failed') {
          setQrSession((prev) =>
            prev && prev.qrId === qrId
              ? {
                  ...prev,
                  status: 'failed',
                  errorMessage: data.error || 'UPI payment failed. Generate a new QR code to retry.',
                }
              : prev
          );
          return;
        }

        if (data.status === 'expired') {
          setQrSecondsLeft(0);
          setQrSession((prev) =>
            prev && prev.qrId === qrId
              ? {
                  ...prev,
                  status: 'expired',
                  errorMessage: data.error || 'This UPI QR code has expired.',
                }
              : prev
          );
          return;
        }

        if (manualCheck && data.status === 'waiting') {
          showToast('Waiting for your UPI app confirmation...', 'info');
        }
      } catch {
        if (manualCheck) {
          showToast('Could not reach gateway right now; automatic check continues.', 'error');
        }
      } finally {
        if (manualCheck) setQrPollingNow(false);
      }
    },
    [
      user,
      customerEmail,
      postalCode,
      placeOrder,
      customerName,
      customerPhone,
      street,
      city,
      stateName,
      paymentMethod,
      appliedPromo,
      persistAddressIfRequested,
      showToast,
    ]
  );

  // Automatic 2.5s polling & 1s countdown clock while QR is active
  useEffect(() => {
    if (!qrSession || qrSession.status !== 'awaiting_scan') return;
    const currentQrId = qrSession.qrId;

    const pollTimer = window.setInterval(() => {
      void pollQrPaymentStatus(currentQrId, false);
    }, 2500);

    const countdownTimer = window.setInterval(() => {
      const remaining = Math.max(0, qrSession.closeBy - Math.floor(Date.now() / 1000));
      setQrSecondsLeft(remaining);
      if (remaining === 0) {
        setQrSession((prev) =>
          prev && prev.qrId === currentQrId && prev.status === 'awaiting_scan'
            ? {
                ...prev,
                status: 'expired',
                errorMessage: 'This UPI QR code has expired. Generate a fresh QR code to continue.',
              }
            : prev
        );
      }
    }, 1000);

    return () => {
      window.clearInterval(pollTimer);
      window.clearInterval(countdownTimer);
    };
  }, [qrSession, pollQrPaymentStatus]);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || qrGenerating) return;
    setFormError(null);

    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    const validation = validateDeliveryDetails();
    if (!validation.ok) {
      surfaceValidationError(validation.error);
      return;
    }

    if (paymentMethod === 'cod') {
      submittingRef.current = true;
      setSubmitting(true);
      try {
        const created = await placeOrder({
          customerName,
          customerEmail: validation.emailClean,
          customerPhone,
          shippingAddress: {
            street,
            city,
            state: stateName,
            postalCode: validation.pinClean,
          },
          paymentMethod: 'cod',
          promoCode: appliedPromo,
        });
        void persistAddressIfRequested(validation.pinClean);
        setConfirmedOrder(created);
      } catch (err) {
        const msg = extractReadableError(err, 'Unable to place COD order.');
        setFormError(msg);
        showToast(msg, 'error');
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
      return;
    }

    if (shouldUseQrFlow) {
      await generateUpiQrSession();
      return;
    }

    await launchStandardRazorpayCheckout(paymentMethod);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-20">
      <button
        type="button"
        onClick={() => navigateTo('catalog')}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#5C5B57] hover:text-[#141416] mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Catalog</span>
      </button>

      <h1 className="font-display text-3xl font-bold text-[#141416] mb-8">Checkout</h1>

      {!user ? (
        <div className="bg-white border border-black/10 rounded-2xl p-8 text-center max-w-lg mx-auto space-y-4">
          <Lock className="w-8 h-8 text-[#F97316] mx-auto" />
          <h2 className="font-display text-xl font-bold text-[#141416]">
            Sign in to complete your order
          </h2>
          <p className="text-sm text-[#5C5B57]">
            Your bag items are saved. Sign in with Google or your Gmail account to place and track
            your order securely.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigateTo('signin')}
              className="px-6 py-3 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold cursor-pointer"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => navigateTo('signup')}
              className="px-6 py-3 rounded-lg border border-black/15 bg-white hover:bg-[#F3EFE9] text-[#141416] text-sm font-semibold cursor-pointer"
            >
              Create Account
            </button>
          </div>
        </div>
      ) : !emailVerified && !isAdmin ? (
        <EmailVerificationGate featureLabel="checkout & Razorpay payments" />
      ) : (
        <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start" noValidate>
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Delivery Info + Saved Address Quick Picker */}
            <div
              ref={deliverySectionRef}
              className="bg-white border border-black/8 rounded-2xl p-6 sm:p-8 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-[#141416]">
                  01. Customer & Delivery Details
                </h2>
                {savedAddresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => navigateTo('profile')}
                    className="text-xs font-semibold text-[#EA580C] hover:underline cursor-pointer"
                  >
                    Manage Addresses
                  </button>
                )}
              </div>

              {savedAddresses.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[#5C5B57]">
                    Saved Delivery Addresses (click to autofill)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {savedAddresses.map((addr) => {
                      const active = selectedAddressId === addr.id;
                      return (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => applySavedAddress(addr)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            active
                              ? 'border-[#F97316] bg-[#F97316]/6'
                              : 'border-black/10 bg-[#FAF8F5] hover:bg-[#F3EFE9]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-bold text-[#141416]">{addr.label}</span>
                            {addr.isDefault && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#EA580C]">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#141416] font-medium truncate">
                            {addr.recipientName}
                          </p>
                          <p className="text-[11px] text-[#5C5B57] truncate">
                            {addr.street}, {addr.city} - {addr.postalCode}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {formError && (
                <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label htmlFor="checkout-full-name" className="block text-xs font-medium text-[#141416] mb-1">
                    Full Name
                  </label>
                  <input
                    id="checkout-full-name"
                    name="customerName"
                    type="text"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={100}
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      markDeliveryEdited();
                    }}
                    placeholder="Priya Nair"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm focus:bg-white focus:outline-none focus:border-[#F97316]"
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="checkout-email" className="block text-xs font-medium text-[#141416] mb-1">
                    Email Address
                  </label>
                  <input
                    id="checkout-email"
                    name="customerEmail"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={200}
                    value={customerEmail}
                    onChange={(e) => {
                      hasUserEditedDeliveryRef.current = true;
                      setCustomerEmail(e.target.value);
                    }}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm focus:bg-white focus:outline-none focus:border-[#F97316]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="checkout-phone" className="block text-xs font-medium text-[#141416] mb-1">
                  Mobile Number
                </label>
                <input
                  id="checkout-phone"
                  name="customerPhone"
                  type="tel"
                  autoComplete="tel"
                  required
                  minLength={10}
                  maxLength={24}
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    markDeliveryEdited();
                  }}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm focus:bg-white focus:outline-none focus:border-[#F97316]"
                />
              </div>

              <div>
                <label htmlFor="checkout-street" className="block text-xs font-medium text-[#141416] mb-1">
                  Delivery Address
                </label>
                <input
                  id="checkout-street"
                  name="street"
                  type="text"
                  autoComplete="street-address"
                  required
                  minLength={5}
                  maxLength={240}
                  value={street}
                  onChange={(e) => {
                    setStreet(e.target.value);
                    markDeliveryEdited();
                  }}
                  placeholder="42 Indiranagar 100 Feet Road, Apt 4B"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm focus:bg-white focus:outline-none focus:border-[#F97316]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="min-w-0">
                  <label htmlFor="checkout-city" className="block text-xs font-medium text-[#141416] mb-1">
                    City
                  </label>
                  <input
                    id="checkout-city"
                    name="city"
                    type="text"
                    autoComplete="address-level2"
                    required
                    minLength={2}
                    maxLength={80}
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      markDeliveryEdited();
                    }}
                    placeholder="Bengaluru"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm focus:bg-white focus:outline-none focus:border-[#F97316]"
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="checkout-state" className="block text-xs font-medium text-[#141416] mb-1">
                    State
                  </label>
                  <input
                    id="checkout-state"
                    name="state"
                    type="text"
                    autoComplete="address-level1"
                    required
                    minLength={2}
                    maxLength={80}
                    value={stateName}
                    onChange={(e) => {
                      setStateName(e.target.value);
                      markDeliveryEdited();
                    }}
                    placeholder="Karnataka"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm focus:bg-white focus:outline-none focus:border-[#F97316]"
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="checkout-postal-code" className="block text-xs font-medium text-[#141416] mb-1">
                    PIN Code
                  </label>
                  <input
                    id="checkout-postal-code"
                    name="postalCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    required
                    minLength={6}
                    maxLength={6}
                    value={postalCode}
                    aria-invalid={Boolean(pinError)}
                    onChange={(e) => {
                      const { value, hadInvalidChars } = normalizeIndianPinInput(e.target.value);
                      markDeliveryEdited();
                      setPostalCode(value);

                      if (hadInvalidChars) {
                        setPinError('PIN code must contain numbers only (0–9).');
                      } else if (value.length === 0) {
                        setPinError(null);
                      } else if (value.length === 6) {
                        const err = validateIndianPinCode(value);
                        setPinError(err);
                        if (!err && formError) {
                          setFormError(null);
                        }
                      } else {
                        setPinError(null);
                      }
                    }}
                    onBlur={() => {
                      if (postalCode.length > 0) {
                        setPinError(validateIndianPinCode(postalCode));
                      }
                    }}
                    placeholder="560038"
                    className={`w-full px-3.5 py-2.5 rounded-lg border bg-[#FAF8F5] text-sm font-mono tracking-wider focus:bg-white focus:outline-none ${
                      pinError
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-black/12 focus:border-[#F97316]'
                    }`}
                  />
                  {pinError && (
                    <p className="text-[11px] text-red-700 mt-1 leading-snug" role="alert">
                      {pinError}
                    </p>
                  )}
                </div>
              </div>

              {!selectedAddressId && (
                <label className="flex items-center gap-2 text-xs text-[#5C5B57] cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={saveAddressChecked}
                    onChange={(e) => setSaveAddressChecked(e.target.checked)}
                    className="accent-[#F97316]"
                  />
                  <span>Save this delivery address to my NovaCart profile</span>
                </label>
              )}
            </div>

            {/* Step 2: 8 Payment Options OR Live Scannable UPI QR Terminal */}
            <div className="bg-white border border-black/8 rounded-2xl p-6 sm:p-8 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-[#141416]">
                  02. Payment Method
                </h2>
                <span className="text-[11px] font-medium text-[#5C5B57]">
                  {razorpayConfigured
                    ? razorpayMode === 'live'
                      ? 'Razorpay Live Gateway Ready'
                      : 'Razorpay Test Mode Ready'
                    : 'COD Instant · Razorpay Key Setup Needed for Online'}
                </span>
              </div>

              {qrSession ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-black/8">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#EA580C]">
                        Razorpay Live UPI QR
                      </p>
                      <h3 className="font-display text-lg font-bold text-[#141416]">
                        Scan &amp; Pay with {PAYMENT_LABELS[qrSession.paymentMethod]}
                      </h3>
                      <p className="text-[11px] font-mono text-[#5C5B57] mt-0.5">
                        QR Ref: {qrSession.qrId}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        className={`inline-flex items-center gap-1.5 text-xs font-mono font-semibold tabular-nums ${
                          qrSecondsLeft <= 120 ? 'text-amber-700' : 'text-[#141416]'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          Expires in {String(Math.floor(qrSecondsLeft / 60)).padStart(2, '0')}:
                          {String(qrSecondsLeft % 60).padStart(2, '0')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCancelQrSession}
                        className="px-3 py-1.5 rounded-lg border border-black/15 text-xs font-semibold text-[#141416] hover:bg-[#FAF8F5] cursor-pointer"
                      >
                        Change Method
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    {/* Scannable QR Display Stage */}
                    <div className="md:col-span-6 flex flex-col items-center justify-center p-5 rounded-xl bg-[#FAF8F5] border border-black/10 text-center space-y-3">
                      <div className="p-3 bg-white rounded-xl border border-black/10 shadow-xs inline-flex items-center justify-center">
                        {!qrImageLoadFailed ? (
                          <img
                            src={qrSession.qrImageDataUrl || qrSession.imageUrl}
                            alt={`Razorpay UPI QR code for ${formatINR(qrSession.amountPaise / 100)}`}
                            referrerPolicy="no-referrer"
                            onError={() => setQrImageLoadFailed(true)}
                            className="w-56 h-56 object-contain rounded-lg"
                          />
                        ) : (
                          <iframe
                            src={qrSession.imageUrl}
                            title="Razorpay UPI QR Code"
                            className="w-60 h-72 border-0 rounded-lg bg-white"
                          />
                        )}
                      </div>

                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-[#5C5B57]">
                          Exact Payable Amount
                        </p>
                        <p className="font-display text-2xl font-bold text-[#141416] tabular-nums">
                          {formatINR(qrSession.amountPaise / 100)}
                        </p>
                      </div>

                      <p className="text-[11px] text-[#5C5B57]">
                        PhonePe · Google Pay · Paytm · BHIM · Any UPI App
                      </p>

                      {qrImageLoadFailed && (
                        <a
                          href={qrSession.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#EA580C] hover:underline"
                        >
                          <span>Open Razorpay QR Page</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {/* Status, Instructions & Retry Controls */}
                    <div className="md:col-span-6 space-y-4">
                      {qrSession.status === 'awaiting_scan' && (
                        <div className="p-4 rounded-xl bg-[#FAF8F5] border border-black/10 flex items-start gap-3">
                          <Loader2 className="w-4 h-4 animate-spin text-[#F97316] shrink-0 mt-0.5" />
                          <div className="text-xs space-y-1">
                            <p className="font-semibold text-[#141416]">
                              Waiting for payment confirmation...
                            </p>
                            <p className="text-[#5C5B57] leading-relaxed">
                              Scan the QR code with your UPI app and approve the payment. Your
                              NovaCart order confirms automatically once Razorpay verifies funds.
                            </p>
                          </div>
                        </div>
                      )}

                      {qrSession.status === 'verifying' && (
                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-700 shrink-0 mt-0.5" />
                          <div className="text-xs space-y-1">
                            <p className="font-semibold text-emerald-900">
                              Payment verified — creating order...
                            </p>
                            <p className="text-emerald-800">
                              Reserving inventory and issuing your confirmation receipt.
                            </p>
                          </div>
                        </div>
                      )}

                      {qrSession.status === 'failed' && (
                        <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-2 text-xs text-red-900">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold">UPI Payment Failed</p>
                              <p className="mt-0.5 text-red-800">
                                {qrSession.errorMessage ||
                                  'Authorization did not succeed. Generate a fresh QR code or try another method.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {qrSession.status === 'expired' && (
                        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-xs text-amber-950">
                          <div className="flex items-start gap-2">
                            <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold">QR Code Expired</p>
                              <p className="mt-0.5 text-amber-900">
                                {qrSession.errorMessage ||
                                  'This single-use QR code has expired. Generate a new QR code to continue.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <ol className="text-xs text-[#5C5B57] space-y-2 bg-white border border-black/8 rounded-xl p-4">
                        <li className="flex items-start gap-2">
                          <span className="font-mono font-bold text-[#141416]">01.</span>
                          <span>Open PhonePe, Google Pay, Paytm, or any UPI app on your phone.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="font-mono font-bold text-[#141416]">02.</span>
                          <span>Tap &ldquo;Scan any QR&rdquo; and point your camera at this Razorpay QR code.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="font-mono font-bold text-[#141416]">03.</span>
                          <span>
                            Confirm the exact payable amount ({formatINR(qrSession.amountPaise / 100)})
                            and enter your UPI PIN.
                          </span>
                        </li>
                      </ol>

                      <div className="flex flex-col gap-2.5">
                        {qrSession.status === 'awaiting_scan' ? (
                          <button
                            type="button"
                            disabled={qrPollingNow}
                            onClick={() => void pollQrPaymentStatus(qrSession.qrId, true)}
                            className="w-full py-2.5 px-4 rounded-lg bg-[#141416] hover:bg-[#27272A] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                          >
                            {qrPollingNow ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            <span>I&apos;ve Paid — Check Status Now</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={qrGenerating}
                            onClick={() => void generateUpiQrSession()}
                            className="w-full py-2.5 px-4 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                          >
                            {qrGenerating ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            <span>Generate Fresh UPI QR Code</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const methodCopy = qrSession.paymentMethod;
                            handleCancelQrSession();
                            setUpiFlowMode('checkout');
                            void launchStandardRazorpayCheckout(methodCopy);
                          }}
                          className="w-full py-2.5 px-4 rounded-lg border border-black/15 bg-white hover:bg-[#FAF8F5] text-[#141416] text-xs font-semibold cursor-pointer"
                        >
                          Pay via UPI ID / App Intent (Razorpay Checkout)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PAYMENT_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const selected = paymentMethod === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            setPaymentMethod(option.id);
                            setFormError(null);
                            if (option.id === 'upi') {
                              setUpiFlowMode(qrApiAvailable ? 'qr' : 'checkout');
                            } else if (
                              option.id === 'gpay' ||
                              option.id === 'phonepe' ||
                              option.id === 'paytm'
                            ) {
                              setUpiFlowMode(
                                !qrApiAvailable || isMobileViewport ? 'checkout' : 'qr'
                              );
                            }
                          }}
                          className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                            selected
                              ? 'border-[#F97316] bg-[#F97316]/6 shadow-xs'
                              : 'border-black/10 bg-[#FAF8F5]/60 hover:bg-[#FAF8F5]'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              selected
                                ? 'bg-[#F97316] text-white'
                                : 'bg-white text-[#141416] border border-black/10'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#141416]">{option.label}</p>
                            <p className="text-[11px] text-[#5C5B57] leading-snug mt-0.5">
                              {option.subtitle}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {isUpiCapableMethod && razorpayConfigured !== false && (
                    qrApiAvailable ? (
                      <div className="p-4 rounded-xl bg-[#FAF8F5] border border-black/10 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-[#141416] flex items-center gap-1.5">
                            <QrCode className="w-4 h-4 text-[#F97316]" />
                            <span>Choose how to authorize {PAYMENT_LABELS[paymentMethod]}</span>
                          </p>
                          {razorpayMode === 'test' && (
                            <span className="text-[11px] font-mono text-[#5C5B57]">
                              Test Mode · Razorpay QR &amp; Checkout
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setUpiFlowMode('qr')}
                            className={`p-3 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                              upiFlowMode === 'qr'
                                ? 'border-[#F97316] bg-white text-[#141416]'
                                : 'border-black/10 bg-white/60 text-[#5C5B57] hover:bg-white'
                            }`}
                          >
                            <p className="font-semibold text-[#141416]">Scannable UPI QR Code</p>
                            <p className="text-[11px] text-[#5C5B57] mt-0.5">
                              Displays a live Razorpay QR right here to scan with PhonePe, GPay, or Paytm.
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => setUpiFlowMode('checkout')}
                            className={`p-3 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                              upiFlowMode === 'checkout'
                                ? 'border-[#F97316] bg-white text-[#141416]'
                                : 'border-black/10 bg-white/60 text-[#5C5B57] hover:bg-white'
                            }`}
                          >
                            <p className="font-semibold text-[#141416]">
                              UPI App Intent / UPI ID
                            </p>
                            <p className="text-[11px] text-[#5C5B57] mt-0.5">
                              Opens Razorpay Checkout (use <code className="font-mono">success@razorpay</code>{' '}
                              in Test Mode or mobile app intent).
                            </p>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs text-[#5C5B57] space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-[#141416] flex items-center gap-1.5">
                            <QrCode className="w-4 h-4 text-[#F97316]" />
                            <span>
                              Razorpay Checkout — {PAYMENT_LABELS[paymentMethod]} &amp; UPI QR Ready
                            </span>
                          </p>
                          {razorpayMode === 'test' && (
                            <span className="text-[11px] font-mono text-[#5C5B57]">
                              Test Mode Active
                            </span>
                          )}
                        </div>
                        <p className="leading-relaxed">
                          {isMobileViewport
                            ? 'Clicking Pay opens Razorpay Encrypted Checkout so you can approve directly via PhonePe, Google Pay, Paytm, or your installed UPI app.'
                            : 'Clicking Pay opens Razorpay Encrypted Checkout with built-in UPI QR Code and UPI ID authorization (use '}
                          {!isMobileViewport && (
                            <>
                              <code className="font-mono bg-white border border-black/10 px-1.5 py-0.5 rounded text-[#141416]">
                                success@razorpay
                              </code>
                              {' in Test Mode).'}
                            </>
                          )}
                        </p>
                      </div>
                    )
                  )}

                  {isOnlineMethod && !isUpiCapableMethod && razorpayConfigured === true && razorpayMode === 'test' && (
                    <div className="p-4 rounded-xl bg-[#FAF8F5] border border-black/10 text-xs text-[#5C5B57] space-y-1.5">
                      <p className="font-semibold text-[#141416]">
                        Razorpay Test Mode — {PAYMENT_LABELS[paymentMethod]} Ready
                      </p>
                      <p className="leading-relaxed">
                        Clicking Pay opens Razorpay&apos;s encrypted checkout for{' '}
                        {PAYMENT_LABELS[paymentMethod]}. Orders confirm only after server-side
                        HMAC-SHA256 verification.
                      </p>
                    </div>
                  )}

                  {isOnlineMethod && razorpayConfigured === false && (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-xs text-amber-950">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div className="space-y-1.5">
                          <p className="font-semibold">
                            Razorpay Test Mode keys are not configured in server secrets yet
                          </p>
                          <p className="leading-relaxed text-amber-900">
                            To process {PAYMENT_LABELS[paymentMethod]} or generate live UPI QR codes,
                            add <code className="font-mono bg-amber-100 px-1 rounded">RAZORPAY_KEY_ID</code>{' '}
                            (starts with <code className="font-mono bg-amber-100 px-1 rounded">rzp_test_</code>) and{' '}
                            <code className="font-mono bg-amber-100 px-1 rounded">RAZORPAY_KEY_SECRET</code>{' '}
                            in AI Studio Secrets (plus optional{' '}
                            <code className="font-mono bg-amber-100 px-1 rounded">RAZORPAY_WEBHOOK_SECRET</code>).
                            Cash on Delivery works immediately without gateway keys.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentMethod('cod');
                              setFormError(null);
                            }}
                            className="mt-1 px-3 py-1.5 rounded-lg bg-[#141416] text-white text-[11px] font-semibold cursor-pointer"
                          >
                            Switch to Cash on Delivery
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex items-start gap-2 text-xs text-[#5C5B57] pt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  NovaCart never collects or stores UPI PINs, card CVVs, or banking passwords. Online
                  payments &amp; UPI QR requests verify directly with Razorpay server-side before
                  confirming orders or adjusting inventory.
                </span>
              </div>
            </div>
          </div>

          <aside className="lg:col-span-5 bg-white border border-black/8 rounded-2xl p-6 sm:p-8 space-y-6 lg:sticky lg:top-24">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[#141416]">Order Summary</h2>
              {quoting && <Loader2 className="w-4 h-4 animate-spin text-[#F97316]" />}
            </div>

            <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
              {enrichedCart.map(({ product, quantity }) => (
                <div key={product.id} className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#F3EFE9] shrink-0">
                    <ProductImage src={product.imageUrl} alt={product.title} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#141416] truncate">{product.title}</p>
                    <p className="text-xs text-[#5C5B57] tabular-nums">Qty {quantity}</p>
                  </div>
                  <p className="text-sm font-semibold text-[#141416] tabular-nums">
                    {formatINR(product.price * quantity)}
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-black/8 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-medium text-[#5C5B57]">
                  Promotional Offer / Coupon Code
                </label>
                {appliedPromo && (
                  <button
                    type="button"
                    disabled={Boolean(
                      qrSession &&
                        (qrSession.status === 'awaiting_scan' || qrSession.status === 'verifying')
                    )}
                    onClick={() => {
                      if (qrSession) handleCancelQrSession();
                      setPromoInput('');
                      void fetchQuote('');
                    }}
                    className="text-[11px] font-semibold text-[#5C5B57] hover:text-[#141416] cursor-pointer disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 text-[#5C5B57] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={promoInput}
                    disabled={Boolean(
                      qrSession &&
                        (qrSession.status === 'awaiting_scan' || qrSession.status === 'verifying')
                    )}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    placeholder="Enter code"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-black/12 bg-[#FAF8F5] text-xs font-mono uppercase focus:bg-white focus:outline-none focus:border-[#F97316] disabled:opacity-60"
                  />
                </div>
                <button
                  type="button"
                  disabled={Boolean(
                    qrSession &&
                      (qrSession.status === 'awaiting_scan' || qrSession.status === 'verifying')
                  )}
                  onClick={() => {
                    if (qrSession) handleCancelQrSession();
                    void fetchQuote(promoInput);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#141416] text-white text-xs font-semibold hover:bg-[#27272A] cursor-pointer disabled:opacity-60"
                >
                  Apply
                </button>
              </div>
              {availableCheckoutOffers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {availableCheckoutOffers.slice(0, 4).map((offer) => {
                    const isApplied = appliedPromo === offer.code;
                    return (
                      <button
                        key={offer.id}
                        type="button"
                        disabled={Boolean(
                          qrSession &&
                            (qrSession.status === 'awaiting_scan' ||
                              qrSession.status === 'verifying')
                        )}
                        onClick={() => {
                          if (qrSession) handleCancelQrSession();
                          setPromoInput(offer.code);
                          void fetchQuote(offer.code);
                        }}
                        className={`px-2.5 py-1 rounded border text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                          isApplied
                            ? 'border-[#F97316] bg-[#F97316]/10 text-[#EA580C]'
                            : 'border-black/12 bg-[#FAF8F5] hover:bg-[#F3EFE9] text-[#141416]'
                        }`}
                        title={offer.description}
                      >
                        <span className="font-mono font-bold">{offer.code}</span> ·{' '}
                        <span>{formatOfferBenefit(offer)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {promoFeedback && (
                <p className="text-xs text-[#EA580C] font-medium">{promoFeedback}</p>
              )}
            </div>

            <div className="pt-4 border-t border-black/8 space-y-2 text-sm">
              <div className="flex justify-between text-[#5C5B57]">
                <span>Subtotal</span>
                <span className="tabular-nums text-[#141416] font-medium">
                  {formatINR(activeTotals.subtotal)}
                </span>
              </div>
              {activeTotals.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Promo Discount ({appliedPromo})</span>
                  <span className="tabular-nums font-medium">
                    -{formatINR(activeTotals.discount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-[#5C5B57]">
                <span>Shipping</span>
                <span className="tabular-nums text-[#141416] font-medium">
                  {activeTotals.shippingFee === 0 ? 'Complimentary' : formatINR(activeTotals.shippingFee)}
                </span>
              </div>
              <div className="pt-3 border-t border-black/8 flex justify-between text-base font-bold text-[#141416]">
                <span>Final Amount</span>
                <span className="tabular-nums">{formatINR(activeTotals.total)}</span>
              </div>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={
                submitting ||
                qrGenerating ||
                Boolean(
                  qrSession &&
                    (qrSession.status === 'awaiting_scan' || qrSession.status === 'verifying')
                )
              }
              className="w-full py-3.5 px-5 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {(submitting || qrGenerating) && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {qrSession
                  ? qrSession.status === 'awaiting_scan'
                    ? 'Awaiting UPI QR Confirmation...'
                    : qrSession.status === 'verifying'
                    ? 'Verifying Payment...'
                    : 'Regenerate QR Code'
                  : qrGenerating
                  ? 'Generating Razorpay UPI QR...'
                  : submitting
                  ? isOnlineMethod
                    ? 'Authorizing Payment...'
                    : 'Confirming Order...'
                  : shouldUseQrFlow
                  ? `Generate UPI QR & Pay · ${formatINR(activeTotals.total)}`
                  : isOnlineMethod
                  ? `Pay via ${PAYMENT_LABELS[paymentMethod]} · ${formatINR(activeTotals.total)}`
                  : `Confirm COD Order · ${formatINR(activeTotals.total)}`}
              </span>
            </button>
          </aside>
        </form>
      )}
    </div>
  );
}
