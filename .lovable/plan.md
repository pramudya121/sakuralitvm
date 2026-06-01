# SIWE Implementation Plan

Replace the forgeable `x-wallet-address` header with cryptographically verified Sign-In With Ethereum (SIWE) sessions.

## What changes for the user

- On wallet connect, the wallet will pop up a "Sign message" request (one-time per session, ~30 days).
- After signing, the app gets a session token (JWT) stored in `localStorage`.
- All sensitive actions (profile edit, watchlist, offers, comments delete, likes, notifications, AI calls) require this signed session.
- Public reads (browsing NFTs, viewing listings, reading public comments/likes) remain unauthenticated.

## What changes under the hood

### 1. Database (one migration)

- New table `public.wallet_nonces` (wallet_address, nonce, expires_at) — short-lived challenges, server-only writes.
- Lock down sensitive tables so the publishable key can no longer mutate them directly:
  - `profiles`: drop owner insert/update policies (writes move to a server fn using `supabaseAdmin`).
  - `watchlist`: drop owner insert/delete policies (writes move to server fn).
  - `nft_offers`: drop bidder insert/update/delete policies (writes move to server fn).
  - `nft_comments` / `nft_likes` delete: drop header-based delete policies (writes move to server fn).
  - `notifications` update: drop header-based policy (mark-read moves to server fn).
- Keep all public-read policies intact.

### 2. New secret

- `SIWE_JWT_SECRET` — 32+ random bytes, used to sign session tokens (added via add_secret).

### 3. New server routes (`/api/public/siwe/*`)

- `POST /api/public/siwe/nonce` — body `{ address }`, issues a nonce + the SIWE message to sign.
- `POST /api/public/siwe/verify` — body `{ message, signature }`, verifies with `ethers.verifyMessage`, deletes the nonce, returns a signed JWT `{ wallet, exp }` valid for 30 days.

### 4. New middleware

- `requireSiwe` (server-fn middleware) — reads `Authorization: Bearer <jwt>`, verifies with `SIWE_JWT_SECRET`, injects `context.wallet` (lowercased, verified address). Throws 401 on missing/invalid/expired.
- `attachSiweJwt` (client middleware in `src/start.ts`) — reads `siwe_jwt` from `localStorage`, attaches as `Authorization` header on every server-fn call. Appended to existing `functionMiddleware`.

### 5. Rewrite sensitive logic as server fns

All using `supabaseAdmin` after `requireSiwe`:

- `src/lib/profile.functions.ts` — `upsertProfile(patch)` (wallet taken from verified context, not input).
- `src/lib/watchlist.functions.ts` — `toggleWatchlist(tokenId)`.
- `src/lib/offers.functions.ts` — `createOffer`, `updateOffer`, `cancelOffer`.
- `src/lib/comments.functions.ts` — `deleteComment(id)` (verifies caller owns it).
- `src/lib/likes.functions.ts` — `toggleLike(tokenId)`.
- `src/lib/notifications.functions.ts` — replace header check with `requireSiwe`; add `markNotificationsRead`.
- `src/lib/ai-chat.functions.ts`, `src/lib/ai.functions.ts` — swap header check for `requireSiwe` (paid endpoints).

### 6. Frontend changes

- `src/contexts/WalletContext.tsx` — after wallet connects, if no valid `siwe_jwt` in localStorage (or it's expired), call the SIWE flow: fetch nonce → `personal_sign` → POST verify → store JWT. Expose `siweReady` state. Clear JWT on disconnect.
- Replace existing `supabase.from(...).insert/update/delete` calls for sensitive tables with the new server fns:
  - `useProfile.save` → `upsertProfile`
  - `useWatchlist.toggle` → `toggleWatchlist`
  - `useNFTLikes.toggle` → `toggleLike`
  - `useNFTComments.remove` → `deleteComment`
  - `useNotifications.markAllRead` → `markNotificationsRead`
  - Offer create/update/cancel sites → `createOffer` / `updateOffer` / `cancelOffer`
- Remove the old `attachWalletHeader` client middleware; remove `x-wallet-address` references from `client.ts` global headers if any.

### 7. Keep public reads on publishable key

- Browsing NFTs, listings, public profiles, comments, likes counts — all stay as direct `supabase.from(...).select()` from the browser. Nothing changes for unauthenticated users.

## Files touched

**New (~10):**
- `src/lib/siwe.server.ts` (JWT sign/verify, nonce helpers)
- `src/lib/siwe-middleware.ts` (`requireSiwe`)
- `src/lib/siwe-attacher.ts` (client middleware)
- `src/routes/api/public/siwe/nonce.ts`
- `src/routes/api/public/siwe/verify.ts`
- `src/lib/profile.functions.ts`
- `src/lib/watchlist.functions.ts`
- `src/lib/offers.functions.ts`
- `src/lib/comments.functions.ts`
- `src/lib/likes.functions.ts`
- One migration

**Edited (~8):**
- `src/contexts/WalletContext.tsx` (SIWE flow on connect)
- `src/start.ts` (register `attachSiweJwt`)
- `src/lib/supabase-hooks.ts` (route mutations through server fns)
- `src/lib/notifications.functions.ts` (use SIWE)
- `src/lib/ai-chat.functions.ts`, `src/lib/ai.functions.ts` (use SIWE)
- `src/components/MyNFTOffers.tsx`, `src/routes/marketplace.$id.tsx` (or wherever offers are created) — call new server fns
- Remove `src/lib/web3/wallet-header-middleware.ts` or stop registering it

## Risk / rollout

- **Breaking for active users**: on first load after deploy, they will see a "Sign message" prompt. Existing connected wallets without a JWT will fail to mutate until they sign.
- **AI endpoints**: any wallet not signed-in cannot call AI features (chat, image gen, description gen). This is the intended hardening.
- I will keep `useServerFn` retries for transient JWT-missing errors, so the UI can trigger SIWE then auto-retry.

## Security memory

After implementation I'll update the security memory to record: SIWE JWT is the only trusted wallet identity; `x-wallet-address` header is no longer used; all sensitive writes go through server fns + `supabaseAdmin`; RLS is backstop only for those tables (no public write policies).
