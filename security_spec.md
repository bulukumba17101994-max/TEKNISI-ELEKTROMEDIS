# Security Specification — SIM-ALKES UPTD RSUD Lamaddukelleng

## 1. Data Invariants
1. **Identity Integrity**: Every user profile (`/users/{userId}`) must have `uid == request.auth.uid == userId` and `request.auth.token.email_verified == true`. Self-registration cannot assign `role: "admin"` unless performed by the verified bootstrap admin (`bulukumba17101994@gmail.com`) or an existing admin.
2. **PII Isolation**: User email addresses and personal profiles under `/users/{userId}` are readable only by the document owner or verified admins. Blanket reads on `/users` are strictly forbidden.
3. **Immutable Ownership & Timestamps**: All operational records (`/alkes`, `/pemeliharaan`, `/perbaikan`, `/beritaAcara`, `/ruangan`) enforce `ownerId == request.auth.uid` on creation, preserve `ownerId` and `createdAt` immutably on update, and require `createdAt == request.time` and `updatedAt == request.time`.
4. **Master Gate & Parent Existence**: Subcollection comments under `/perbaikan/{perbaikanId}/comments/{commentId}` verify via `exists()` that the parent `/perbaikan/{perbaikanId}` exists and restrict writes to the repair owner or verified admins.
5. **Terminal State Locking**: Once a `/perbaikan/{perbaikanId}` record reaches `statusPerbaikan == "Selesai (Alat Normal)"`, non-admin users cannot mutate or reopen it (admin override remains permitted).
6. **Zero-Lookup List Queries**: `allow list` rules never invoke `get()` or `exists()`; they evaluate `isBootstrapAdmin()` (token email + `email_verified == true`) or `resource.data.ownerId == request.auth.uid`.
7. **Strict Key & Size Boundaries**: Every write validates exact required + allowed keys via `hasAll` / `hasOnly` (on create) and `affectedKeys().hasOnly(...)` (on update), validates every string `.size()`, and checks ID path variables with `isValidId()`.

## 2. "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Write**: Creating `/alkes/ALK-01` with `request.auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Admin Spoof**: Calling `isBootstrapAdmin()` with `email == "bulukumba17101994@gmail.com"` and `email_verified == false` -> `PERMISSION_DENIED`.
3. **Privilege Escalation on Signup**: Non-admin user creating `/users/{uid}` with `role: "admin"` -> `PERMISSION_DENIED`.
4. **Role Tampering on Update**: Non-admin user updating `/users/{uid}` changing `role` from `"user"` to `"admin"` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: Creating `/alkes/ALK-01` with an extra undeclared field `isVerified: true` -> `PERMISSION_DENIED`.
6. **Path ID Poisoning**: Creating `/alkes/bad..id$123` or a 1,500-character document ID -> `PERMISSION_DENIED`.
7. **Ownership Spoofing**: User A creating `/perbaikan/SPK-99` with `ownerId: "userB"` -> `PERMISSION_DENIED`.
8. **Client Timestamp Forgery**: Creating `/alkes/ALK-01` with backdated `createdAt` not equal to `request.time` -> `PERMISSION_DENIED`.
9. **Terminal State Bypass**: Non-admin updating `/perbaikan/SPK-01` after `statusPerbaikan == "Selesai (Alat Normal)"` -> `PERMISSION_DENIED`.
10. **Orphaned Comment Injection**: Creating `/perbaikan/NON_EXISTENT/comments/C-1` when parent `/perbaikan/NON_EXISTENT` does not exist -> `PERMISSION_DENIED`.
11. **PII Cross-User Read**: User A calling `get(/users/userB)` -> `PERMISSION_DENIED`.
12. **Resource Exhaustion / Oversized String**: Creating `/perbaikan/SPK-02` with a 50KB `keluhanKerusakan` string -> `PERMISSION_DENIED`.
