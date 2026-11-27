import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { NovaCartLogo } from './NovaCartLogo';

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

export function AuthModal() {
  const {
    authModalOpen,
    setAuthModalOpen,
    navigateTo,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    sendPasswordReset,
  } = useStore();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
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

  if (!authModalOpen) return null;

  const formatAuthError = (err: unknown): string => {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/operation-not-allowed') {
      return 'Email/Password sign-in is disabled in Firebase Console. Sign in instantly with Google above, or enable Email/Password under Firebase Console → Authentication → Sign-in method.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      return 'Incorrect email or password. Please verify your details or use Forgot password.';
    }
    if (code === 'auth/user-not-found') {
      return 'No account found with this email address.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'An account with this email already exists. Switch to Sign In instead.';
    }
    if (code === 'auth/weak-password') {
      return 'Please choose a stronger password (minimum 6 characters).';
    }
    if (code === 'auth/invalid-email') {
      return 'Please enter a valid email address.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Too many attempts detected. Please wait a moment and try again.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Google sign-in window was closed before finishing.';
    }
    return err instanceof Error ? err.message : 'Authentication failed. Please try again.';
  };

  const switchMode = (nextMode: 'login' | 'register' | 'forgot') => {
    setMode(nextMode);
    setErrorMsg(null);
    setResetSent(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleGoogle = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
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
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (mode === 'register') {
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
        setErrorMsg('Please enter a valid 10-digit phone number or leave it blank.');
        return;
      }
    } else if (mode === 'login') {
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters long.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(trimmedEmail, password, rememberMe);
      } else if (mode === 'register') {
        await registerWithEmail(name, trimmedEmail, password, phone);
        navigateTo('profile');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={() => setAuthModalOpen(false)}
      />

      <div className="relative z-10 w-full max-w-md bg-white border border-black/10 rounded-2xl p-6 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="mb-2.5">
              <NovaCartLogo variant="light" size="sm" />
            </div>
            <h2 className="font-display text-2xl font-bold text-[#141416]">
              {mode === 'login'
                ? 'Welcome back'
                : mode === 'register'
                ? 'Create your account'
                : 'Reset your password'}
            </h2>
            <p className="text-xs sm:text-sm text-[#5C5B57] mt-1">
              {mode === 'login'
                ? 'Sign in to manage orders, saved addresses, and wishlists.'
                : mode === 'register'
                ? 'Everything you love. One place.'
                : 'Enter your account email to receive a password reset link.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAuthModalOpen(false)}
            aria-label="Close sign in dialog"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#5C5B57] hover:text-[#141416] hover:bg-black/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {mode !== 'forgot' && (
          <>
            <button
              type="button"
              disabled={submitting}
              onClick={handleGoogle}
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

            <div className="my-4 flex items-center gap-3 text-xs text-[#5C5B57]">
              <div className="flex-1 h-px bg-black/10" />
              <span>or with email</span>
              <div className="flex-1 h-px bg-black/10" />
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 bg-[#F3EFE9] rounded-lg mb-4">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  mode === 'login' ? 'bg-white text-[#141416] shadow-sm' : 'text-[#5C5B57]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  mode === 'register' ? 'bg-white text-[#141416] shadow-sm' : 'text-[#5C5B57]'
                }`}
              >
                Create Account
              </button>
            </div>
          </>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed">
            {errorMsg}
          </div>
        )}

        {mode === 'forgot' && resetSent ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                If an account exists for <strong>{email}</strong>, a password reset email has been
                dispatched.
              </span>
            </div>
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="w-full py-2.5 rounded-lg bg-[#141416] text-white text-xs font-semibold cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-[#141416] mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#5C5B57] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
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
              <label className="block text-xs font-medium text-[#141416] mb-1">
                Gmail / Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#5C5B57] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-black/12 bg-[#FAF8F5] focus:bg-white focus:outline-none focus:border-[#F97316]"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-[#141416] mb-1">
                  Phone Number <span className="text-[#5C5B57] font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#5C5B57] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
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

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-[#141416]">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs font-medium text-[#EA580C] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#5C5B57] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
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

                {mode === 'register' && password.length > 0 && (
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
                      <span>Password strength: {strength.label}</span>
                      <span>Use 8+ chars, caps & numbers</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-[#141416] mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#5C5B57] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
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
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
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

            {mode === 'login' && (
              <label className="flex items-center gap-2 text-xs text-[#5C5B57] cursor-pointer select-none pt-0.5">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="accent-[#F97316] rounded"
                />
                <span>Remember me on this device</span>
              </label>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-5 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {submitting
                  ? 'Please wait...'
                  : mode === 'login'
                  ? 'Sign In'
                  : mode === 'register'
                  ? 'Create Customer Account'
                  : 'Send Reset Link'}
              </span>
            </button>

            {mode === 'register' && (
              <p className="text-[11px] text-[#5C5B57] flex items-center justify-center gap-1.5 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>Registered as a standard customer account with private order protection.</span>
              </p>
            )}

            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full py-2 text-xs font-medium text-[#5C5B57] hover:text-[#141416] inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            )}

            <div className="pt-2 border-t border-black/8 flex flex-wrap items-center justify-center gap-3 text-[11px] text-[#5C5B57]">
              <button
                type="button"
                onClick={() => {
                  setAuthModalOpen(false);
                  navigateTo(
                    mode === 'register'
                      ? 'signup'
                      : mode === 'forgot'
                      ? 'forgot-password'
                      : 'signin'
                  );
                }}
                className="font-medium hover:text-[#EA580C] hover:underline cursor-pointer"
              >
                Open full-page {mode === 'register' ? 'Sign Up' : mode === 'forgot' ? 'Reset' : 'Sign In'} view
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
