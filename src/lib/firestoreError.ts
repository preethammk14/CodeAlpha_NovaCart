import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function extractReadableError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!err) return fallback;
  const raw = err instanceof Error ? err.message : String(err);
  if (!raw) return fallback;

  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as Partial<FirestoreErrorInfo>;
      if (parsed && typeof parsed.error === 'string' && parsed.error) {
        const lower = parsed.error.toLowerCase();
        if (lower.includes('permission') || lower.includes('insufficient')) {
          return 'Action could not be authorized for your current session. Please refresh or sign in again.';
        }
        if (lower.includes('unavailable') || lower.includes('network') || lower.includes('offline')) {
          return 'Network connection interrupted while communicating with the store database. Please retry.';
        }
        return parsed.error;
      }
    } catch {
      // Fall through to raw check
    }
  }

  return raw;
}
