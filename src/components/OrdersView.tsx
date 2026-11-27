import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Lock,
  MapPin,
  Package,
  PackageCheck,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatINR, formatOrderDateTime } from '../lib/format';
import type { OrderRecord, OrderStatus } from '../types';
import { EmailVerificationGate } from './EmailVerificationGate';
import { ProductImage } from './ProductImage';

const STATUS_META: Record<
  OrderStatus,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pending: {
    label: 'Order Placed',
    className: 'text-amber-700 bg-amber-50 border-amber-200',
    icon: Clock,
  },
  confirmed: {
    label: 'Order Confirmed',
    className: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    icon: PackageCheck,
  },
  processing: {
    label: 'Processing',
    className: 'text-blue-700 bg-blue-50 border-blue-200',
    icon: Package,
  },
  shipped: {
    label: 'Shipped',
    className: 'text-[#EA580C] bg-orange-50 border-orange-200',
    icon: Truck,
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    className: 'text-[#EA580C] bg-orange-50 border-orange-200',
    icon: Truck,
  },
  delivered: {
    label: 'Delivered',
    className: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    icon: CheckCircle2,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'text-neutral-600 bg-neutral-100 border-neutral-200',
    icon: XCircle,
  },
};

const PAYMENT_LABELS: Record<string, string> = {
  cod: 'Cash on Delivery',
  upi: 'UPI',
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  netbanking: 'Net Banking',
  debit_card: 'Debit Card',
  credit_card: 'Credit Card',
};

const TIMELINE_STEPS: Array<{ status: OrderStatus; label: string }> = [
  { status: 'pending', label: 'Order Placed' },
  { status: 'confirmed', label: 'Order Confirmed' },
  { status: 'processing', label: 'Processing' },
  { status: 'shipped', label: 'Shipped' },
  { status: 'out_for_delivery', label: 'Out for Delivery' },
  { status: 'delivered', label: 'Delivered' },
];

