'use client';

import { useEffect, useState } from 'react';

export function ShiftDuration({ startedAt }: { startedAt?: string | null }) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!startedAt) {
      setText('');
      return;
    }

    const tick = () => {
      const diffMs = Math.max(0, Date.now() - new Date(startedAt).getTime());
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      setText(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (!text) return null;
  return <span className="font-mono">{text}</span>;
}
