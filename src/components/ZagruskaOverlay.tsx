import React, { useEffect, useState } from 'react';
import { BrandLogo } from './BrandLogo';

interface ZagruskaOverlayProps {
  visible: boolean;
  message?: string;
  durationMs?: number;
}

const SPINNER_BARS = Array.from({ length: 12 }, (_, i) => i);

export const ZagruskaOverlay: React.FC<ZagruskaOverlayProps> = ({
  visible,
  message = 'Serverga ulanmoqda...',
  durationMs = 4500,
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!visible) {
      setProgress(0);
      return;
    }

    const start = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const pct = Math.min(100, Math.round((elapsed / Math.max(1, durationMs)) * 100));
      setProgress(pct);
      if (elapsed < durationMs) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [visible, durationMs]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-100/75 backdrop-blur-lg p-6"
      role="status"
      aria-live="polite"
    >
      {/* Floating spinner around clean graduation cap — no card box, no "Zagruska" title */}
      <div className="relative flex h-44 w-44 items-center justify-center">
        <div className="absolute inset-0 animate-spin-slow">
          {SPINNER_BARS.map((idx) => {
            const angle = idx * 30;
            const opacity = 0.16 + ((idx + 1) / 12) * 0.84;
            return (
              <span
                key={idx}
                className="absolute left-1/2 top-2 -ml-1.5 h-6 w-3 rounded-full bg-blue-600"
                style={{
                  transform: `rotate(${angle}deg)`,
                  transformOrigin: '6px 80px',
                  opacity,
                }}
              />
            );
          })}
        </div>

        <div className="relative z-10 flex items-center justify-center">
          <BrandLogo size={64} />
        </div>
      </div>

      {/* Subtle floating progress bar & quiet status line */}
      <div className="mt-6 w-48 space-y-2 text-center">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-300/70">
          <div
            className="h-full rounded-full bg-blue-600 transition-[width] duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm font-semibold text-slate-700">{message}</p>
      </div>
    </div>
  );
};
