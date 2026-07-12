'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { saveSubscriptionAction } from '@/app/actions/pushActions';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushRegister() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;

    async function registerPush() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Powiadomienia Push nie są obsługiwane w tej przeglądarce.');
        return;
      }

      try {
        // Rejestracja Service Workera
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker zarejestrowany pomyślnie:', registration);

        // Zapytanie o zgodę na powiadomienia
        let permission = Notification.permission;
        if (permission === 'default') {
          permission = await Notification.requestPermission();
        }

        if (permission !== 'granted') {
          console.log('Użytkownik nie wyraził zgody na powiadomienia.');
          return;
        }

        // Pobranie klucza VAPID publicznego
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          console.warn('Brak klucza VAPID publicznego w konfiguracji (NEXT_PUBLIC_VAPID_PUBLIC_KEY).');
          return;
        }

        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

        // Sprawdzenie czy subskrypcja już istnieje
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          // Tworzenie nowej subskrypcji
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey
          });
        }

        // Przesłanie subskrypcji do bazy danych
        const subData = JSON.parse(JSON.stringify(subscription));
        const res = await saveSubscriptionAction({
          endpoint: subData.endpoint,
          keys: {
            p256dh: subData.keys.p256dh,
            auth: subData.keys.auth
          }
        });

        if (res.success) {
          console.log('Pomyślnie zarejestrowano powiadomienia Push na urządzeniu.');
        } else {
          console.error('Błąd podczas zapisywania subskrypcji push:', res.error);
        }
      } catch (err) {
        console.error('Błąd rejestracji Web Push:', err);
      }
    }

    // Wywołaj rejestrację z opóźnieniem, aby nie blokować ładowania strony
    const timer = setTimeout(() => {
      registerPush();
    }, 2000);

    return () => clearTimeout(timer);
  }, [status, session]);

  // Nasłuchuje zdarzeń NAVIGATE wysłanych z sw.js (po kliknięciu powiadomienia)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    function handleMessage(event: MessageEvent) {
      if (event.data && event.data.type === 'NAVIGATE') {
        window.location.href = event.data.url;
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, []);

  return null;
}
