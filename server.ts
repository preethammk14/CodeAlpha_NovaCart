import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { SEED_PRODUCTS } from './src/data/seedProducts.ts';

interface FirebaseAppletConfig {
  projectId?: string;
  firestoreDatabaseId?: string;
}

interface AuthenticatedRequest extends express.Request {
  user?: DecodedIdToken;
  idToken?: string;
  isAdmin?: boolean;
  rawBody?: Buffer;
}

interface TrustedProductRecord {
  id: string;
  title: string;
  price: number;
  stock: number;
}

const FALLBACK_CATALOG_PRICES: Record<string, TrustedProductRecord> = Object.fromEntries(
  SEED_PRODUCTS.map((p) => [
    p.id,
    {
      id: p.id,
      title: p.title,
      price: p.price,
      stock: p.stock,
    },
  ])
);

function loadFirebaseConfig(): FirebaseAppletConfig {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as FirebaseAppletConfig;
    if (!parsed.projectId || parsed.projectId === 'remixed-project-id') {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

const firebaseConfig = loadFirebaseConfig();
const adminApp = firebaseConfig.projectId
  ? (getApps().length ? getApp() : initializeApp({ projectId: firebaseConfig.projectId }))
  : null;
const adminAuth = adminApp ? getAuth(adminApp) : null;

const FALLBACK_ADMIN_EMAIL = 'preethammk147@gmail.com';
function getAdminEmails(): Set<string> {
  const configured = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (configured.length > 0) {
    return new Set<string>(configured);
  }
  return new Set<string>([FALLBACK_ADMIN_EMAIL]);
}

function parseFirestoreNumber(val: { integerValue?: string; doubleValue?: number } | undefined): number | null {
  if (!val) return null;
  if (typeof val.doubleValue === 'number' && Number.isFinite(val.doubleValue)) return val.doubleValue;
  if (typeof val.integerValue === 'string') {
    const n = Number(val.integerValue);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function resolveAuthoritativeProduct(
  productId: string,
  idToken: string
): Promise<TrustedProductRecord | null> {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(productId)) {
    return null;
  }

  if (firebaseConfig.projectId) {
    const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      firebaseConfig.projectId
    )}/databases/${encodeURIComponent(databaseId)}/documents/products/${encodeURIComponent(productId)}`;

    try {
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (resp.ok) {
        const doc = (await resp.json()) as {
          fields?: {
            title?: { stringValue?: string };
            price?: { integerValue?: string; doubleValue?: number };
            stock?: { integerValue?: string; doubleValue?: number };
          };
        };
        const title = doc.fields?.title?.stringValue;
        const price = parseFirestoreNumber(doc.fields?.price);
        const stock = parseFirestoreNumber(doc.fields?.stock);
        if (title && price !== null && price > 0 && stock !== null && stock >= 0) {
          return {
            id: productId,
            title,
            price: Math.round(price),
            stock: Math.round(stock),
          };
        }
      }
    } catch {
      // Fall through to authoritative seed fallback if REST fetch is unreachable
    }
  }

  return FALLBACK_CATALOG_PRICES[productId] || null;
}

async function verifyBearerToken(
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  if (!adminAuth) {
    res.status(503).json({ error: 'Authentication service is not configured.' });
    return;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization token.' });
    return;
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken || idToken.length > 4096) {
    res.status(401).json({ error: 'Invalid authorization token.' });
    return;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    req.user = decoded;
    req.idToken = idToken;
    const email = (decoded.email || '').toLowerCase();
    const isEmailVerified = Boolean(decoded.email_verified);
    const hasAdminEmail = Boolean(email && getAdminEmails().has(email));
    req.isAdmin = isEmailVerified && hasAdminEmail;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

function requireAdmin(
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
): void {
  if (!req.user || !req.user.email_verified || !req.isAdmin) {
    res.status(403).json({ error: 'Administrator privileges required.' });
    return;
  }
  next();
}

function requireVerifiedEmail(
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
): void {
  if (!req.user || !req.user.email_verified) {
    res.status(403).json({
      emailVerificationRequired: true,
      error: 'Please verify your email address before accessing checkout or payment actions.',
    });
    return;
  }
  next();
}

interface OfferDocRecord {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: 'percentage' | 'fixed' | 'free_shipping';
  discountValue: number;
  maxDiscount: number;
  minOrderAmount: number;
  oneTimeUse: boolean;
  status: 'Active' | 'Expired' | 'Cancelled';
  expiresAt?: string;
}

const STARTER_OFFERS: Record<string, OfferDocRecord> = {
  NOVA10: {
    id: 'NOVA10',
    code: 'NOVA10',
    title: 'Member 10% Storewide Privilege',
    description: '10% off orders ₹1,000+ (up to ₹2,500)',
    discountType: 'percentage',
    discountValue: 10,
    maxDiscount: 2500,
    minOrderAmount: 1000,
    oneTimeUse: false,
    status: 'Active',
  },
  WELCOME15: {
    id: 'WELCOME15',
    code: 'WELCOME15',
    title: 'Welcome 15% Signature Savings',
    description: '15% off orders ₹5,000+ (up to ₹4,000)',
    discountType: 'percentage',
    discountValue: 15,
    maxDiscount: 4000,
    minOrderAmount: 5000,
    oneTimeUse: true,
    status: 'Active',
  },
  FREESHIP: {
    id: 'FREESHIP',
    code: 'FREESHIP',
    title: 'Complimentary Express Delivery',
    description: 'Complimentary Express Delivery on any eligible order',
    discountType: 'free_shipping',
    discountValue: 0,
    maxDiscount: 149,
    minOrderAmount: 0,
    oneTimeUse: false,
    status: 'Active',
  },
};

function isOfferExpiredByDate(expiresAt?: string): boolean {
  if (!expiresAt || !expiresAt.trim()) return false;
  const trimmed = expiresAt.trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T23:59:59.999Z`)
    : new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return false;
  return Date.now() > parsed.getTime();
}

async function resolveAuthoritativeOffer(
  code: string,
  idToken: string
): Promise<OfferDocRecord | null> {
  if (!/^[A-Z0-9_-]{2,32}$/.test(code)) return null;

  if (firebaseConfig.projectId) {
    const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      firebaseConfig.projectId
    )}/databases/${encodeURIComponent(databaseId)}/documents`;

    try {
      const resp = await fetch(`${baseUrl}/offers/${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (resp.ok) {
        const doc = (await resp.json()) as {
          fields?: {
            id?: { stringValue?: string };
            code?: { stringValue?: string };
            title?: { stringValue?: string };
            description?: { stringValue?: string };
            discountType?: { stringValue?: string };
            discountValue?: { integerValue?: string; doubleValue?: number };
            maxDiscount?: { integerValue?: string; doubleValue?: number };
            minOrderAmount?: { integerValue?: string; doubleValue?: number };
            oneTimeUse?: { booleanValue?: boolean };
            status?: { stringValue?: string };
            expiresAt?: { stringValue?: string };
          };
        };
        const f = doc.fields;
        if (f?.code?.stringValue && f?.title?.stringValue) {
          const dt = f.discountType?.stringValue;
          const discountType =
            dt === 'fixed' || dt === 'free_shipping' ? dt : 'percentage';
          const st = f.status?.stringValue;
          const status =
            st === 'Expired' || st === 'Cancelled' ? st : 'Active';
          return {
            id: f.id?.stringValue || code,
            code: f.code.stringValue.toUpperCase(),
            title: f.title.stringValue,
            description: f.description?.stringValue || f.title.stringValue,
            discountType,
            discountValue: parseFirestoreNumber(f.discountValue) ?? 0,
            maxDiscount: parseFirestoreNumber(f.maxDiscount) ?? 0,
            minOrderAmount: parseFirestoreNumber(f.minOrderAmount) ?? 0,
            oneTimeUse: Boolean(f.oneTimeUse?.booleanValue),
            status,
            expiresAt: f.expiresAt?.stringValue,
          };
        }
      }

      if (resp.status === 404) {
        // Check if /offers collection has any managed documents; only fall back to starter promos if empty
        const listResp = await fetch(`${baseUrl}/offers?pageSize=1`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (listResp.ok) {
          const listJson = (await listResp.json()) as { documents?: unknown[] };
          if (Array.isArray(listJson.documents) && listJson.documents.length > 0) {
            return null;
          }
          return STARTER_OFFERS[code] || null;
        }
      }
    } catch {
      return STARTER_OFFERS[code] || null;
    }
  }

  return STARTER_OFFERS[code] || null;
}

