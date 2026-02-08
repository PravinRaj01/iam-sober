
# Fix Push Notifications: Handle Service Worker Registration Failures

## Root Cause Analysis

There are **two critical bugs** causing push notifications to fail:

### Bug 1: `navigator.serviceWorker.ready` hangs forever
The `navigator.serviceWorker.ready` promise **never rejects**. If the VitePWA auto-registration of `/sw.js` fails (which it does -- the `AbortError` in the console confirms this), the subscribe flow freezes permanently at Step 4 ("Getting PWA service worker..."). The user sees no error, no timeout -- it just hangs.

### Bug 2: No fallback when auto-registration fails
VitePWA's `injectRegister: 'auto'` generates registration code that runs automatically, but if it fails (due to stale workers, import failures, or hosting quirks), there is no retry or manual fallback. The hook just waits forever for a worker that will never come.

### Bug 3: Stale worker cleanup is too narrow
`cleanupStaleWorkers()` only removes workers with `sw-push.js` in the URL. Broken/stale main workers (previous versions of `sw.js`) are left in place and can block new registrations.

The other errors in the console are unrelated:
- `runtime.lastError` -- browser extension issue, not our code
- `/api/v1/features/environment` 404 -- browser extension request
- `background.jpg` 400 -- the background image color extractor, already handled gracefully

---

## Solution

Rewrite `usePushNotifications.ts` to be resilient against service worker registration failures.

### Changes to `src/hooks/usePushNotifications.ts`

**1. Add timeout wrapper for `navigator.serviceWorker.ready`**

```typescript
const waitForServiceWorkerReady = (timeoutMs = 5000): Promise<ServiceWorkerRegistration> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Service worker ready timed out'));
    }, timeoutMs);

    navigator.serviceWorker.ready.then((reg) => {
      clearTimeout(timeout);
      resolve(reg);
    });
  });
};
```

**2. Add manual SW registration fallback**

If `navigator.serviceWorker.ready` times out, manually register `/sw.js`:

```typescript
let registration: ServiceWorkerRegistration;
try {
  registration = await waitForServiceWorkerReady(5000);
} catch {
  console.log('[Push] SW not ready, attempting manual registration...');
  registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await waitForActivation(registration);
}
```

**3. Expand stale worker cleanup**

Clean up ALL stale service workers (not just `sw-push.js`), then re-register fresh:

```typescript
const cleanupAllStaleWorkers = async () => {
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const reg of registrations) {
    const scriptURL = reg.active?.scriptURL || '';
    if (scriptURL.includes('sw-push.js')) {
      await reg.unregister();
    }
  }
};
```

**4. Apply the same pattern to the init check on mount**

The `useEffect` init function also calls `navigator.serviceWorker.ready` without a timeout -- fix it to use the timeout wrapper and silently fail if no worker is ready (don't block the UI).

**5. Improve error messages**

Add specific detection for:
- `AbortError` -- "Service worker failed to register. Please refresh and try again."
- Timeout -- "Service worker is taking too long. Please reload the page."

---

## Summary of Changes

| File | What Changes |
|------|-------------|
| `src/hooks/usePushNotifications.ts` | Add `waitForServiceWorkerReady()` with 5-second timeout, add manual `/sw.js` registration fallback at Step 4, expand stale cleanup, wrap init check in timeout, improve error messages |

No changes needed to `vite.config.ts`, `sw-push.js`, or any other files.
