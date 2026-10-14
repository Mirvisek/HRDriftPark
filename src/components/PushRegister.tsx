'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getVapidPublicKeyAction, saveSubscriptionAction } from '@/app/actions/pushActions';

function urlBase64ToUint8Array(base64String: string) {
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
}

type Prompt = 'ask' | 'denied' | 'ios' | 'nokey' | null;

export function PushRegister() {
  const { data: session, status } = useSession();
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [busy, setBusy] = useState(false);

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

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (ios && !standalone) {
      setPrompt('ios');
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'denied') {
      setPrompt('denied');
      return;
    }

    if (Notification.permission === 'granted') {
      void subscribe();
      return;
    }

    setPrompt('ask');
  }, [status, session]);

  async function subscribe() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const { key } = await getVapidPublicKeyAction();
      if (!key) {
        setPrompt('nokey');
        return;
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });
      }

      const subData = JSON.parse(JSON.stringify(subscription));
      const res = await saveSubscriptionAction({
        endpoint: subData.endpoint,
        keys: {
          p256dh: subData.keys.p256dh,
          auth: subData.keys.auth,
        },
      });

      if (!res.success) {
        console.error('Błąd podczas zapisywania subskrypcji push:', res.error);
        return;
      }
      setPrompt(null);
    } catch (err) {
      console.error('Błąd rejestracji Web Push:', err);
    } finally {
      setBusy(false);
    }
  }

  async function enable() {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setPrompt('denied');
      return;
    }
    await subscribe();
  }

  if (!prompt) return null;

  const text = prompt === 'ios'
    ? 'Na iPhonie dodaj stronę do ekranu początkowego i otwórz ją stamtąd. Safari w karcie nie przyjmuje powiadomień push.'
    : prompt === 'denied'
      ? 'Powiadomienia są zablokowane w przeglądarce. Włącz je w ustawieniach strony.'
      : prompt === 'nokey'
        ? 'Serwer nie ma klucza powiadomień. Ustaw klucze VAPID i przebuduj aplikację.'
        : 'Włącz powiadomienia, żeby dostawać grafik i alerty na tym urządzeniu.';

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-lg flex-col gap-3 rounded-xl border border-white/10 bg-[#1a1a1a] p-4 sm:flex-row sm:items-center" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
      <p className="text-sm text-[#e0e0e0]">{text}</p>
      {prompt === 'ask' && (
        <button
          type="button"
          onClick={() => void enable()}
          disabled={busy}
          className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {busy ? 'Włączanie...' : 'Włącz'}
        </button>
      )}
    </div>
  );
}
