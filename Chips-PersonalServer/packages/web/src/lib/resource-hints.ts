const DEFAULT_RESOURCE_ORIGIN = 'https://file.chipscard.space';

function appendResourceHint(rel: 'preconnect' | 'dns-prefetch', href: string): void {
  if (document.head.querySelector(`link[rel="${rel}"][href="${href}"]`)) {
    return;
  }

  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  if (rel === 'preconnect') {
    link.crossOrigin = 'anonymous';
  }
  document.head.appendChild(link);
}

export function installResourceHints(): void {
  const rawOrigin = import.meta.env.VITE_CCPS_RESOURCE_ORIGIN || DEFAULT_RESOURCE_ORIGIN;

  try {
    const origin = new URL(rawOrigin, window.location.origin).origin;
    if (origin === window.location.origin) {
      return;
    }

    appendResourceHint('dns-prefetch', origin);
    appendResourceHint('preconnect', origin);
  } catch {
    // Resource hints are opportunistic; invalid deployment config should not block rendering.
  }
}
