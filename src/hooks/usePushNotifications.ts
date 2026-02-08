import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Convert a URL-safe base64 VAPID key to a Uint8Array for pushManager.subscribe()
 */
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

/**
 * Unregister ALL service workers. Used as a nuclear option before manual registration
 * to clear any broken/stale workers blocking new registrations.
 */
const unregisterAllWorkers = async (): Promise<void> => {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    console.log(`[Push] Found ${registrations.length} existing SW registration(s)`);
    for (const reg of registrations) {
      const url = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || 'unknown';
      console.log('[Push] Unregistering:', url);
      await reg.unregister();
    }
  } catch (err) {
    console.warn('[Push] Error unregistering workers:', err);
  }
};

/**
 * navigator.serviceWorker.ready NEVER rejects. If the SW registration failed,
 * it hangs forever. This wrapper adds a timeout.
 */
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

/**
 * Wait until the service worker is in the 'activated' state.
 */
const waitForActivation = (registration: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> => {
  return new Promise((resolve, reject) => {
    const sw = registration.active || registration.installing || registration.waiting;
    if (!sw) {
      reject(new Error('No service worker found in registration'));
      return;
    }
    if (sw.state === 'activated') {
      resolve(registration);
      return;
    }
    console.log('[Push] Waiting for SW activation, current state:', sw.state);
    const timeout = setTimeout(() => {
      reject(new Error('Service worker activation timed out'));
    }, 15000);
    sw.addEventListener('statechange', () => {
      console.log('[Push] SW state changed to:', sw.state);
      if (sw.state === 'activated') {
        clearTimeout(timeout);
        resolve(registration);
      }
      if (sw.state === 'redundant') {
        clearTimeout(timeout);
        reject(new Error('Service worker became redundant'));
      }
    });
  });
};

/**
 * Get a working service worker registration with aggressive fallback:
 * 1. Try navigator.serviceWorker.ready (VitePWA auto-registration) with 5s timeout
 * 2. If that fails, unregister ALL workers, then manually register /sw.js fresh
 * 3. If manual registration also fails (AbortError), wait 1s and retry once
 */
const getServiceWorkerRegistration = async (): Promise<ServiceWorkerRegistration> => {
  // Attempt 1: Check if VitePWA auto-registration already succeeded
  try {
    const registration = await waitForServiceWorkerReady(5000);
    console.log('[Push] SW ready via auto-registration, scope:', registration.scope);
    return registration;
  } catch (e) {
    console.log('[Push] Auto-registration not ready:', (e as Error).message);
  }

  // Attempt 2: Nuclear cleanup + manual registration
  console.log('[Push] Clearing all workers and registering fresh...');
  await unregisterAllWorkers();
  // Brief pause to let the browser finish unregistration
  await new Promise(r => setTimeout(r, 500));

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[Push] Manual registration succeeded, waiting for activation...');
    await waitForActivation(registration);
    console.log('[Push] Manual SW activated');
    return registration;
  } catch (firstError: any) {
    console.warn('[Push] First manual registration failed:', firstError.name, firstError.message);

    // Attempt 3: Retry once after a delay (AbortError can be transient)
    if (firstError.name === 'AbortError') {
      console.log('[Push] AbortError detected, retrying in 2 seconds...');
      await new Promise(r => setTimeout(r, 2000));
      await unregisterAllWorkers();
      await new Promise(r => setTimeout(r, 500));

      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[Push] Retry registration succeeded, waiting for activation...');
      await waitForActivation(registration);
      console.log('[Push] Retry SW activated');
      return registration;
    }

    throw firstError;
  }
};

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const vapidKeyRef = useRef<string | null>(null);
  const subscribingRef = useRef(false); // Guard against concurrent calls
  const { toast } = useToast();

  // Check support and existing subscription on mount
  useEffect(() => {
    const init = async () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window;
      setIsSupported(supported);
      if (!supported) {
        console.log('[Push] Push notifications not supported in this browser');
        return;
      }

      // Check existing subscription with timeout — don't block the UI
      try {
        const registration = await waitForServiceWorkerReady(3000);
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
        console.log('[Push] Existing subscription:', !!subscription);
      } catch {
        console.log('[Push] SW not ready on init, skipping subscription check');
      }
    };

    init();
  }, []);

  const subscribe = useCallback(async () => {
    // Prevent double-invocation (React strict mode, double-clicks, etc.)
    if (subscribingRef.current) {
      console.log('[Push] Subscribe already in progress, ignoring duplicate call');
      return false;
    }

    if (!isSupported) {
      toast({
        title: 'Not supported',
        description: 'Push notifications are not supported in this browser.',
        variant: 'destructive',
      });
      return false;
    }

    subscribingRef.current = true;
    setIsLoading(true);

    try {
      // 1. Fetch VAPID key
      console.log('[Push] Step 1: Fetching VAPID key...');
      if (!vapidKeyRef.current) {
        const { data, error } = await supabase.functions.invoke('get-vapid-key');
        if (error || !data?.vapidPublicKey) {
          throw new Error('Failed to fetch VAPID key from server');
        }
        vapidKeyRef.current = data.vapidPublicKey;
        console.log('[Push] VAPID key fetched, length:', data.vapidPublicKey.length);
      }

      // 2. Request notification permission
      console.log('[Push] Step 2: Requesting notification permission...');
      const permission = await Notification.requestPermission();
      console.log('[Push] Permission result:', permission);

      if (permission !== 'granted') {
        toast({
          title: 'Permission denied',
          description: 'Please enable notifications in your browser settings.',
          variant: 'destructive',
        });
        return false;
      }

      // 3. Get service worker (with timeout, cleanup, manual fallback, and retry)
      console.log('[Push] Step 3: Getting service worker...');
      const registration = await getServiceWorkerRegistration();
      console.log('[Push] SW ready, scope:', registration.scope, 'active:', !!registration.active);

      // 4. Subscribe to push
      console.log('[Push] Step 4: Subscribing to push...');
      const applicationServerKey = urlBase64ToUint8Array(vapidKeyRef.current!);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });
      console.log('[Push] Subscription created:', subscription.endpoint.substring(0, 50) + '...');

      // 5. Save to Supabase
      console.log('[Push] Step 5: Saving subscription to database...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const subscriptionJson = subscription.toJSON();
      const keys = subscriptionJson.keys || {};

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscriptionJson.endpoint || '',
          p256dh: keys.p256dh || '',
          auth: keys.auth || '',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('[Push] Error saving subscription:', error);
        throw new Error('Failed to save subscription to database');
      }

      console.log('[Push] ✅ Push notifications enabled successfully');
      setIsSubscribed(true);
      toast({
        title: 'Notifications enabled!',
        description: 'You will receive proactive AI check-ins and reminders.',
      });

      return true;
    } catch (error: any) {
      console.error('[Push] ❌ Error subscribing:', error);

      let description = error.message || 'Failed to enable push notifications.';

      if (error.name === 'AbortError') {
        description = 'Service worker registration failed. Please clear your browser\'s site data (Settings → Privacy → Clear browsing data → choose this site), then reload and try again.';
      } else if (error.message?.includes('timed out')) {
        description = 'Service worker is taking too long. Please reload the page and try again.';
      } else if (error.message?.includes('redundant')) {
        description = 'Service worker was replaced. Please reload the page and try again.';
      } else if (error.message?.includes('push service')) {
        description = 'Push service error. Try clearing site data in browser settings and retry.';
      } else if (error.code === 11 || error.name === 'InvalidStateError') {
        description = 'Service worker not ready. Please refresh the page and try again.';
      }

      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
      return false;
    } finally {
      subscribingRef.current = false;
      setIsLoading(false);
    }
  }, [isSupported, toast]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);

    try {
      console.log('[Push] Unsubscribing...');
      const registration = await waitForServiceWorkerReady(5000);
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        console.log('[Push] Browser subscription removed');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id);
        console.log('[Push] Database record deleted');
      }

      setIsSubscribed(false);
      toast({
        title: 'Notifications disabled',
        description: 'You will no longer receive push notifications.',
      });

      return true;
    } catch (error: any) {
      console.error('[Push] Error unsubscribing:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to disable push notifications.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
};

export default usePushNotifications;
