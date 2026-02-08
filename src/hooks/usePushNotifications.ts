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
 * Remove any stale /sw-push.js registrations left over from previous attempts.
 * Only the main PWA worker (/sw.js) should be registered.
 */
const cleanupStaleWorkers = async () => {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      if (reg.active?.scriptURL?.includes('sw-push.js')) {
        console.log('[Push] Unregistering stale sw-push.js worker');
        await reg.unregister();
      }
    }
  } catch (err) {
    console.warn('[Push] Error cleaning up stale workers:', err);
  }
};

/**
 * Wait until the service worker registration has an active (activated) worker.
 * navigator.serviceWorker.ready can resolve before the worker is fully activated.
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
    }, 10000);
    sw.addEventListener('statechange', () => {
      console.log('[Push] SW state changed to:', sw.state);
      if (sw.state === 'activated') {
        clearTimeout(timeout);
        resolve(registration);
      }
    });
  });
};

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const vapidKeyRef = useRef<string | null>(null);
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

      // Clean up any stale sw-push.js registrations from previous attempts
      await cleanupStaleWorkers();

      // Check if already subscribed via the PWA service worker
      try {
        const registration = await navigator.serviceWorker.ready;
        console.log('[Push] PWA SW ready, scope:', registration.scope);
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
        console.log('[Push] Existing subscription:', !!subscription);
      } catch (error) {
        console.error('[Push] Error checking subscription:', error);
      }
    };

    init();
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      toast({
        title: 'Not supported',
        description: 'Push notifications are not supported in this browser.',
        variant: 'destructive',
      });
      return false;
    }

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

      // 3. Clean up stale workers
      console.log('[Push] Step 3: Cleaning up stale workers...');
      await cleanupStaleWorkers();

      // 4. Get the PWA service worker registration
      console.log('[Push] Step 4: Getting PWA service worker...');
      const registration = await navigator.serviceWorker.ready;
      console.log('[Push] SW ready, scope:', registration.scope, 'active:', !!registration.active);

      // 5. Ensure the worker is fully activated
      console.log('[Push] Step 5: Ensuring SW is activated...');
      await waitForActivation(registration);
      console.log('[Push] SW is activated');

      // 6. Subscribe to push
      console.log('[Push] Step 6: Subscribing to push...');
      const applicationServerKey = urlBase64ToUint8Array(vapidKeyRef.current!);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });
      console.log('[Push] Subscription created:', subscription.endpoint.substring(0, 50) + '...');

      // 7. Save to Supabase
      console.log('[Push] Step 7: Saving subscription to database...');
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

      // Provide specific error messages for common failures
      if (error.message?.includes('push service')) {
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
      setIsLoading(false);
    }
  }, [isSupported, toast]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);

    try {
      console.log('[Push] Unsubscribing...');
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        console.log('[Push] Browser subscription removed');
      }

      // Remove from database
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
