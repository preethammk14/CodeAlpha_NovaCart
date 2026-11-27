export const INDIAN_PIN_CODE_REGEX = /^[1-9]\d{5}$/;

export interface PinInputNormalizationResult {
  value: string;
  hadInvalidChars: boolean;
}

/**
 * Safely coerces stored or Firestore-hydrated postal code values to a
 * 0-6 digit numeric string without ever converting to a JS number.
 */
export function coerceStoredPinCode(raw: unknown): string {
  if (raw == null) return '';
  return String(raw).replace(/\D/g, '').slice(0, 6);
}

/**
 * Normalizes live user input for an Indian 6-digit PIN code field.
 * Strips non-digits (so existing digits are preserved if an invalid key is pressed)
 * and limits length to 6 digits without clearing or overwriting valid digits.
 */
export function normalizeIndianPinInput(raw: string): PinInputNormalizationResult {
  const rawStr = String(raw ?? '');
  const hadInvalidChars = /[^\d\s]/.test(rawStr);
  const value = rawStr.replace(/\D/g, '').slice(0, 6);
  return { value, hadInvalidChars };
}

/**
 * Validates a 6-digit Indian PIN code (first digit 1-9, remaining 5 digits 0-9).
 * Returns a clear human-readable error message or null when valid.
 */
export function validateIndianPinCode(pin: unknown): string | null {
  const cleaned = typeof pin === 'string' ? pin.trim() : String(pin ?? '').trim();

  if (!cleaned) {
    return 'Please enter a 6-digit Indian PIN code (e.g., 560038).';
  }
  if (!/^\d+$/.test(cleaned)) {
    return 'PIN code must contain numbers only (0–9).';
  }
  if (cleaned.length !== 6) {
    return 'Please enter all 6 digits of your PIN code (e.g., 560038).';
  }
  if (!INDIAN_PIN_CODE_REGEX.test(cleaned)) {
    return 'Indian PIN codes cannot start with 0. Please enter a valid 6-digit PIN (e.g., 560038).';
  }

  return null;
}
