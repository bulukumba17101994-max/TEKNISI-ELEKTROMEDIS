// Notification & Background Service Worker Manager for SIM-ALKES UPTD RSUD LAMADDUKELLENG

let swRegistration: ServiceWorkerRegistration | null = null;

// Initialize and register Service Worker
export async function initServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    swRegistration = reg;
    console.log('SIM-ALKES Service Worker registered:', reg.scope);
    return reg;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

// Request Notification Permission from User
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (e) {
    return Notification.permission;
  }
}

export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export interface ShowSystemNotificationOptions {
  title: string;
  body: string;
  tag?: string;
  tab?: string;
  icon?: string;
  data?: any;
  requireInteraction?: boolean;
}

/**
 * Show system popup notification on Mobile (Android) or PC (Windows/Mac)
 * Works even when app is minimized or running in background
 */
export async function showSystemNotification({
  title,
  body,
  tag = 'sim-alkes-alert',
  tab = 'perbaikan',
  icon = '/logo-app.svg',
  data = {},
  requireInteraction = true,
}: ShowSystemNotificationOptions) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  const notificationOptions = {
    body,
    tag,
    icon,
    badge: icon,
    vibrate: [250, 100, 250, 100, 400],
    requireInteraction,
    data: {
      url: window.location.href,
      tab,
      ...data,
    },
  };

  // Try Service Worker registration first (for proper background delivery)
  if (swRegistration && 'showNotification' in swRegistration) {
    try {
      await swRegistration.showNotification(title, notificationOptions as any);
      return;
    } catch (e) {
      console.warn('SW showNotification error:', e);
    }
  }

  // If SW active via controller, post message
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      options: notificationOptions,
    });
    return;
  }

  // Fallback to standard Notification API
  try {
    const notif = new Notification(title, notificationOptions);
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  } catch (err) {
    console.warn('Native notification fallback error:', err);
  }
}
