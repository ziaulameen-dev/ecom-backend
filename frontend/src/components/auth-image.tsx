'use client';

import { useEffect, useState } from 'react';
import { fetchImageUrl } from '@/lib/api';

/**
 * Renders a protected image by fetching it with the bearer token and turning the
 * response into an object URL (a plain <img src> can't send an auth header).
 */
export function AuthImage({ path, alt, className }: { path: string; alt?: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    fetchImageUrl(path)
      .then((u) => { url = u; if (alive) setSrc(u); })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  if (failed) return <div className={`bg-muted grid place-items-center text-xs text-muted-foreground ${className}`}>×</div>;
  if (!src) return <div className={`bg-muted animate-pulse ${className}`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt ?? ''} className={className} />;
}
