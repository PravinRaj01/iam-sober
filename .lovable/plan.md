

# Fix Push Notifications: Service Worker Conflict Resolution

## Problem

The app registers **two competing service workers** on the same scope (`/`):
- VitePWA auto-generates and registers `/sw.js` at scope `/`
- `usePushNotifications.ts` manually registers `/sw-push.js` also at scope `/`

Only one service worker can control a scope at a time. When the push hook tries to register `/sw-push.js`, it either fails or conflicts with the existing PWA worker, causing the `pushManager.subscribe()` call to fail with "push service error."

The VAPID key endpoint is working correctly (confirmed via test call -- returns a valid key).

## Solution

Merge push notification handlers INTO the PWA service worker using Workbox's `importScripts`, and rewrite the hook to use the single PWA worker.

```text
BEFORE (broken):
  VitePWA registers /sw.js at scope /
  usePushNotifications registers /sw-push.js at scope /  <-- CONFLICT
  pushManager.subscribe() fails

AFTER (fixed):
  VitePWA registers /sw.js at scope /
  /sw.js loads push handlers via importScripts('/sw-push.js')
  usePushNotifications uses navigator.serviceWorker.ready (existing PWA SW)
  pushManager.subscribe() succeeds
```

---

## File Changes

### 1. `vite.config.ts`

Add `importScripts: ['/sw-push.js']` to the `workbox` config block. This tells the generated PWA service worker to load the push event handlers from `sw-push.js` at startup.

```js
workbox: {
  importScripts: ['/sw-push.js'],  // <-- ADD THIS
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  // ... rest unchanged
}
```

### 2. `src/hooks/usePushNotifications.ts` -- Full rewrite

Key changes:

**Remove all separate `/sw-push.js` registration code:**
- Delete the `getRegistration('/sw-push.js')` and `register('/sw-push.js')` calls in `useEffect`
- Delete the same pattern in `subscribe()` and `unsubscribe()`

**Use the existing PWA service worker instead:**
- Use `navigator.serviceWorker.ready` which resolves to the active PWA worker (the one that now includes push handlers via importScripts)

**Add stale worker cleanup:**
- On mount, find and unregister any leftover `/sw-push.js` registrations from previous attempts

**Add activation wait helper:**
- Sometimes `navigator.serviceWorker.ready` resolves before the worker is fully activated. Add a helper that waits for the `activated` state before calling `pushManager.subscribe()`

**Add detailed console logging at each step** so failures can be traced in DevTools.

**Improved error messages:**
- Detect HTTP 410 (expired subscription) and show a specific message
- Detect permission denial vs network errors separately

Logic flow:
```text
subscribe()
  1. Fetch VAPID key from get-vapid-key edge function
  2. Request browser notification permission
  3. Clean up any stale /sw-push.js registrations
  4. Get registration via navigator.serviceWorker.ready
  5. Ensure worker is in 'activated' state
  6. Call pushManager.subscribe({ applicationServerKey })
  7. Save subscription (endpoint, p256dh, auth) to push_subscriptions table
  8. Show success toast

unsubscribe()
  1. Get registration via navigator.serviceWorker.ready
  2. Get existing subscription and call unsubscribe()
  3. Delete record from push_subscriptions table
  4. Show success toast

checkSubscription() -- on mount
  1. Get registration via navigator.serviceWorker.ready
  2. Check pushManager.getSubscription()
  3. Set isSubscribed state accordingly
```

### 3. `public/sw-push.js` -- No changes needed

The push/notificationclick/notificationclose event handlers remain as-is. They will now execute in the context of the main PWA service worker via `importScripts`.

---

## Why This Works

- Workbox's `importScripts` option adds `importScripts('/sw-push.js')` to the top of the generated service worker file
- The push event listeners in `sw-push.js` are evaluated in the context of the main worker
- There is only ONE service worker controlling scope `/`, so no conflicts
- `navigator.serviceWorker.ready` resolves to this single worker, which now handles both caching AND push
- The VAPID key handshake works because the worker is properly activated before `pushManager.subscribe()` is called

---

## Files Modified

| File | Change |
|------|--------|
| `vite.config.ts` | Add `importScripts: ['/sw-push.js']` to workbox config |
| `src/hooks/usePushNotifications.ts` | Remove separate SW registration, use `navigator.serviceWorker.ready`, add stale cleanup, add activation wait, add logging |

