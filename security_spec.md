# NovaCart Firestore Security Specification

## 1. Data Invariants
1. **Order Ownership, Verification & Isolation**: An order document in `/orders/{orderId}` can only be created by an email-verified user (`request.auth.token.email_verified == true`) with `userId == request.auth.uid`, valid COD (`pending`) or verified Razorpay (`confirmed` + `paid`) payment proof, and server-enforced timestamps (`createdAt == request.time`). Only the verified owning user or an admin can read an order; list queries require `resource.data.userId == request.auth.uid` (with verified email) or admin verification.
2. **Role Immutability & Privilege Prevention**: Users creating `/users/{userId}` must set `role == 'customer'` and cannot elevate `role` to `'admin'` on creation or update. Only the verified administrator (`preethammk147@gmail.com` or `/admins/{uid}` with `email_verified == true`) holds admin privileges.
3. **Email Verification Gate for Protected Features**: Unverified customer accounts cannot read/modify saved addresses, place or read orders, update profile contact/PII info, submit product reviews, or redeem promotional offers.
4. **PII Isolation**: User email, phone, and shipping address live in `/users/{userId}/private/info` and are strictly readable and writable only by the authenticated owner (verified for updates) or admin.
5. **Catalog & Promotional Offer Integrity**: Only verified admins may create, edit, or delete `/products/{productId}` and `/offers/{offerId}`. Verified buyers may only decrement product `stock` during checkout (`stock >= 0 && stock < existing.stock`).
6. **One-Time Offer Redemption Enforcement**: Records in `/offerRedemptions/{redemptionId}` can only be created by verified owners (`userId == request.auth.uid`, `status == 'Redeemed'`). For `oneTimeUse == true` offers, the document ID MUST be `${offerId}__${request.auth.uid}`, atomically blocking duplicate redemptions.
7. **No Shadow Fields**: All documents enforce `keys().hasAll(...)` and `keys().hasOnly(...)` on creation and `diff().affectedKeys().hasOnly(...)` on update.

## 2. Adversarial Payloads Blocked
1. **Role Escalation**: `POST /users/{uid}` with `{ role: 'admin', ... }` -> DENIED (`incoming().role == 'customer'`).
2. **Order Spoofing**: `POST /orders/{id}` with `userId: 'other-uid'` -> DENIED (`incoming().userId == request.auth.uid`).
3. **Unverified Account Bypass**: Unverified email user calling `POST /orders/{id}`, `POST /users/{uid}/addresses/{id}`, `POST /offerRedemptions/{id}`, or `POST /productReviews/{id}` -> DENIED (`isVerified()`).
4. **Cross-User Order Read / List Scrape**: `GET /orders/{otherOrderId}` or `LIST /orders` without `userId == request.auth.uid` as non-admin -> DENIED.
5. **Admin Privilege Spoofing**: Ordinary customer (even accessing `/admin`) attempting `POST /offers/{id}`, `DELETE /products/{id}`, or `LIST /offerRedemptions` -> DENIED (`isAdmin()`).
6. **Stale / Unauthorized Admin Email**: Legacy email `preethammk1409@gmail.com` without `/admins/{uid}` entry -> DENIED (`preethammk147@gmail.com` required).
7. **Duplicate One-Time Offer Redemption**: Second `POST /offerRedemptions/{customId}` for a `oneTimeUse == true` offer -> DENIED (deterministic `${offerId}__${uid}` key check + `allow create` collision rejection).
8. **Offer Tampering by Customer**: Non-admin `PATCH /offers/{code}` changing discount or status -> DENIED.
9. **Price Manipulation on Product**: Non-admin `PATCH /products/{id}` changing `price` -> DENIED (`affectedKeys().hasOnly(['stock', 'updatedAt'])`).
10. **Shadow Field Injection**: `POST /orders/{id}` or `POST /offers/{code}` adding unexpected keys -> DENIED (`keys().hasOnly(...)`).
11. **Timestamp Forgery**: `POST /orders/{id}`, `/offers/{code}`, or `/offerRedemptions/{id}` with client timestamp != `request.time` -> DENIED.
12. **PII Leak & ID Poisoning**: `GET /users/{otherUid}/private/info` or path traversal `../` IDs -> DENIED (`isValidId()`).