async function hasUserRedeemedOffer(
  offerCode: string,
  uid: string,
  idToken: string
): Promise<boolean> {
  if (!firebaseConfig.projectId || !uid) return false;
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  const redemptionDocId = `${offerCode}__${uid}`;
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    firebaseConfig.projectId
  )}/databases/${encodeURIComponent(databaseId)}/documents/offerRedemptions/${encodeURIComponent(
    redemptionDocId
  )}`;

  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!resp.ok) return false;
    const doc = (await resp.json()) as {
      fields?: { status?: { stringValue?: string } };
    };
    return doc.fields?.status?.stringValue !== 'Cancelled';
  } catch {
    return false;
  }
}

interface ComputedQuote {
  verifiedItems: Array<{
    productId: string;
    title: string;
    price: number;
    quantity: number;
  }>;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  appliedPromo: string | null;
  appliedOffer: {
    id: string;
    code: string;
    title: string;
    discountType: 'percentage' | 'fixed' | 'free_shipping';
    discountValue: number;
    oneTimeUse: boolean;
  } | null;
  promoMessage: string | null;
  currency: 'INR';
}

async function computeAuthoritativeQuote(
  rawItems: unknown,
  rawPromoInput: unknown,
  idToken: string,
  uid: string
): Promise<{ ok: true; quote: ComputedQuote } | { ok: false; status: number; error: string }> {
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 50) {
    return { ok: false, status: 400, error: 'Cart must contain between 1 and 50 items.' };
  }

  const verifiedItems: ComputedQuote['verifiedItems'] = [];
  let subtotal = 0;

  for (const rawItem of rawItems) {
    const item = rawItem as { productId?: unknown; quantity?: unknown };
    if (
      !item ||
      typeof item.productId !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(item.productId) ||
      typeof item.quantity !== 'number' ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    ) {
      return { ok: false, status: 400, error: 'Invalid cart line item payload.' };
    }

    const authoritative = await resolveAuthoritativeProduct(item.productId, idToken);
    if (!authoritative) {
      return {
        ok: false,
        status: 404,
        error: `Product "${item.productId}" was not found in the catalog.`,
      };
    }
    if (authoritative.stock < item.quantity) {
      return {
        ok: false,
        status: 409,
        error: `Insufficient stock for "${authoritative.title}". Only ${authoritative.stock} left.`,
      };
    }

    subtotal += authoritative.price * item.quantity;
    verifiedItems.push({
      productId: authoritative.id,
      title: authoritative.title,
      price: authoritative.price,
      quantity: item.quantity,
    });
  }

  const rawPromo = typeof rawPromoInput === 'string' ? rawPromoInput.trim().toUpperCase() : '';
  let discount = 0;
  let appliedPromo: string | null = null;
  let appliedOffer: ComputedQuote['appliedOffer'] = null;
  let promoMessage: string | null = null;
  let forceFreeShipping = false;

  if (rawPromo) {
    const offer = await resolveAuthoritativeOffer(rawPromo, idToken);
    if (!offer) {
      promoMessage = 'Promo code not recognized or no longer available.';
    } else if (offer.status !== 'Active' || isOfferExpiredByDate(offer.expiresAt)) {
      promoMessage = `Promo code ${rawPromo} is ${
        offer.status === 'Cancelled' ? 'no longer active' : 'expired'
      }.`;
    } else if (subtotal < offer.minOrderAmount) {
      promoMessage = `Minimum order of ₹${offer.minOrderAmount.toLocaleString('en-IN')} required for ${rawPromo}.`;
    } else if (offer.oneTimeUse && (await hasUserRedeemedOffer(offer.code, uid, idToken))) {
      promoMessage = `Offer ${rawPromo} is one-time use and has already been redeemed by your account.`;
    } else {
      if (offer.discountType === 'free_shipping') {
        discount = 0;
        forceFreeShipping = true;
      } else if (offer.discountType === 'fixed') {
        discount = Math.min(Math.round(offer.discountValue), Math.max(0, subtotal - 1));
      } else {
        const pctDiscount = Math.round(subtotal * (offer.discountValue / 100));
        discount =
          offer.maxDiscount > 0
            ? Math.min(pctDiscount, offer.maxDiscount, Math.max(0, subtotal - 1))
            : Math.min(pctDiscount, Math.max(0, subtotal - 1));
      }
      appliedPromo = offer.code;
      appliedOffer = {
        id: offer.id,
        code: offer.code,
        title: offer.title,
        discountType: offer.discountType,
        discountValue: offer.discountValue,
        oneTimeUse: offer.oneTimeUse,
      };
      promoMessage = `Applied ${offer.code}: ${offer.description}`;
    }
  }

  const taxableSubtotal = Math.max(0, subtotal - discount);
  const shippingFee = forceFreeShipping || taxableSubtotal >= 2999 ? 0 : 149;
  const total = taxableSubtotal + shippingFee;

  return {
    ok: true,
    quote: {
      verifiedItems,
      subtotal,
      discount,
      shippingFee,
      total,
      appliedPromo,
      appliedOffer,
      promoMessage,
      currency: 'INR',
    },
  };
}

function timingSafeHexEqual(expectedHex: string, providedHex: string): boolean {
  const a = Buffer.from(expectedHex, 'utf8');
  const b = Buffer.from(providedHex, 'utf8');
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function startServer(): Promise<void> {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.set('trust proxy', 1);
  app.use(
    express.json({
      limit: '64kb',
      verify: (req, _res, buf) => {
        (req as AuthenticatedRequest).rawBody = buf;
      },
    })
  );

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'novacart-api',
      catalogCount: SEED_PRODUCTS.length,
      timestamp: new Date().toISOString(),
    });
  });

  interface RazorpayCapabilityReport {
    checkedAt: number;
    keyAuthValid: boolean;
    ordersApiAvailable: boolean;
    qrApiAvailable: boolean;
    qrApiStatus: number | null;
    qrApiReason: string | null;
    qrVisualKind: string | null;
    qrIframeBlocked: boolean | null;
  }

  let cachedRazorpayCapabilities: RazorpayCapabilityReport | null = null;

  async function probeRazorpayCapabilities(
    keyId: string,
    keySecret: string,
    forceRefresh = false
  ): Promise<RazorpayCapabilityReport> {
    if (
      !forceRefresh &&
      cachedRazorpayCapabilities &&
      Date.now() - cachedRazorpayCapabilities.checkedAt < 5 * 60 * 1000
    ) {
      return cachedRazorpayCapabilities;
    }

    const authBasic = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const report: RazorpayCapabilityReport = {
      checkedAt: Date.now(),
      keyAuthValid: false,
      ordersApiAvailable: false,
      qrApiAvailable: false,
      qrApiStatus: null,
      qrApiReason: null,
      qrVisualKind: null,
      qrIframeBlocked: null,
    };

    try {
      const ordersResp = await fetch('https://api.razorpay.com/v1/orders?count=1', {
        headers: { Authorization: `Basic ${authBasic}` },
        signal: AbortSignal.timeout(4000),
      });
      report.ordersApiAvailable = ordersResp.ok;
      report.keyAuthValid = ordersResp.status !== 401;
    } catch (err) {
      report.qrApiReason = err instanceof Error ? err.message : 'Orders API unreachable';
    }

    try {
      const closeBy = Math.floor(Date.now() / 1000) + 16 * 60;
      const qrResp = await fetch('https://api.razorpay.com/v1/payments/qr_codes', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authBasic}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'upi_qr',
          name: 'NovaCart Capability Check',
          usage: 'single_use',
          fixed_amount: true,
          payment_amount: 100,
          description: 'Capability Probe',
          close_by: closeBy,
          notes: { probe: 'true' },
        }),
        signal: AbortSignal.timeout(5000),
      });

      report.qrApiStatus = qrResp.status;
      if (qrResp.ok) {
        const qrJson = (await qrResp.json().catch(() => ({}))) as {
          id?: string;
          image_url?: string;
        };
        report.qrApiAvailable = Boolean(qrJson.id && qrJson.image_url);
        if (qrJson.image_url && isAllowedRazorpayUrl(qrJson.image_url)) {
          try {
            const imgProbe = await fetch(qrJson.image_url, {
              signal: AbortSignal.timeout(3500),
            });
            const ct = (imgProbe.headers.get('content-type') || '').toLowerCase();
            const xfo = (imgProbe.headers.get('x-frame-options') || '').toLowerCase();
            report.qrIframeBlocked = Boolean(xfo.includes('deny') || xfo.includes('sameorigin'));
            if (ct.startsWith('image/')) {
              report.qrVisualKind = `direct:${ct.split(';')[0].trim()}`;
            } else if (ct.includes('text/html')) {
              const html = await imgProbe.text();
              const hasDataImg = /src=["']data:image\//i.test(html);
              const hasRemoteImg = /src=["']https:\/\/[^"'\s>]+/i.test(html);
              const hasSvg = /<svg[\s\S]*?<\/svg>/i.test(html);
              const hasUpiString = /upi:\/\/pay\?/i.test(html);
              report.qrVisualKind = `html(dataImg=${hasDataImg},remoteImg=${hasRemoteImg},svg=${hasSvg},upi=${hasUpiString},len=${html.length})`;
            } else {
              report.qrVisualKind = ct || 'unknown';
            }
          } catch (probeErr) {
            report.qrVisualKind = `probe-error:${probeErr instanceof Error ? probeErr.message : 'unknown'}`;
          }
        }
        if (qrJson.id) {
          await fetch(
            `https://api.razorpay.com/v1/payments/qr_codes/${encodeURIComponent(qrJson.id)}/close`,
            {
              method: 'POST',
              headers: { Authorization: `Basic ${authBasic}` },
            }
          ).catch(() => {});
        }
      } else {
        const errBody = (await qrResp.json().catch(() => null)) as {
          error?: { code?: string; description?: string; reason?: string };
        } | null;
        report.qrApiAvailable = false;
        report.qrApiReason =
          errBody?.error?.description ||
          errBody?.error?.code ||
          `HTTP ${qrResp.status}`;
      }
    } catch (err) {
      report.qrApiAvailable = false;
      report.qrApiReason = err instanceof Error ? err.message : 'QR API probe failed';
    }

    cachedRazorpayCapabilities = report;
    console.log('[NovaCart Razorpay Probe]', JSON.stringify(report));
    return report;
  }

  app.get('/api/payments/config', async (req, res) => {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
    const razorpayConfigured = Boolean(keyId && keySecret);
    const razorpayMode = !razorpayConfigured
      ? 'unconfigured'
      : keyId.startsWith('rzp_live_')
      ? 'live'
      : 'test';

    let capabilities: RazorpayCapabilityReport | null = null;
    let testOrderCheck: { ok: boolean; orderIdPrefix?: string; error?: string } | undefined;
    if (razorpayConfigured) {
      const refresh = req.query.refresh === '1';
      capabilities = await probeRazorpayCapabilities(keyId, keySecret, refresh);
      if (req.query.testOrder === '1') {
        try {
          const authBasic = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
          const orderProbe = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
              Authorization: `Basic ${authBasic}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: 100,
              currency: 'INR',
              receipt: `nc_diag_${Date.now()}`.slice(0, 40),
              payment_capture: 1,
            }),
            signal: AbortSignal.timeout(5000),
          });
          if (orderProbe.ok) {
            const ord = (await orderProbe.json()) as { id?: string };
            testOrderCheck = {
              ok: Boolean(ord.id),
              orderIdPrefix: ord.id ? `${ord.id.slice(0, 10)}••••` : undefined,
            };
          } else {
            const errText = await orderProbe.text().catch(() => '');
            testOrderCheck = { ok: false, error: errText.slice(0, 160) };
          }
        } catch (err) {
          testOrderCheck = {
            ok: false,
            error: err instanceof Error ? err.message : 'Order probe failed',
          };
        }
      }
    }

    res.json({
      razorpayConfigured,
      razorpayMode,
      keyIdPrefix: keyId ? `${keyId.slice(0, 9)}••••` : null,
      webhookConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET?.trim()),
      qrApiAvailable: capabilities ? capabilities.qrApiAvailable : false,
      ordersApiAvailable: capabilities ? capabilities.ordersApiAvailable : false,
      qrApiReason: capabilities?.qrApiReason || null,
      qrVisualKind: capabilities?.qrVisualKind || null,
      qrIframeBlocked: capabilities?.qrIframeBlocked ?? null,
      ...(testOrderCheck ? { testOrderCheck } : {}),
      currency: 'INR',
      supportedMethods: [
        'cod',
        'upi',
        'gpay',
        'phonepe',
        'paytm',
        'netbanking',
        'debit_card',
        'credit_card',
      ],
    });
  });

  app.post('/api/auth/verify', verifyBearerToken, (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }
    res.json({
      uid: user.uid,
      email: user.email || null,
      emailVerified: Boolean(user.email_verified),
      isAdmin: Boolean(req.isAdmin),
      role: req.isAdmin ? 'admin' : 'customer',
    });
  });

  app.post('/api/admin/authorize', verifyBearerToken, requireAdmin, (req: AuthenticatedRequest, res) => {
    res.json({
      authorized: true,
      email: req.user?.email || null,
      uid: req.user?.uid || null,
    });
  });

  // Authoritative server-side price, offer & stock verification for checkout
  app.post(
    '/api/checkout/quote',
    verifyBearerToken,
    requireVerifiedEmail,
    async (req: AuthenticatedRequest, res) => {
      const idToken = req.idToken;
      const user = req.user;
      if (!idToken || !user) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }

      const body = req.body as { items?: unknown; promoCode?: unknown };
      const result = await computeAuthoritativeQuote(
        body?.items,
        body?.promoCode,
        idToken,
        user.uid
      );
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json(result.quote);
    }
  );

  // In-memory registries to track verified payments & active QR checkout sessions
  const verifiedPaymentOwners = new Map<
    string,
    { uid: string; orderId: string; amountPaise: number; consumed: boolean; verifiedAt: number }
  >();

  interface QrSessionRecord {
    qrId: string;
    uid: string;
    amountPaise: number;
    currency: 'INR';
    preferredMethod: string;
    promoCode: string;
    status: 'active' | 'paid' | 'failed' | 'expired' | 'closed';
    imageUrl: string;
    qrImageDataUrl: string | null;
    closeBy: number;
    createdAt: number;
    verifiedPaymentId?: string;
    razorpayOrderId?: string;
    methodUsed?: string | null;
    vpa?: string | null;
    failureReason?: string | null;
  }

  const activeQrSessions = new Map<string, QrSessionRecord>();
  const processedWebhookEventIds = new Set<string>();

  function prunePaymentRegistry(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    if (verifiedPaymentOwners.size > 5000) {
      for (const [k, v] of verifiedPaymentOwners.entries()) {
        if (v.verifiedAt < cutoff) verifiedPaymentOwners.delete(k);
      }
    }
    if (activeQrSessions.size > 2000) {
      for (const [k, v] of activeQrSessions.entries()) {
        if (v.createdAt < cutoff) activeQrSessions.delete(k);
      }
    }
    if (processedWebhookEventIds.size > 5000) {
      processedWebhookEventIds.clear();
    }
  }

  function isAllowedRazorpayUrl(rawUrl: string): boolean {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:') return false;
      const host = parsed.hostname.toLowerCase();
      return (
        host === 'rzp.io' ||
        host.endsWith('.rzp.io') ||
        host === 'razorpay.com' ||
        host.endsWith('.razorpay.com')
      );
    } catch {
      return false;
    }
  }

  async function resolveRazorpayQrVisual(rawUrl: string): Promise<string | null> {
    if (!rawUrl || !isAllowedRazorpayUrl(rawUrl)) return null;
    try {
      const resp = await fetch(rawUrl, {
        signal: AbortSignal.timeout(3500),
        headers: {
          Accept: 'image/png,image/svg+xml,image/*,text/html;q=0.9',
        },
      });
      if (!resp.ok || !isAllowedRazorpayUrl(resp.url || rawUrl)) {
        return null;
      }

      const contentType = (resp.headers.get('content-type') || '').toLowerCase();
      if (contentType.startsWith('image/')) {
        const mime = contentType.split(';')[0].trim();
        const arrayBuf = await resp.arrayBuffer();
        if (arrayBuf.byteLength > 0 && arrayBuf.byteLength <= 512 * 1024) {
          const b64 = Buffer.from(arrayBuf).toString('base64');
          return `data:${mime};base64,${b64}`;
        }
        return null;
      }

      if (contentType.includes('text/html')) {
        const html = (await resp.text()).slice(0, 200_000);
        const dataImgMatch = html.match(/src=["'](data:image\/(?:png|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+)["']/i);
        if (dataImgMatch?.[1]) {
          return dataImgMatch[1];
        }
        const remoteImgMatch = html.match(/src=["'](https:\/\/[^"'\s>]+)["']/i);
        if (remoteImgMatch?.[1] && isAllowedRazorpayUrl(remoteImgMatch[1])) {
          const imgResp = await fetch(remoteImgMatch[1], { signal: AbortSignal.timeout(2500) });
          const imgType = (imgResp.headers.get('content-type') || '').toLowerCase();
          if (imgResp.ok && imgType.startsWith('image/')) {
            const mime = imgType.split(';')[0].trim();
            const buf = await imgResp.arrayBuffer();
            if (buf.byteLength > 0 && buf.byteLength <= 512 * 1024) {
              return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
            }
          }
        }
        const svgMatch = html.match(/<svg[\s\S]*?<\/svg>/i);
        if (svgMatch?.[0] && svgMatch[0].length <= 128_000) {
          return `data:image/svg+xml;base64,${Buffer.from(svgMatch[0], 'utf8').toString('base64')}`;
        }
      }
    } catch {
      // Fallback safely to Razorpay hosted imageUrl on client
    }
    return null;
  }

  async function captureAuthorizedPaymentIfNeeded(
    paymentId: string,
    status: string,
    amountPaise: number,
    authBasic: string
  ): Promise<string> {
    if (status !== 'authorized') return status;
    try {
      const captureResp = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/capture`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authBasic}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: amountPaise,
            currency: 'INR',
          }),
        }
      );
      if (captureResp.ok) {
        const captured = (await captureResp.json()) as { status?: string };
        if (captured.status) return captured.status;
      }
    } catch {
      // Preserve authorized status if capture call had transient error
    }
    return status;
  }

  // Razorpay order creation (Server-only secret; test & live mode compatible)
  app.post(
    '/api/payments/razorpay/create-order',
    verifyBearerToken,
    requireVerifiedEmail,
    async (req: AuthenticatedRequest, res) => {
      const idToken = req.idToken;
      const user = req.user;
      if (!idToken || !user) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }

      const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
      const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
      if (!keyId || !keySecret) {
        res.status(503).json({
          configured: false,
          error:
            'Razorpay online payments require RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server environment secrets. Add your Razorpay Test Mode credentials or select Cash on Delivery.',
        });
        return;
      }

      const body = req.body as {
        items?: unknown;
        promoCode?: unknown;
        paymentMethod?: unknown;
      };

      const result = await computeAuthoritativeQuote(
        body?.items,
        body?.promoCode,
        idToken,
        user.uid
      );
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }

    const method = typeof body?.paymentMethod === 'string' ? body.paymentMethod.slice(0, 32) : 'upi';
    const amountPaise = Math.round(result.quote.total * 100);
    if (!Number.isInteger(amountPaise) || amountPaise < 100) {
      res.status(400).json({ error: 'Order total must be at least ₹1.00 for online payments.' });
      return;
    }
    const receipt = `nc_${Date.now()}_${user.uid.slice(0, 10)}`.slice(0, 40);

    try {
      const authBasic = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const rzpResp = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authBasic}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: 'INR',
          receipt,
          payment_capture: 1,
          notes: {
            uid: user.uid,
            preferredMethod: method,
            promoCode: result.quote.appliedPromo || '',
            expectedTotalPaise: String(amountPaise),
          },
        }),
      });

      if (!rzpResp.ok) {
        const errJson = (await rzpResp.json().catch(() => null)) as
          | { error?: { description?: string; reason?: string } }
          | null;
        const errMsg =
          errJson?.error?.description ||
          (await rzpResp.text().catch(() => '')).slice(0, 180) ||
          'Razorpay order creation failed.';
        console.error('[Razorpay Order Create Error]', rzpResp.status, errJson || errMsg);
        res.status(502).json({
          configured: true,
          error: `Razorpay order creation failed: ${errMsg}`,
        });
        return;
      }

      const rzpOrder = (await rzpResp.json()) as {
        id: string;
        amount: number;
        currency: string;
        receipt: string;
      };

      res.json({
        configured: true,
        mode: keyId.startsWith('rzp_live_') ? 'live' : 'test',
        orderId: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        keyId,
        quote: result.quote,
      });
    } catch {
      res.status(502).json({
        configured: true,
        error: 'Unable to reach Razorpay payment gateway. Please retry or use Cash on Delivery.',
      });
    }
  });

  // Server-side HMAC-SHA256 Razorpay signature, amount, ownership & payment status verification
  app.post('/api/payments/razorpay/verify', verifyBearerToken, requireVerifiedEmail, async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    const idToken = req.idToken;
    if (!user || !idToken) {
      res.status(401).json({ verified: false, error: 'Authentication required.' });
      return;
    }

    const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
    if (!keyId || !keySecret) {
      res.status(503).json({
        verified: false,
        configured: false,
        error: 'Razorpay credentials are not configured on the server.',
      });
      return;
    }

    const body = req.body as {
      razorpay_order_id?: unknown;
      razorpay_payment_id?: unknown;
      razorpay_signature?: unknown;
      items?: unknown;
      promoCode?: unknown;
    };

    const orderId = typeof body?.razorpay_order_id === 'string' ? body.razorpay_order_id.trim() : '';
    const paymentId = typeof body?.razorpay_payment_id === 'string' ? body.razorpay_payment_id.trim() : '';
    const signature = typeof body?.razorpay_signature === 'string' ? body.razorpay_signature.trim() : '';

    if (
      !/^[a-zA-Z0-9_-]{6,128}$/.test(orderId) ||
      !/^[a-zA-Z0-9_-]{6,128}$/.test(paymentId) ||
      !/^[a-fA-F0-9]{32,128}$/.test(signature)
    ) {
      res.status(400).json({ verified: false, error: 'Malformed payment verification payload.' });
      return;
    }

    const existingRecord = verifiedPaymentOwners.get(paymentId);
    if (existingRecord) {
      if (existingRecord.consumed) {
        res.status(409).json({
          verified: false,
          duplicate: true,
          error: 'This payment has already been used to confirm an order.',
        });
        return;
      }
      if (existingRecord.uid !== user.uid || existingRecord.orderId !== orderId) {
        res.status(409).json({
          verified: false,
          duplicate: true,
          error: 'Payment reference mismatch or already assigned to another checkout session.',
        });
        return;
      }
    }

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (!timingSafeHexEqual(expectedSignature, signature.toLowerCase())) {
      res.status(400).json({ verified: false, error: 'Payment signature verification failed.' });
      return;
    }

    // Confirm both Razorpay Order & Payment records directly with Razorpay REST API
    try {
      const authBasic = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const [orderResp, paymentResp] = await Promise.all([
        fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
          headers: { Authorization: `Basic ${authBasic}` },
        }),
        fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
          headers: { Authorization: `Basic ${authBasic}` },
        }),
      ]);

      if (!orderResp.ok || !paymentResp.ok) {
        const failedResp = !paymentResp.ok ? paymentResp : orderResp;
        const errBody = await failedResp.text().catch(() => '');
        const statusCode = failedResp.status >= 400 && failedResp.status < 500 ? 400 : 502;
        res.status(statusCode).json({
          verified: false,
          error: errBody
            ? `Razorpay verification failed: ${errBody.slice(0, 160)}`
            : 'Unable to confirm payment record with Razorpay.',
        });
        return;
      }

      const orderData = (await orderResp.json()) as {
        id?: string;
        amount?: number;
        currency?: string;
        notes?: { uid?: string };
      };
      const paymentData = (await paymentResp.json()) as {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
        method?: string;
      };

      if (orderData.notes?.uid && orderData.notes.uid !== user.uid) {
        res.status(403).json({
          verified: false,
          error: 'This payment order does not belong to the signed-in customer account.',
        });
        return;
      }

      const orderAmountPaise = Number(orderData.amount);
      const paymentAmountPaise = Number(paymentData.amount);

      if (
        orderData.id !== orderId ||
        paymentData.id !== paymentId ||
        paymentData.order_id !== orderId ||
        orderData.currency !== 'INR' ||
        paymentData.currency !== 'INR' ||
        !Number.isFinite(orderAmountPaise) ||
        orderAmountPaise < 100 ||
        paymentAmountPaise !== orderAmountPaise
      ) {
        res.status(400).json({
          verified: false,
          error: 'Payment amount or order integrity check failed.',
        });
        return;
      }

      // Cross-check against current authoritative cart quote when items are supplied
      if (Array.isArray(body?.items)) {
        const quoteCheck = await computeAuthoritativeQuote(
          body.items,
          body?.promoCode,
          idToken,
          user.uid
        );
        if (!quoteCheck.ok) {
          res.status(quoteCheck.status).json({ verified: false, error: quoteCheck.error });
          return;
        }
        const expectedQuotePaise = Math.round(quoteCheck.quote.total * 100);
        if (expectedQuotePaise !== orderAmountPaise) {
          res.status(400).json({
            verified: false,
            error: 'Cart total changed during payment. Paid amount does not match checkout total.',
          });
          return;
        }
      }

      let finalPaymentStatus = paymentData.status || 'unknown';
      if (finalPaymentStatus === 'authorized') {
        const captureResp = await fetch(
          `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/capture`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${authBasic}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: orderAmountPaise,
              currency: 'INR',
            }),
          }
        );
        if (captureResp.ok) {
          const captured = (await captureResp.json()) as { status?: string };
          if (captured.status) finalPaymentStatus = captured.status;
        }
      }

      if (finalPaymentStatus !== 'captured' && finalPaymentStatus !== 'authorized') {
        res.status(400).json({
          verified: false,
          error: `Payment is in "${finalPaymentStatus}" state and cannot be confirmed.`,
        });
        return;
      }

      prunePaymentRegistry();
      verifiedPaymentOwners.set(paymentId, {
        uid: user.uid,
        orderId,
        amountPaise: orderAmountPaise,
        consumed: false,
        verifiedAt: Date.now(),
      });

      res.json({
        verified: true,
        paymentStatus: 'paid',
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        amountPaidPaise: orderAmountPaise,
        methodUsed: paymentData.method || null,
      });
    } catch {
      res.status(502).json({
        verified: false,
        error: 'Unable to reach Razorpay verification API. Please verify network connectivity.',
      });
    }
  });

  app.post('/api/payments/razorpay/mark-consumed', verifyBearerToken, (req: AuthenticatedRequest, res) => {
    const user = req.user;
    const paymentId =
      typeof req.body?.razorpayPaymentId === 'string' ? req.body.razorpayPaymentId.trim() : '';
    if (!user || !paymentId) {
      res.status(400).json({ ok: false });
      return;
    }
    const existing = verifiedPaymentOwners.get(paymentId);
    if (existing && existing.uid === user.uid) {
      existing.consumed = true;
    }
    res.json({ ok: true });
  });

  // Real Razorpay UPI QR Code creation (POST /v1/payments/qr_codes)
  app.post(
    '/api/payments/razorpay/create-qr',
    verifyBearerToken,
    requireVerifiedEmail,
    async (req: AuthenticatedRequest, res) => {
      const idToken = req.idToken;
      const user = req.user;
      if (!idToken || !user) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }

      const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
      const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
      if (!keyId || !keySecret) {
        res.status(503).json({
          configured: false,
          error:
            'Razorpay UPI QR payments require RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server secrets. Add your Test Mode keys or choose Cash on Delivery.',
        });
        return;
      }

      const body = req.body as {
        items?: unknown;
        promoCode?: unknown;
        paymentMethod?: unknown;
        previousQrId?: unknown;
      };

      const result = await computeAuthoritativeQuote(
        body?.items,
        body?.promoCode,
        idToken,
        user.uid
      );
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }

    const amountPaise = Math.round(result.quote.total * 100);
    if (!Number.isInteger(amountPaise) || amountPaise < 100) {
      res.status(400).json({ error: 'Order total must be at least ₹1.00 for UPI QR payment.' });
      return;
    }

    const preferredMethod =
      typeof body?.paymentMethod === 'string' ? body.paymentMethod.slice(0, 32) : 'upi';
    const authBasic = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    // Close previous active QR owned by this user before creating a new one
    if (typeof body?.previousQrId === 'string') {
      const prevId = body.previousQrId.trim();
      const prevSession = activeQrSessions.get(prevId);
      if (prevSession && prevSession.uid === user.uid && prevSession.status === 'active') {
        prevSession.status = 'closed';
        void fetch(`https://api.razorpay.com/v1/payments/qr_codes/${encodeURIComponent(prevId)}/close`, {
          method: 'POST',
          headers: { Authorization: `Basic ${authBasic}` },
        }).catch(() => {});
      }
    }

    const nowSec = Math.floor(Date.now() / 1000);
    // Razorpay requires close_by to be at least 15 minutes (900s) in the future; add 60s buffer for clock drift
    const closeBy = nowSec + 16 * 60;
    const receipt = `ncqr_${Date.now()}_${user.uid.slice(0, 8)}`.slice(0, 40);
    const totalItems = result.quote.verifiedItems.reduce((sum, i) => sum + i.quantity, 0);

    try {
      const rzpResp = await fetch('https://api.razorpay.com/v1/payments/qr_codes', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authBasic}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'upi_qr',
          name: 'NovaCart Marketplace',
          usage: 'single_use',
          fixed_amount: true,
          payment_amount: amountPaise,
          description: `NovaCart Order (${totalItems} item${totalItems === 1 ? '' : 's'})`,
          close_by: closeBy,
          notes: {
            uid: user.uid,
            preferredMethod,
            promoCode: result.quote.appliedPromo || '',
            expectedTotalPaise: String(amountPaise),
            receipt,
          },
        }),
      });

      if (!rzpResp.ok) {
        const errJson = (await rzpResp.json().catch(() => null)) as
          | { error?: { code?: string; description?: string; reason?: string } }
          | null;
        const errMsg =
          errJson?.error?.description ||
          (await rzpResp.text().catch(() => '')).slice(0, 200) ||
          'Razorpay UPI QR creation failed.';
        console.error('[Razorpay QR Create Error]', rzpResp.status, errJson || errMsg);
        const lowerMsg = errMsg.toLowerCase();
        const isFeatureDisabled =
          rzpResp.status === 400 ||
          rzpResp.status === 403 ||
          rzpResp.status === 404 ||
          lowerMsg.includes('feature') ||
          lowerMsg.includes('not enabled') ||
          lowerMsg.includes('not found') ||
          lowerMsg.includes('qr');

        if (isFeatureDisabled && cachedRazorpayCapabilities) {
          cachedRazorpayCapabilities.qrApiAvailable = false;
          cachedRazorpayCapabilities.qrApiReason = errMsg;
        }

        res.status(isFeatureDisabled ? 422 : 502).json({
          configured: true,
          qrSupported: !isFeatureDisabled,
          fallbackToCheckout: true,
          error: `Razorpay QR Code request failed: ${errMsg}`,
        });
        return;
      }

      const qrData = (await rzpResp.json()) as {
        id?: string;
        image_url?: string;
        payment_amount?: number;
        status?: string;
        close_by?: number;
      };

      if (!qrData.id || !qrData.image_url) {
        res.status(502).json({
          configured: true,
          qrSupported: false,
          fallbackToCheckout: true,
          error: 'Razorpay returned an incomplete QR code response. Use Standard Checkout instead.',
        });
        return;
      }

      const qrImageDataUrl = await resolveRazorpayQrVisual(qrData.image_url);
      const effectiveAmountPaise = Number(qrData.payment_amount) || amountPaise;
      const effectiveCloseBy = Number(qrData.close_by) || closeBy;

      prunePaymentRegistry();
      activeQrSessions.set(qrData.id, {
        qrId: qrData.id,
        uid: user.uid,
        amountPaise: effectiveAmountPaise,
        currency: 'INR',
        preferredMethod,
        promoCode: result.quote.appliedPromo || '',
        status: 'active',
        imageUrl: qrData.image_url,
        qrImageDataUrl,
        closeBy: effectiveCloseBy,
        createdAt: Date.now(),
      });

      res.json({
        configured: true,
        qrSupported: true,
        mode: keyId.startsWith('rzp_live_') ? 'live' : 'test',
        qrId: qrData.id,
        imageUrl: qrData.image_url,
        qrImageDataUrl,
        amountPaise: effectiveAmountPaise,
        currency: 'INR',
        status: qrData.status || 'active',
        closeBy: effectiveCloseBy,
        serverNow: Math.floor(Date.now() / 1000),
        quote: result.quote,
      });
    } catch {
      res.status(502).json({
        configured: true,
        fallbackToCheckout: true,
        error: 'Unable to reach Razorpay QR gateway. Please retry or use Standard Checkout.',
      });
    }
  });

  // Live polling endpoint for Razorpay UPI QR Code payment status
  app.get('/api/payments/razorpay/qr-status/:qrId', verifyBearerToken, requireVerifiedEmail, async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ verified: false, error: 'Authentication required.' });
      return;
    }

    const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
    if (!keyId || !keySecret) {
      res.status(503).json({ configured: false, error: 'Razorpay keys are not configured.' });
      return;
    }

    const qrId = typeof req.params.qrId === 'string' ? req.params.qrId.trim() : '';
    if (!/^[a-zA-Z0-9_-]{6,64}$/.test(qrId)) {
      res.status(400).json({ verified: false, error: 'Invalid QR code identifier.' });
      return;
    }

    const session = activeQrSessions.get(qrId);
    if (session && session.uid !== user.uid) {
      res.status(403).json({ verified: false, error: 'QR session does not belong to this account.' });
      return;
    }

    // Fast path if webhook already verified this QR payment
    if (session?.status === 'paid' && session.verifiedPaymentId) {
      const existingOwner = verifiedPaymentOwners.get(session.verifiedPaymentId);
      if (existingOwner?.consumed) {
        res.status(409).json({
          status: 'failed',
          verified: false,
          duplicate: true,
          error: 'This UPI QR payment has already been processed into an order.',
        });
        return;
      }
      if (!existingOwner) {
        prunePaymentRegistry();
        verifiedPaymentOwners.set(session.verifiedPaymentId, {
          uid: user.uid,
          orderId: session.razorpayOrderId || qrId,
          amountPaise: session.amountPaise,
          consumed: false,
          verifiedAt: Date.now(),
        });
      }
      res.json({
        status: 'paid',
        verified: true,
        qrId,
        razorpayOrderId: session.razorpayOrderId || qrId,
        razorpayPaymentId: session.verifiedPaymentId,
        amountPaidPaise: session.amountPaise,
        methodUsed: session.methodUsed || 'upi',
        vpa: session.vpa || null,
      });
      return;
    }

    try {
      const authBasic = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const [qrResp, paymentsResp] = await Promise.all([
        fetch(`https://api.razorpay.com/v1/payments/qr_codes/${encodeURIComponent(qrId)}`, {
          headers: { Authorization: `Basic ${authBasic}` },
        }),
        fetch(`https://api.razorpay.com/v1/payments/qr_codes/${encodeURIComponent(qrId)}/payments`, {
          headers: { Authorization: `Basic ${authBasic}` },
        }),
      ]);

      if (!qrResp.ok) {
        res.status(qrResp.status >= 400 && qrResp.status < 500 ? 404 : 502).json({
          status: 'failed',
          verified: false,
          error: 'Unable to retrieve Razorpay QR payment status.',
        });
        return;
      }

      const qrInfo = (await qrResp.json()) as {
        id?: string;
        status?: string;
        payment_amount?: number;
        close_by?: number;
        notes?: { uid?: string };
      };

      if (qrInfo.notes?.uid && qrInfo.notes.uid !== user.uid) {
        res.status(403).json({ verified: false, error: 'QR session belongs to a different account.' });
        return;
      }

      const expectedAmountPaise = session?.amountPaise || Number(qrInfo.payment_amount || 0);
      const paymentsPayload = paymentsResp.ok
        ? ((await paymentsResp.json()) as {
            items?: Array<{
              id?: string;
              order_id?: string | null;
              amount?: number;
              currency?: string;
              status?: string;
              method?: string;
              vpa?: string;
              error_description?: string;
              error_reason?: string;
            }>;
          })
        : { items: [] };

      const paymentItems = Array.isArray(paymentsPayload.items) ? paymentsPayload.items : [];
      const candidateSuccess = paymentItems.find(
        (p) => p.status === 'captured' || p.status === 'authorized'
      );

      if (candidateSuccess && candidateSuccess.id) {
        const payId = candidateSuccess.id;
        const paidAmountPaise = Number(candidateSuccess.amount || 0);
        if (
          candidateSuccess.currency !== 'INR' ||
          !Number.isFinite(expectedAmountPaise) ||
          expectedAmountPaise < 100 ||
          paidAmountPaise !== expectedAmountPaise
        ) {
          res.status(400).json({
            status: 'failed',
            verified: false,
            error: 'Received UPI payment amount does not match the checkout total.',
          });
          return;
        }

        const finalStatus = await captureAuthorizedPaymentIfNeeded(
          payId,
          candidateSuccess.status || 'captured',
          expectedAmountPaise,
          authBasic
        );

        if (finalStatus !== 'captured' && finalStatus !== 'authorized') {
          res.status(400).json({
            status: 'failed',
            verified: false,
            error: `Payment is in "${finalStatus}" state and cannot be confirmed.`,
          });
          return;
        }

        const existingOwner = verifiedPaymentOwners.get(payId);
        if (existingOwner && (existingOwner.consumed || existingOwner.uid !== user.uid)) {
          res.status(409).json({
            status: 'failed',
            verified: false,
            duplicate: true,
            error: 'This UPI transaction has already been applied to an order.',
          });
          return;
        }

        const mappedOrderId = candidateSuccess.order_id || qrId;
        prunePaymentRegistry();
        verifiedPaymentOwners.set(payId, {
          uid: user.uid,
          orderId: mappedOrderId,
          amountPaise: expectedAmountPaise,
          consumed: false,
          verifiedAt: Date.now(),
        });

        if (session) {
          session.status = 'paid';
          session.verifiedPaymentId = payId;
          session.razorpayOrderId = mappedOrderId;
          session.methodUsed = candidateSuccess.method || 'upi';
          session.vpa = candidateSuccess.vpa || null;
        }

        res.json({
          status: 'paid',
          verified: true,
          qrId,
          razorpayOrderId: mappedOrderId,
          razorpayPaymentId: payId,
          amountPaidPaise: paidAmountPaise,
          methodUsed: candidateSuccess.method || 'upi',
          vpa: candidateSuccess.vpa || null,
        });
        return;
      }

      const failedAttempt = paymentItems.find((p) => p.status === 'failed');
      if (failedAttempt) {
        const failureMsg =
          failedAttempt.error_description ||
          (failedAttempt.error_reason
            ? `UPI payment failed (${failedAttempt.error_reason.replace(/_/g, ' ')}).`
            : 'UPI authorization failed. Please generate a fresh QR code and retry.');
        if (session) {
          session.status = 'failed';
          session.failureReason = failureMsg;
        }
        res.json({
          status: 'failed',
          verified: false,
          qrId,
          error: failureMsg,
        });
        return;
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const effectiveCloseBy = Number(qrInfo.close_by || session?.closeBy || 0);
      if (qrInfo.status === 'closed' || (effectiveCloseBy > 0 && nowSec >= effectiveCloseBy)) {
        if (session && session.status !== 'paid') {
          session.status = 'expired';
        }
        res.json({
          status: 'expired',
          verified: false,
          qrId,
          closeBy: effectiveCloseBy,
          serverNow: nowSec,
          error: 'This UPI QR code has expired. Generate a fresh QR code to complete payment.',
        });
        return;
      }

      res.json({
        status: 'waiting',
        verified: false,
        qrId,
        closeBy: effectiveCloseBy,
        serverNow: nowSec,
      });
    } catch {
      res.status(502).json({
        status: 'waiting',
        verified: false,
        transientError: true,
        error: 'Checking payment status timed out; retrying automatically.',
      });
    }
  });

  // Explicit closure of an active Razorpay UPI QR Code when customer cancels or switches method
  app.post('/api/payments/razorpay/qr-close/:qrId', verifyBearerToken, async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ ok: false });
      return;
    }

    const qrId = typeof req.params.qrId === 'string' ? req.params.qrId.trim() : '';
    if (!/^[a-zA-Z0-9_-]{6,64}$/.test(qrId)) {
      res.status(400).json({ ok: false });
      return;
    }

    const session = activeQrSessions.get(qrId);
    if (session && session.uid !== user.uid) {
      res.status(403).json({ ok: false });
      return;
    }
    if (session && session.status === 'active') {
      session.status = 'closed';
    }

    const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
    if (keyId && keySecret) {
      const authBasic = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      await fetch(`https://api.razorpay.com/v1/payments/qr_codes/${encodeURIComponent(qrId)}/close`, {
        method: 'POST',
        headers: { Authorization: `Basic ${authBasic}` },
      }).catch(() => {});
    }

    res.json({ ok: true, qrId });
  });

  // Razorpay server webhook with raw-body HMAC verification & QR payment synchronization
  app.post('/api/webhooks/razorpay', (req: AuthenticatedRequest, res) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || '';
    if (!webhookSecret) {
      res.status(503).json({ error: 'Razorpay webhook secret is not configured.' });
      return;
    }

    const providedSig = String(req.headers['x-razorpay-signature'] || '').trim().toLowerCase();
    const rawBody = req.rawBody;
    if (!rawBody || !/^[a-f0-9]{64}$/.test(providedSig)) {
      res.status(400).json({ error: 'Missing or invalid webhook signature.' });
      return;
    }

    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (!timingSafeHexEqual(expectedSig, providedSig)) {
      res.status(400).json({ error: 'Webhook signature mismatch.' });
      return;
    }

    const eventId = String(req.headers['x-razorpay-event-id'] || '').trim();
    if (eventId && processedWebhookEventIds.has(eventId)) {
      res.json({ received: true, duplicateEvent: true });
      return;
    }
    if (eventId) {
      prunePaymentRegistry();
      processedWebhookEventIds.add(eventId);
    }

    const payload = req.body as {
      event?: string;
      payload?: {
        qr_code?: { entity?: { id?: string; payment_amount?: number; status?: string } };
        payment?: {
          entity?: {
            id?: string;
            order_id?: string | null;
            amount?: number;
            currency?: string;
            status?: string;
            method?: string;
            vpa?: string;
            error_description?: string;
            notes?: { qr_code_id?: string };
          };
        };
      };
    };

    const event = payload?.event || 'unknown';
    const qrEntity = payload?.payload?.qr_code?.entity;
    const paymentEntity = payload?.payload?.payment?.entity;
    const targetQrId = qrEntity?.id || paymentEntity?.notes?.qr_code_id || '';

    if (event === 'qr_code.credited' && targetQrId && paymentEntity?.id) {
      const session = activeQrSessions.get(targetQrId);
      if (
        session &&
        paymentEntity.currency === 'INR' &&
        Number(paymentEntity.amount) === session.amountPaise &&
        (paymentEntity.status === 'captured' || paymentEntity.status === 'authorized')
      ) {
        session.status = 'paid';
        session.verifiedPaymentId = paymentEntity.id;
        session.razorpayOrderId = paymentEntity.order_id || targetQrId;
        session.methodUsed = paymentEntity.method || 'upi';
        session.vpa = paymentEntity.vpa || null;
      }
    } else if (event === 'qr_code.closed' && targetQrId) {
      const session = activeQrSessions.get(targetQrId);
      if (session && session.status === 'active') {
        session.status = 'expired';
      }
    } else if (event === 'payment.failed' && targetQrId) {
      const session = activeQrSessions.get(targetQrId);
      if (session && session.status === 'active') {
        session.status = 'failed';
        session.failureReason =
          paymentEntity?.error_description || 'UPI payment was declined by the issuing bank.';
      }
    }

    res.json({ received: true, event, handled: true });
  });

  app.post('/api/newsletter', (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || email.length > 200 || !emailPattern.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    res.json({ subscribed: true, email });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir, { index: false }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`NovaCart server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NovaCart server:', err);
  process.exit(1);
});

