import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Heart,
  KeyRound,
  Lock,
  LogOut,
  MailCheck,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  User,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { extractReadableError } from '../lib/firestoreError';
import { formatINR, formatOrderDateTime } from '../lib/format';
import {
  coerceStoredPinCode,
  normalizeIndianPinInput,
  validateIndianPinCode,
} from '../lib/pinCode';
import type { SavedAddress } from '../types';
import { EmailVerificationGate } from './EmailVerificationGate';
import { ProductImage } from './ProductImage';

interface AddressFormState {
  id?: string;
  label: string;
  recipientName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  isDefault: boolean;
}

const EMPTY_ADDRESS_FORM: AddressFormState = {
  label: 'Home',
  recipientName: '',
  phone: '',
  street: '',
  city: '',
  state: '',
  postalCode: '',
  isDefault: false,
};

export function ProfileView() {
  const {
    user,
    authReady,
    emailVerified,
    isAdmin,
    userProfile,
    savedAddresses,
    wishlistIds,
    wishlistCount,
    products,
    orders,
    logout,
    updateProfileInfo,
    saveAddress,
    deleteAddress,
    setDefaultAddress,
    sendPasswordReset,
    openProduct,
    openOrderTracking,
    navigateTo,
    showToast,
  } = useStore();

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [addrForm, setAddrForm] = useState<AddressFormState>(EMPTY_ADDRESS_FORM);
  const [addrPinError, setAddrPinError] = useState<string | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [confirmDeleteAddrId, setConfirmDeleteAddrId] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setPhone(userProfile.phone || '');
    }
  }, [userProfile]);

  const savedWishlistPreview = useMemo(
    () =>
      wishlistIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .slice(0, 3),
    [wishlistIds, products]
  );

  if (!authReady) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6 animate-pulse">
        <div className="h-16 bg-black/8 rounded-xl" />
        <div className="h-80 bg-white border border-black/8 rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <Lock className="w-8 h-8 text-[#F97316] mx-auto" />
        <h1 className="font-display text-2xl font-bold text-[#141416]">Customer Account</h1>
        <p className="text-sm text-[#5C5B57]">
          Sign in to manage your personal details, saved delivery addresses, orders, and wishlist.
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
    return <EmailVerificationGate featureLabel="your profile & saved addresses" />;
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (displayName.trim().length < 2) {
      showToast('Please enter a display name of at least 2 characters.', 'error');
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfileInfo({
        displayName,
        phone,
        street: userProfile?.street || '',
        city: userProfile?.city || '',
        state: userProfile?.state || '',
        postalCode: userProfile?.postalCode || '',
      });
    } catch (err) {
      showToast(extractReadableError(err, 'Unable to save profile.'), 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const openNewAddressForm = () => {
    setAddrPinError(null);
    setAddrForm({
      ...EMPTY_ADDRESS_FORM,
      label: savedAddresses.length === 0 ? 'Home' : 'Work',
      recipientName: userProfile?.displayName || user.displayName || '',
      phone: userProfile?.phone || phone || '',
      isDefault: savedAddresses.length === 0,
    });
    setAddressFormOpen(true);
  };

  const openEditAddressForm = (addr: SavedAddress) => {
    setAddrPinError(null);
    setAddrForm({
      id: addr.id,
      label: addr.label,
      recipientName: addr.recipientName,
      phone: addr.phone,
      street: addr.street,
      city: addr.city,
      state: addr.state,
      postalCode: coerceStoredPinCode(addr.postalCode),
      isDefault: addr.isDefault,
    });
    setAddressFormOpen(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addrForm.recipientName.trim().length < 2) {
      showToast('Please enter recipient full name.', 'error');
      return;
    }
    if (addrForm.phone.replace(/\D/g, '').length < 10) {
      showToast('Please enter a valid 10-digit phone number.', 'error');
      return;
    }
    if (addrForm.street.trim().length < 5 || addrForm.city.trim().length < 2 || addrForm.state.trim().length < 2) {
      showToast('Please complete street, city, and state fields.', 'error');
      return;
    }
    const pinValidationError = validateIndianPinCode(addrForm.postalCode);
    if (pinValidationError) {
      setAddrPinError(pinValidationError);
      showToast(pinValidationError, 'error');
      return;
    }
    setAddrPinError(null);

    setSavingAddress(true);
    try {
      await saveAddress(addrForm);
      setAddressFormOpen(false);
    } catch (err) {
      showToast(extractReadableError(err, 'Unable to save delivery address.'), 'error');
    } finally {
      setSavingAddress(false);
    }
  };

  const initials = (userProfile?.displayName || user.displayName || user.email || 'NC')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-20 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-black/8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#141416] text-white font-display font-bold text-lg flex items-center justify-center shrink-0">
            {initials || <User className="w-6 h-6 text-[#F97316]" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#141416]">
                {userProfile?.displayName || user.displayName || 'NovaCart Shopper'}
              </h1>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold ${
                  isAdmin
                    ? 'bg-[#F97316]/12 text-[#EA580C]'
                    : 'bg-[#F3EFE9] text-[#141416]'
                }`}
              >
                {isAdmin && <ShieldCheck className="w-3 h-3" />}
                {isAdmin ? 'Store Administrator' : 'Customer Account'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C5B57] mt-1">
              <span>{user.email}</span>
              {phone && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{phone}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              {emailVerified ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Email Verified
                </span>
              ) : (
                <span className="text-amber-700 font-medium">Email Unverified</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigateTo('admin')}
              className="px-4 py-2 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold cursor-pointer"
            >
              Open Admin Console
            </button>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-black/12 bg-white hover:bg-[#F3EFE9] text-xs font-semibold text-[#141416] cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => navigateTo('orders')}
          className="text-left bg-white border border-black/8 hover:border-[#F97316]/50 rounded-xl p-5 flex items-center justify-between transition-colors cursor-pointer"
        >
          <div>
            <p className="text-xs text-[#5C5B57]">My Orders</p>
            <p className="font-display text-xl font-bold text-[#141416] mt-0.5 tabular-nums">
              {orders.length} {orders.length === 1 ? 'order' : 'orders'}
            </p>
          </div>
          <Package className="w-5 h-5 text-[#F97316]" />
        </button>

        <button
          type="button"
          onClick={() => navigateTo('wishlist')}
          className="text-left bg-white border border-black/8 hover:border-[#F97316]/50 rounded-xl p-5 flex items-center justify-between transition-colors cursor-pointer"
        >
          <div>
            <p className="text-xs text-[#5C5B57]">Saved Wishlist</p>
            <p className="font-display text-xl font-bold text-[#141416] mt-0.5 tabular-nums">
              {wishlistCount} {wishlistCount === 1 ? 'item' : 'items'}
            </p>
          </div>
          <Heart className="w-5 h-5 text-[#F97316]" />
        </button>

        <div className="bg-white border border-black/8 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#5C5B57]">Saved Addresses</p>
            <p className="font-display text-xl font-bold text-[#141416] mt-0.5 tabular-nums">
              {savedAddresses.length} {savedAddresses.length === 1 ? 'address' : 'addresses'}
            </p>
          </div>
          <MapPin className="w-5 h-5 text-[#F97316]" />
        </div>
      </div>

      {/* Personal Information & Security */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSaveProfile}
          className="lg:col-span-8 bg-white border border-black/8 rounded-2xl p-6 sm:p-7 space-y-5"
        >
          <div>
            <h2 className="font-display text-lg font-bold text-[#141416]">Personal Information</h2>
            <p className="text-xs text-[#5C5B57] mt-0.5">
              Update your account display name and contact phone number.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#141416] mb-1">Full Name</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm focus:bg-white focus:outline-none focus:border-[#F97316]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#141416] mb-1">Phone Number</label>
              <input
                type="tel"
                maxLength={24}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3.5 py-2.5 rounded-lg border border-black/12 bg-[#FAF8F5] text-sm focus:bg-white focus:outline-none focus:border-[#F97316]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#141416] mb-1">Email Address</label>
            <input
              type="email"
              readOnly
              value={user.email || ''}
              className="w-full px-3.5 py-2.5 rounded-lg border border-black/8 bg-[#F3EFE9]/70 text-sm text-[#5C5B57]"
            />
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="px-5 py-2.5 rounded-lg bg-[#141416] hover:bg-[#27272A] text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {savingProfile ? 'Saving...' : 'Save Personal Details'}
          </button>
        </form>

        <div className="lg:col-span-4 bg-white border border-black/8 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#F97316]" />
            <h2 className="font-display text-base font-bold text-[#141416]">Account Settings</h2>
          </div>
          <p className="text-xs text-[#5C5B57] leading-relaxed">
            Need to update your login password? We&apos;ll email a secure reset link directly to{' '}
            <strong className="text-[#141416]">{user.email}</strong>.
          </p>
          <button
            type="button"
            onClick={() => {
              if (user.email) void sendPasswordReset(user.email);
            }}
            className="w-full py-2.5 px-4 rounded-lg border border-black/15 bg-[#FAF8F5] hover:bg-[#F3EFE9] text-xs font-semibold text-[#141416] cursor-pointer"
          >
            Send Password Reset Email
          </button>
        </div>
      </div>

      {/* Multiple Saved Delivery Addresses CRUD */}
      <section className="bg-white border border-black/8 rounded-2xl p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[#141416]">
              Saved Delivery Addresses
            </h2>
            <p className="text-xs text-[#5C5B57] mt-0.5">
              Save multiple home or office addresses for one-click selection at checkout.
            </p>
          </div>
          <button
            type="button"
            onClick={openNewAddressForm}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Address</span>
          </button>
        </div>

        {addressFormOpen && (
          <form
            onSubmit={handleSaveAddress}
            className="p-5 rounded-xl bg-[#FAF8F5] border border-black/10 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#141416]">
                {addrForm.id ? 'Edit Delivery Address' : 'New Delivery Address'}
              </h3>
              <button
                type="button"
                onClick={() => setAddressFormOpen(false)}
                className="text-xs text-[#5C5B57] hover:text-[#141416] cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-[#141416] mb-1">Label</label>
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={addrForm.label}
                  onChange={(e) => setAddrForm((s) => ({ ...s, label: e.target.value }))}
                  placeholder="Home, Work, Studio..."
                  className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-xs focus:outline-none focus:border-[#F97316]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#141416] mb-1">
                  Recipient Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={addrForm.recipientName}
                  onChange={(e) => setAddrForm((s) => ({ ...s, recipientName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-xs focus:outline-none focus:border-[#F97316]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#141416] mb-1">Phone</label>
                <input
                  type="tel"
                  required
                  maxLength={24}
                  value={addrForm.phone}
                  onChange={(e) => setAddrForm((s) => ({ ...s, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-xs focus:outline-none focus:border-[#F97316]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#141416] mb-1">
                Street & Building Address
              </label>
              <input
                type="text"
                required
                maxLength={240}
                value={addrForm.street}
                onChange={(e) => setAddrForm((s) => ({ ...s, street: e.target.value }))}
                placeholder="42 Indiranagar 100 Feet Road, Apt 4B"
                className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-xs focus:outline-none focus:border-[#F97316]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-[#141416] mb-1">City</label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={addrForm.city}
                  onChange={(e) => setAddrForm((s) => ({ ...s, city: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-xs focus:outline-none focus:border-[#F97316]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#141416] mb-1">State</label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={addrForm.state}
                  onChange={(e) => setAddrForm((s) => ({ ...s, state: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-black/12 bg-white text-xs focus:outline-none focus:border-[#F97316]"
                />
              </div>
              <div className="min-w-0">
                <label htmlFor="profile-postal-code" className="block text-xs font-medium text-[#141416] mb-1">
                  PIN Code
                </label>
                <input
                  id="profile-postal-code"
                  name="postalCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  required
                  minLength={6}
                  maxLength={6}
                  value={addrForm.postalCode}
                  aria-invalid={Boolean(addrPinError)}
                  onChange={(e) => {
                    const { value, hadInvalidChars } = normalizeIndianPinInput(e.target.value);
                    setAddrForm((s) => ({ ...s, postalCode: value }));
                    if (hadInvalidChars) {
                      setAddrPinError('PIN code must contain numbers only (0–9).');
                    } else if (value.length === 0) {
                      setAddrPinError(null);
                    } else if (value.length === 6) {
                      setAddrPinError(validateIndianPinCode(value));
                    } else {
                      setAddrPinError(null);
                    }
                  }}
                  onBlur={() => {
                    if (addrForm.postalCode.length > 0) {
                      setAddrPinError(validateIndianPinCode(addrForm.postalCode));
                    }
                  }}
                  placeholder="560038"
                  className={`w-full px-3 py-2 rounded-lg border bg-white text-xs font-mono tracking-wider focus:outline-none ${
                    addrPinError
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-black/12 focus:border-[#F97316]'
                  }`}
                />
                {addrPinError && (
                  <p className="text-[11px] text-red-700 mt-1 leading-snug" role="alert">
                    {addrPinError}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-[#141416] cursor-pointer">
                <input
                  type="checkbox"
                  checked={addrForm.isDefault}
                  onChange={(e) => setAddrForm((s) => ({ ...s, isDefault: e.target.checked }))}
                  className="accent-[#F97316]"
                />
                <span>Set as default delivery address</span>
              </label>

              <button
                type="submit"
                disabled={savingAddress}
                className="px-5 py-2 rounded-lg bg-[#141416] hover:bg-[#27272A] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
              >
                {savingAddress ? 'Saving...' : 'Save Address'}
              </button>
            </div>
          </form>
        )}

        {savedAddresses.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#FAF8F5] border border-dashed border-black/12 text-center text-xs text-[#5C5B57]">
            No delivery addresses saved yet. Add your home or work address above for faster checkout.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedAddresses.map((addr) => (
              <article
                key={addr.id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                  addr.isDefault ? 'border-[#F97316]/60 bg-[#FAF8F5]' : 'border-black/10 bg-white'
                }`}
              >
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#141416] uppercase tracking-wider text-[11px]">
                      {addr.label}
                    </span>
                    {addr.isDefault && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#EA580C]">
                        <Star className="w-3 h-3 fill-[#F97316] text-[#F97316]" />
                        Default
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-[#141416] text-sm">{addr.recipientName}</p>
                  <p className="text-[#5C5B57]">{addr.street}</p>
                  <p className="text-[#5C5B57]">
                    {addr.city}, {addr.state} — <span className="font-mono">{addr.postalCode}</span>
                  </p>
                  <p className="text-[#5C5B57]">{addr.phone}</p>
                </div>

                <div className="pt-3 border-t border-black/8 flex flex-wrap items-center justify-between gap-2 text-xs">
                  {!addr.isDefault ? (
                    <button
                      type="button"
                      onClick={() => void setDefaultAddress(addr.id)}
                      className="font-semibold text-[#EA580C] hover:underline cursor-pointer"
                    >
                      Set as Default
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-700 font-medium">
                      Active Checkout Default
                    </span>
                  )}

                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditAddressForm(addr)}
                      aria-label={`Edit ${addr.label} address`}
                      className="p-1.5 rounded-lg text-[#5C5B57] hover:text-[#141416] hover:bg-black/5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {confirmDeleteAddrId === addr.id ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            void deleteAddress(addr.id);
                            setConfirmDeleteAddrId(null);
                          }}
                          className="px-2 py-1 rounded bg-red-600 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteAddrId(null)}
                          className="px-2 py-1 rounded border border-black/15 text-[11px] cursor-pointer"
                        >
                          Keep
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteAddrId(addr.id)}
                        aria-label={`Delete ${addr.label} address`}
                        className="p-1.5 rounded-lg text-[#5C5B57] hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Recent Orders & Saved Wishlist Summaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-black/8 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#141416]">Recent Orders</h2>
            <button
              type="button"
              onClick={() => navigateTo('orders')}
              className="text-xs font-semibold text-[#EA580C] hover:underline cursor-pointer"
            >
              View All Orders
            </button>
          </div>

          {orders.length === 0 ? (
            <p className="text-xs text-[#5C5B57]">
              You haven&apos;t placed an order yet. Explore our 96+ products to start shopping.
            </p>
          ) : (
            <div className="space-y-2.5">
              {orders.slice(0, 3).map((ord) => (
                <button
                  key={ord.id}
                  type="button"
                  onClick={() => openOrderTracking(ord.id)}
                  className="w-full text-left p-3.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F3EFE9] border border-black/6 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-[#141416]">{ord.orderNumber}</p>
                    <p className="text-[11px] text-[#5C5B57] mt-0.5 truncate">
                      {formatOrderDateTime(ord.createdAt)} · {ord.status.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#141416] tabular-nums shrink-0">
                    {formatINR(ord.total)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-black/8 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#141416]">Wishlist Preview</h2>
            <button
              type="button"
              onClick={() => navigateTo('wishlist')}
              className="text-xs font-semibold text-[#EA580C] hover:underline cursor-pointer"
            >
              Open Wishlist
            </button>
          </div>

          {savedWishlistPreview.length === 0 ? (
            <p className="text-xs text-[#5C5B57]">
              Save your favorite electronics, outfits, or home essentials for quick access later.
            </p>
          ) : (
            <div className="space-y-2.5">
              {savedWishlistPreview.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openProduct(item.id)}
                  className="w-full text-left p-2.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F3EFE9] border border-black/6 flex items-center gap-3 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-10 rounded-lg overflow-hidden bg-white shrink-0">
                    <ProductImage src={item.imageUrl} alt={item.title} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#141416] truncate">{item.title}</p>
                    <p className="text-[11px] text-[#5C5B57] tabular-nums">{formatINR(item.price)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
