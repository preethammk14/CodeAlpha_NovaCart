import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { EmailVerificationGate } from './EmailVerificationGate';
import { NovaCartLogo } from './NovaCartLogo';

interface AuthPagesProps {
  mode: 'signin' | 'signup' | 'forgot-password';
}

function computePasswordStrength(pw: string): { score: number; label: string; colorClass: string } {
  if (!pw) return { score: 0, label: '', colorClass: 'bg-black/10' };
  let score = 0;
  if (pw.length >= 6) score += 1;
  if (pw.length >= 10) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw) || /[^a-zA-Z0-9]/.test(pw)) score += 1;

  if (score <= 1) return { score: 1, label: 'Weak', colorClass: 'bg-red-500' };
  if (score === 2) return { score: 2, label: 'Fair', colorClass: 'bg-amber-500' };
  if (score === 3) return { score: 3, label: 'Good', colorClass: 'bg-emerald-500' };
  return { score: 4, label: 'Strong', colorClass: 'bg-emerald-600' };
}

function formatAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is disabled in Firebase Console. Sign in with Google above, or enable Email/Password under Firebase Console → Authentication → Sign-in method.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'Incorrect email or password. Please verify your details or reset your password.';
  }
  if (code === 'auth/user-not-found') {
    return 'No customer account found with this email address.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (code === 'auth/weak-password') {
    return 'Please choose a stronger password (minimum 6 characters).';
  }
  if (code === 'auth/invalid-email') {
    return 'Please enter a valid Gmail or email address.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts detected. Please wait a moment and try again.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in window was closed before completing.';
  }
  return err instanceof Error ? err.message : 'Authentication failed. Please try again.';
}

