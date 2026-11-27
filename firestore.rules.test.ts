import fs from 'node:fs';
import assert from 'node:assert';

/**
 * Verification harness asserting that firestore.rules contains all
 * required Eight Pillars guards against adversarial payloads.
 */
const rules = fs.readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');

const requiredAssertions: Array<[string, RegExp]> = [
  ['Rules v2 header', /rules_version\s*=\s*'2'/],
  ['Global default deny catch-all', /match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;\s*\}/],
  ['isValidId path guard', /function\s+isValidId\(id\)/],
  ['Email verification gate', /request\.auth\.token\.email_verified\s*==\s*true/],
  ['Authorized admin email preethammk147@gmail.com', /request\.auth\.token\.email\s*==\s*'preethammk147@gmail\.com'/],
  ['No stale admin email preethammk1409@gmail.com', /^(?!.*preethammk1409@gmail\.com).*$/s],
  ['Strict role customer on user create', /incoming\(\)\.role\s*==\s*'customer'/],
  ['Order owner & verified enforcement on create', /match\s+\/orders\/\{orderId\}[\s\S]*allow\s+create:\s*if\s+isVerified\(\)/],
  ['Order pending status on COD create', /incoming\(\)\.status\s*==\s*'pending'/],
  ['Online order requires verified Razorpay payment IDs', /incoming\(\)\.razorpayPaymentId\.size\(\)\s*>=\s*6/],
  ['6-step order tracking statuses', /out_for_delivery/],
  ['8 payment method allowlist', /debit_card.*credit_card/],
  ['Order list isolation', /allow\s+list:\s*if\s+isSignedIn\(\)\s*&&\s*\(\(isVerified\(\)\s*&&\s*resource\.data\.userId\s*==\s*request\.auth\.uid\)\s*\|\|\s*isAdmin\(\)\)/],
  ['PII private info owner gate', /match\s+\/private\/\{docId\}/],
  ['User saved addresses verified owner gate', /match\s+\/addresses\/\{addressId\}[\s\S]*allow\s+get,\s*list:\s*if\s+isVerifiedOwner\(userId\)\s*\|\|\s*isAdmin\(\)/],
  ['Top-level carts owner isolation', /match\s+\/carts\/\{userId\}/],
  ['Top-level wishlists owner isolation', /match\s+\/wishlists\/\{userId\}/],
  ['Product reviews verified userId isolation', /match\s+\/productReviews\/\{reviewId\}[\s\S]*allow\s+create:\s*if\s+isVerified\(\)/],
  ['Product stock decrement guard', /affectedKeys\(\)\.hasOnly\(\['stock',\s*'updatedAt'\]\)/],
  ['Offers admin-only mutation guard', /match\s+\/offers\/\{offerId\}[\s\S]*allow\s+create:\s*if\s+isAdmin\(\)/],
  ['Offer redemptions verified owner & one-time-use guard', /match\s+\/offerRedemptions\/\{redemptionId\}[\s\S]*redemptionId\s*==\s*\(incoming\(\)\.offerId\s*\+\s*'__'\s*\+\s*request\.auth\.uid\)/],
  ['Offer redemptions list isolation', /match\s+\/offerRedemptions\/\{redemptionId\}[\s\S]*allow\s+list:\s*if\s+isSignedIn\(\)\s*&&\s*\(\(isVerified\(\)\s*&&\s*resource\.data\.userId\s*==\s*request\.auth\.uid\)\s*\|\|\s*isAdmin\(\)\)/],
  ['Server timestamp enforcement', /request\.time/],
  ['Newsletter read restricted to admin', /allow\s+get:\s*if\s+isAdmin\(\)/],
];

for (const [label, pattern] of requiredAssertions) {
  assert.ok(pattern.test(rules), `Missing security rule guard: ${label}`);
}

console.log(`All ${requiredAssertions.length} security rule invariants verified.`);
