import React, { useState } from 'react';
import { CheckCircle2, Loader2, LogOut, MailCheck, RefreshCw, Send } from 'lucide-react';
import { useStore } from '../context/StoreContext';

interface EmailVerificationGateProps {
  featureLabel?: string;
  onVerified?: () => void;
}

export function EmailVerificationGate({
  featureLabel = 'your NovaCart account features',
  onVerified,
}: EmailVerificationGateProps) {
  const { user, resendVerificationEmail, refreshAuthVerification, logout, showToast } = useStore();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resentJustNow, setResentJustNow] = useState(false);

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerificationEmail();
      setResentJustNow(true);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Please wait a moment before requesting another verification email.',
        'error'
      );
    } finally {
      setResending(false);
    }
  };

  const handleRefresh = async () => {
    setChecking(true);
    try {
      const ok = await refreshAuthVerification();
      if (ok && onVerified) {
        onVerified();
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to refresh verification status right now.',
        'error'
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="bg-white border border-amber-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
            <MailCheck className="w-6 h-6 text-[#EA580C]" />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#EA580C]">
              Email Verification Required
            </p>
            <h1 className="font-display text-2xl font-bold text-[#141416]">
              Verify your email to unlock {featureLabel}
            </h1>
            <p className="text-sm text-[#5C5B57] leading-relaxed">
              We sent a verification link to{' '}
              <strong className="text-[#141416]">{user?.email || 'your email address'}</strong>.
              Please open that message in your inbox (or spam folder), click the confirmation link,
              and return here.
            </p>
          </div>
        </div>

        {resentJustNow && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              A fresh verification link has been sent to <strong>{user?.email}</strong>.
            </span>
          </div>
        )}

        <div className="bg-[#FAF8F5] border border-black/8 rounded-xl p-4 text-xs text-[#5C5B57] space-y-1.5">
          <p className="font-semibold text-[#141416]">Why do we verify your email?</p>
          <p className="leading-relaxed">
            Verifying your email protects your delivery addresses, order history, Razorpay checkout,
            product reviews, and single-use promotional coupons against unauthorized use.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            disabled={checking}
            onClick={() => void handleRefresh()}
            className="flex-1 py-2.5 px-4 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
          >
            {checking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>I&apos;ve Verified — Refresh Status</span>
          </button>

          <button
            type="button"
            disabled={resending}
            onClick={() => void handleResend()}
            className="py-2.5 px-4 rounded-lg border border-black/15 bg-white hover:bg-[#F3EFE9] text-[#141416] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
          >
            {resending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Resend Email</span>
          </button>
        </div>

        <div className="pt-4 border-t border-black/8 flex items-center justify-between gap-3 text-xs text-[#5C5B57]">
          <span>Signed in as {user?.email}</span>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 font-semibold text-[#141416] hover:text-[#EA580C] cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmailVerificationInlineBanner({ actionLabel }: { actionLabel: string }) {
  const { user, resendVerificationEmail, refreshAuthVerification, showToast } = useStore();
  const [busy, setBusy] = useState<'resend' | 'refresh' | null>(null);

  const handleResend = async () => {
    setBusy('resend');
    try {
      await resendVerificationEmail();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to send email right now.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleRefresh = async () => {
    setBusy('refresh');
    try {
      await refreshAuthVerification();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to refresh status.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3 text-xs text-amber-950">
      <div className="flex items-start gap-2.5">
        <MailCheck className="w-4 h-4 text-[#EA580C] shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-[#141416]">Verify your email to {actionLabel}</p>
          <p className="text-[#5C5B57] mt-0.5 leading-relaxed">
            Confirm the link sent to <strong>{user?.email}</strong>, then refresh your status.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void handleRefresh()}
          className="px-3 py-1.5 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
        >
          {busy === 'refresh' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span>Refresh Status</span>
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void handleResend()}
          className="px-3 py-1.5 rounded-lg border border-black/15 bg-white hover:bg-[#FAF8F5] text-[#141416] font-semibold cursor-pointer disabled:opacity-60"
        >
          {busy === 'resend' ? 'Sending...' : 'Resend Link'}
        </button>
      </div>
    </div>
  );
}