export function AuthPages({ mode }: AuthPagesProps) {
  const {
    user,
    authReady,
    emailVerified,
    isAdmin,
    userProfile,
    navigateTo,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    sendPasswordReset,
    logout,
  } = useStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const strength = useMemo(() => computePasswordStrength(password), [password]);

  if (!authReady) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="h-96 bg-white border border-black/8 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (user) {
    if (!emailVerified && !isAdmin) {
      return (
        <EmailVerificationGate
          featureLabel="your NovaCart customer account"
          onVerified={() => navigateTo('profile')}
        />
      );
    }

    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <div className="bg-white border border-black/8 rounded-2xl p-6 sm:p-8 text-center space-y-5 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-emerald-700" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#EA580C]">
              Active Session
            </p>
            <h1 className="font-display text-2xl font-bold text-[#141416]">
              Welcome, {userProfile?.displayName || user.displayName || 'NovaCart Shopper'}
            </h1>
            <p className="text-sm text-[#5C5B57]">{user.email}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigateTo(isAdmin ? 'admin' : 'profile')}
              className="flex-1 py-2.5 px-4 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold cursor-pointer"
            >
              {isAdmin ? 'Open Admin Dashboard' : 'Go to My Profile'}
            </button>
            <button
              type="button"
              onClick={() => navigateTo('catalog')}
              className="flex-1 py-2.5 px-4 rounded-lg bg-[#141416] hover:bg-[#27272A] text-white text-sm font-semibold cursor-pointer"
            >
              Browse Catalog
            </button>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5C5B57] hover:text-[#141416] cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out of this account</span>
          </button>
        </div>
      </div>
    );
  }

  const handleGoogle = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
      navigateTo('home');
    } catch (err) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg('Please enter a valid Gmail or email address.');
      return;
    }

    if (mode === 'signup') {
      if (name.trim().length < 2) {
        setErrorMsg('Please enter your full name (at least 2 characters).');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match. Please re-enter carefully.');
        return;
      }
      const phoneDigits = phone.replace(/\D/g, '');
      if (phone.trim().length > 0 && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
        setErrorMsg('Please enter a valid 10-digit mobile number or leave it blank.');
        return;
      }
    } else if (mode === 'signin') {
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters long.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(trimmedEmail, password, rememberMe);
        navigateTo('home');
      } else if (mode === 'signup') {
        await registerWithEmail(name, trimmedEmail, password, phone);
      } else {
        await sendPasswordReset(trimmedEmail);
        setResetSent(true);
      }
    } catch (err) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-20">
      <button
        type="button"
        onClick={() => navigateTo('home')}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#5C5B57] hover:text-[#141416] mb-8 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Storefront</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 bg-[#141416] text-white rounded-2xl p-7 sm:p-9 space-y-6">
          <NovaCartLogo variant="dark" size="md" />
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#F97316]">
              NovaCart Customer Access
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight">
              {mode === 'signup'
                ? 'Create your personal NovaCart account.'
                : mode === 'forgot-password'
                ? 'Recover access to your account.'
                : 'Sign in to your NovaCart account.'}
            </h1>
            <p className="text-sm text-white/75 leading-relaxed">
              Every customer receives an isolated account for saved delivery addresses, cart sync,
              order tracking, verified reviews, and promotional coupon redemptions.
            </p>
          </div>

          <ul className="space-y-2.5 text-xs text-white/80 pt-2 border-t border-white/10">
            <li className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#F97316] shrink-0" />
              <span>Email verification required before placing orders</span>
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#F97316] shrink-0" />
              <span>Private Firestore isolation per customer UID</span>
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#F97316] shrink-0" />
              <span>Instant sign-in with Google or Gmail + password</span>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-7 bg-white border border-black/8 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
          {mode !== 'forgot-password' && (
            <>
              <div className="grid grid-cols-2 gap-1 p-1 bg-[#F3EFE9] rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    navigateTo('signin');
                  }}
                  className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    mode === 'signin' ? 'bg-white text-[#141416] shadow-sm' : 'text-[#5C5B57]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    navigateTo('signup');
                  }}
                  className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    mode === 'signup' ? 'bg-white text-[#141416] shadow-sm' : 'text-[#5C5B57]'
                  }`}
                >
                  Create Account
                </button>
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleGoogle()}
                className="w-full py-2.5 px-4 rounded-lg border border-black/15 bg-white hover:bg-[#FAF8F5] text-sm font-semibold text-[#141416] flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#F97316]" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M12 10.2v3.9h5.4c-.2 1.2-1.4 3.6-5.4 3.6-3.3 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.2 14.5 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12S6.6 21.8 12 21.8c6.9 0 9.5-4.8 9.5-7.3 0-.5 0-.9-.1-1.3H12z"
                    />
                  </svg>
                )}
                <span>Continue with Google</span>
              </button>

              <div className="flex items-center gap-3 text-xs text-[#5C5B57]">
                <div className="flex-1 h-px bg-black/10" />
                <span>or with your Gmail / email</span>
                <div className="flex-1 h-px bg-black/10" />
              </div>
            </>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed">
              {errorMsg}
            </div>
          )}

          {mode === 'forgot-password' && resetSent ? (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  If a NovaCart account exists for <strong>{email}</strong>, a password reset link
                  has been dispatched to that inbox.
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigateTo('signin')}
                className="w-full py-2.5 rounded-lg bg-[#141416] text-white text-xs font-semibold cursor-pointer"
              >
                Return to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {mode === 'signup' && (
                <div>
                  <label htmlFor="auth-page-name" className="block text-xs font-medium text-[#141416] mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-[#5C5B57] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-page-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Aarav Sharma"
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-black/12 bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#F97316]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="auth-page-email" className="block text-xs font-medium text-[#141416] mb-1">
                  Gmail / Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#5C5B57] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-page-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gmail.com"
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-black/12 bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#F97316]"
                  />
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label htmlFor="auth-page-phone" className="block text-xs font-medium text-[#141416] mb-1">
                    Mobile Number <span className="text-[#5C5B57] font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-[#5C5B57] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-page-phone"
                      type="tel"
                      maxLength={24}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-black/12 bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#F97316]"
                    />
                  </div>
                </div>
              )}

              {mode !== 'forgot-password' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="auth-page-password" className="block text-xs font-medium text-[#141416]">
                      Password
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => navigateTo('forgot-password')}
                        className="text-xs font-medium text-[#EA580C] hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#5C5B57] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-page-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border border-black/12 bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#F97316]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#5C5B57] hover:text-[#141416] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {mode === 'signup' && password.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="grid grid-cols-4 gap-1">
                        {[1, 2, 3, 4].map((bar) => (
                          <div
                            key={bar}
                            className={`h-1 rounded-full transition-colors ${
                              strength.score >= bar ? strength.colorClass : 'bg-black/10'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-[11px] text-[#5C5B57] flex items-center justify-between">
                        <span>Strength: {strength.label}</span>
                        <span>Use 8+ chars, caps &amp; numbers</span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="auth-page-confirm-password"
                    className="block text-xs font-medium text-[#141416] mb-1"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#5C5B57] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-page-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border border-black/12 bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#F97316]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={
                        showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                      }
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#5C5B57] hover:text-[#141416] cursor-pointer"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <p className="text-[11px] text-red-600 mt-1">Passwords do not match.</p>
                  )}
                </div>
              )}

              {mode === 'signin' && (
                <label className="flex items-center gap-2 text-xs text-[#5C5B57] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="accent-[#F97316] rounded"
                  />
                  <span>Keep me signed in on this device</span>
                </label>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-5 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {submitting
                    ? 'Please wait...'
                    : mode === 'signin'
                    ? 'Sign In'
                    : mode === 'signup'
                    ? 'Create Customer Account'
                    : 'Send Password Reset Link'}
                </span>
              </button>

              {mode === 'forgot-password' && (
                <button
                  type="button"
                  onClick={() => navigateTo('signin')}
                  className="w-full py-2 text-xs font-medium text-[#5C5B57] hover:text-[#141416] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