export function OrdersView() {
  const {
    user,
    authReady,
    emailVerified,
    isAdmin,
    orders,
    ordersLoading,
    navigateTo,
    cancelOrder,
    trackedOrderId,
    setTrackedOrderId,
  } = useStore();
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);

  useEffect(() => {
    if (!trackedOrderId || orders.length === 0) return;
    const match = orders.find((o) => o.id === trackedOrderId);
    if (match) {
      setSelectedOrder(match);
      setTrackedOrderId(null);
    }
  }, [trackedOrderId, orders, setTrackedOrderId]);

  if (!authReady) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-4 animate-pulse">
        <div className="h-12 w-64 bg-black/8 rounded-lg" />
        <div className="h-48 bg-white border border-black/8 rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <Lock className="w-8 h-8 text-[#F97316] mx-auto" />
        <h1 className="font-display text-2xl font-bold text-[#141416]">Your Order History</h1>
        <p className="text-sm text-[#5C5B57]">
          Sign in to inspect your private orders, 6-step tracking updates, and itemized receipts.
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
    );
  }

  if (!emailVerified && !isAdmin) {
    return <EmailVerificationGate featureLabel="your order history & tracking" />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 border-b border-black/8 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#EA580C] mb-1">
            Private Order Ledger
          </p>
          <h1 className="font-display text-3xl font-bold text-[#141416]">Order History & Tracking</h1>
        </div>
        <p className="text-sm text-[#5C5B57] tabular-nums">
          {orders.length} {orders.length === 1 ? 'order' : 'orders'}
        </p>
      </div>

      {ordersLoading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div key={n} className="h-44 rounded-2xl bg-[#F3EFE9] animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-black/8 rounded-2xl p-12 text-center space-y-4">
          <Package className="w-8 h-8 text-[#5C5B57] mx-auto" />
          <h2 className="font-display text-xl font-semibold text-[#141416]">No orders yet</h2>
          <p className="text-sm text-[#5C5B57] max-w-md mx-auto">
            Once you complete checkout, your confirmed orders and 6-step delivery tracking will
            appear here.
          </p>
          <button
            type="button"
            onClick={() => navigateTo('catalog')}
            className="px-6 py-2.5 rounded-lg bg-[#141416] text-white text-sm font-semibold hover:bg-[#27272A] cursor-pointer"
          >
            Start Shopping
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const meta = STATUS_META[order.status] || STATUS_META.pending;
            const StatusIcon = meta.icon;
            const isPaidOnline = order.paymentStatus === 'paid';
            const canCancel = order.status === 'pending' || order.status === 'confirmed';

            return (
              <article
                key={order.id}
                className="bg-white border border-black/8 rounded-2xl overflow-hidden"
              >
                <div className="px-6 py-4 bg-[#FAF8F5] border-b border-black/8 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-5 text-xs text-[#5C5B57]">
                    <div>
                      <span className="block uppercase tracking-wider text-[10px]">Order ID</span>
                      <span className="font-mono font-semibold text-[#141416]">
                        {order.orderNumber}
                      </span>
                    </div>
                    <div>
                      <span className="block uppercase tracking-wider text-[10px]">Placed On</span>
                      <span className="font-medium text-[#141416]">
                        {formatOrderDateTime(order.createdAt)}
                      </span>
                    </div>
                    <div>
                      <span className="block uppercase tracking-wider text-[10px]">Payment</span>
                      <span className="font-medium text-[#141416]">
                        {PAYMENT_LABELS[order.paymentMethod] || 'Cash on Delivery'} ·{' '}
                        <span className={isPaidOnline ? 'text-emerald-700' : 'text-amber-700'}>
                          {isPaidOnline ? 'Paid' : 'Pay on Delivery'}
                        </span>
                      </span>
                    </div>
                    <div>
                      <span className="block uppercase tracking-wider text-[10px]">Total</span>
                      <span className="font-semibold text-[#141416] tabular-nums">
                        {formatINR(order.total)}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-semibold ${meta.className}`}
                  >
                    <StatusIcon className="w-3.5 h-3.5" />
                    <span>{meta.label}</span>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="space-y-3">
                    {order.items.map((item, idx) => (
                      <div key={`${order.id}-${item.productId}-${idx}`} className="flex items-center gap-4">
                        <div className="w-16 h-12 rounded-lg overflow-hidden bg-[#F3EFE9] shrink-0">
                          <ProductImage src={item.imageUrl} alt={item.title} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#141416] truncate">
                            {item.title}
                          </p>
                          <p className="text-xs text-[#5C5B57] tabular-nums">
                            Qty {item.quantity} · {formatINR(item.price)} each
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-[#141416] tabular-nums">
                          {formatINR(item.price * item.quantity)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-black/8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-[#5C5B57]">
                    <div>
                      <p>
                        Delivering to{' '}
                        <span className="text-[#141416] font-medium">{order.customerName}</span> ·{' '}
                        {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                        {order.shippingAddress.postalCode}
                      </p>
                      {order.estimatedDelivery && order.status !== 'cancelled' && (
                        <p className="text-[11px] text-[#5C5B57] mt-0.5">
                          Estimated Delivery: <span className="font-medium text-[#141416]">{order.estimatedDelivery}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[#F3EFE9] hover:bg-[#E7E0D6] text-[#141416] font-semibold transition-colors cursor-pointer"
                      >
                        <span>Track Order</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      {canCancel && (
                        <>
                          {confirmCancelId === order.id ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  void cancelOrder(order.id);
                                  setConfirmCancelId(null);
                                }}
                                className="px-3 py-1.5 rounded bg-red-600 text-white font-semibold cursor-pointer"
                              >
                                Confirm Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmCancelId(null)}
                                className="px-3 py-1.5 rounded border border-black/15 text-[#141416] font-medium cursor-pointer"
                              >
                                Keep
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmCancelId(order.id)}
                              className="px-3.5 py-1.5 rounded-lg border border-black/15 text-[#141416] font-semibold hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors cursor-pointer"
                            >
                              Cancel Order
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 6-Step Order Tracking & Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setSelectedOrder(null)}
          />
          <div className="relative z-10 w-full max-w-2xl bg-white border border-black/10 rounded-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto shadow-2xl space-y-6">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-black/8">
              <div>
                <p className="text-xs font-mono text-[#EA580C] font-semibold">
                  {selectedOrder.orderNumber}
                </p>
                <h2 className="font-display text-2xl font-bold text-[#141416]">
                  Order Tracking & Details
                </h2>
                <p className="text-xs text-[#5C5B57] mt-0.5">
                  Placed on {formatOrderDateTime(selectedOrder.createdAt)}
                  {selectedOrder.estimatedDelivery
                    ? ` · Est. Delivery ${selectedOrder.estimatedDelivery}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close order details"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#5C5B57] hover:bg-black/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedOrder.status !== 'cancelled' ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#5C5B57]">
                  6-Step Fulfillment Progress
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 pt-1">
                  {TIMELINE_STEPS.map((step, index) => {
                    const activeIdx = TIMELINE_STEPS.findIndex(
                      (s) => s.status === selectedOrder.status
                    );
                    const reached = activeIdx >= index;
                    const isCurrent = activeIdx === index;
                    return (
                      <div key={step.status} className="space-y-1.5">
                        <div
                          className={`h-2 rounded-full transition-colors ${
                            reached ? 'bg-[#F97316]' : 'bg-black/10'
                          }`}
                        />
                        <p
                          className={`text-[11px] leading-tight ${
                            isCurrent
                              ? 'font-bold text-[#EA580C]'
                              : reached
                              ? 'font-semibold text-[#141416]'
                              : 'text-[#5C5B57]'
                          }`}
                        >
                          {step.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-neutral-100 border border-neutral-200 text-xs font-semibold text-neutral-700">
                This order has been cancelled.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#FAF8F5] border border-black/8 rounded-xl p-4 text-xs">
              <div className="space-y-1">
                <p className="font-semibold text-[#141416] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#F97316]" />
                  Delivery Address
                </p>
                <p className="text-[#5C5B57]">{selectedOrder.customerName}</p>
                <p className="text-[#5C5B57]">{selectedOrder.shippingAddress.street}</p>
                <p className="text-[#5C5B57]">
                  {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state}{' '}
                  {selectedOrder.shippingAddress.postalCode}
                </p>
                <p className="text-[#5C5B57]">{selectedOrder.customerPhone}</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-[#141416]">Payment & Status</p>
                <p className="text-[#5C5B57]">
                  Method: {PAYMENT_LABELS[selectedOrder.paymentMethod] || 'Cash on Delivery'}
                </p>
                <p className="text-[#5C5B57]">
                  Payment:{' '}
                  <span
                    className={`font-semibold ${
                      selectedOrder.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {selectedOrder.paymentStatus === 'paid' ? 'Paid (Verified)' : 'Pay on Delivery'}
                  </span>
                </p>
                <p className="text-[#5C5B57]">Email: {selectedOrder.customerEmail}</p>
                {selectedOrder.razorpayPaymentId && (
                  <p className="text-[#5C5B57] font-mono">
                    Ref: {selectedOrder.razorpayPaymentId}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5C5B57]">
                Items Purchased
              </h3>
              {selectedOrder.items.map((item, idx) => (
                <div key={`${item.productId}-${idx}`} className="flex items-center gap-3.5">
                  <div className="w-14 h-12 rounded-lg overflow-hidden bg-[#F3EFE9] shrink-0">
                    <ProductImage src={item.imageUrl} alt={item.title} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#141416] truncate">{item.title}</p>
                    <p className="text-xs text-[#5C5B57] tabular-nums">
                      {formatINR(item.price)} × {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-[#141416] tabular-nums">
                    {formatINR(item.price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-black/8 space-y-1.5 text-sm">
              <div className="flex justify-between text-[#5C5B57]">
                <span>Subtotal</span>
                <span className="tabular-nums text-[#141416]">{formatINR(selectedOrder.subtotal)}</span>
              </div>
              {selectedOrder.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount</span>
                  <span className="tabular-nums">-{formatINR(selectedOrder.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#5C5B57]">
                <span>Shipping</span>
                <span className="tabular-nums text-[#141416]">
                  {selectedOrder.shippingFee === 0
                    ? 'Complimentary'
                    : formatINR(selectedOrder.shippingFee)}
                </span>
              </div>
              <div className="pt-2 border-t border-black/8 flex justify-between font-bold text-[#141416] text-base">
                <span>Total Amount</span>
                <span className="tabular-nums">{formatINR(selectedOrder.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
