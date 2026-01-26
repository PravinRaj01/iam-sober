import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// VAPID public key - this is the PUBLIC key, safe to expose in client code
const VAPID_PUBLIC_KEY = 'BJiWF4fQVaBCLGSc49uFdU326Uti7gCfwfY5X3xo26Nz3OgsjMn9aFPHjj8r4jYHE5rKhlFOCW5po1WgzyTUfiM';

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if push notifications are supported
    const checkSupport = async () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window;
      setIsSupported(supported);
      
      if (supported) {
        // Register the push service worker if not already registered
        try {
          const existingRegistration = await navigator.serviceWorker.getRegistration('/sw-push.js');
          if (!existingRegistration) {
            await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
            console.log('Push service worker registered');
          }
        } catch (err) {
          console.error('Failed to register push service worker:', err);
        }
        
        checkSubscription();
      }
    };

    checkSupport();
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw-push.js');
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      }
    } catch (error) {
      console.error('Error checking push subscription:', error);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

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
      // Request notification permission
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        toast({
          title: 'Permission denied',
          description: 'Please enable notifications in your browser settings.',
          variant: 'destructive',
        });
        return false;
      }

      // Get service worker registration for push
      let registration = await navigator.serviceWorker.getRegistration('/sw-push.js');
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
        // Wait for the service worker to be ready
        await navigator.serviceWorker.ready;
      }

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Get subscription keys
      const subscriptionJson = subscription.toJSON();
      const keys = subscriptionJson.keys || {};
      
      // Save to Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Save subscription to database
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
        console.error('Error saving subscription:', error);
        throw new Error('Failed to save subscription');
      }

      setIsSubscribed(true);
      toast({
        title: 'Notifications enabled!',
        description: 'You will receive proactive AI check-ins and reminders.',
      });

      return true;
    } catch (error: any) {
      console.error('Error subscribing to push notifications:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to enable push notifications.',
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
      const registration = await navigator.serviceWorker.getRegistration('/sw-push.js');
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await subscription.unsubscribe();
        }
      }

      // Remove from database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id);
      }

      setIsSubscribed(false);
      toast({
        title: 'Notifications disabled',
        description: 'You will no longer receive push notifications.',
      });

      return true;
    } catch (error: any) {
      console.error('Error unsubscribing from push notifications:', error);
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
