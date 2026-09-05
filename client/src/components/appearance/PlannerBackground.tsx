import { useEffect, useState } from 'react';
import type { Appearance } from '../../lib/appearance';

export function PlannerBackground({ appearance }: { appearance: Appearance }) {
  const b = appearance.background;
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const photoKey = b.photos.join('|');
  useEffect(() => { setIndex(0); setFailed([]); }, [photoKey]);
  const photos = b.photos.filter(p => !failed.includes(p));
  const count = photos.length;
  useEffect(() => {
    if (b.kind !== 'slideshow' || count < 2) return;
    const timer = window.setInterval(() => setIndex(i => (i + 1) % count), b.interval * 1000);
    return () => window.clearInterval(timer);
  }, [b.kind, b.interval, count]);
  if (b.kind === 'none') return null;
  const photo = photos[index % Math.max(1, count)];
  const imageMode = b.kind === 'photo' || b.kind === 'slideshow';
  return (
    <div className="planner-background" aria-hidden="true">
      <div className="planner-background-art" style={{
        backgroundColor: imageMode && !photo ? 'rgb(var(--surface))' : b.color,
        backgroundImage: b.kind === 'gradient' ? `linear-gradient(${b.angle}deg, ${b.color}, ${b.colorEnd})` : undefined,
        filter: b.blur ? `blur(${b.blur}px)` : undefined,
      }}>
        {imageMode && photo && <img key={photo} src={photo} alt="" onError={() => setFailed(f => [...f, photo])}
          style={{ width: '100%', height: '100%', objectFit: b.fit, objectPosition: `${b.x}% ${b.y}%` }} />}
      </div>
      <div className="absolute inset-0" style={{ background: `rgb(var(--surface) / ${b.dim / 100})` }} />
    </div>
  );
}
