const DOMAIN_CADANGAN = 'https://work-management-ptsivp.vercel.app';

export function adalahPreviewVercel(host: string): boolean {
  if (!/\.vercel\.app$/i.test(host)) return false;
  return /-git-/i.test(host) || /-[a-z0-9]{9}-[a-z0-9-]+\.vercel\.app$/i.test(host);
}

export function appBaseUrl(): string {
  const env = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    if (adalahPreviewVercel(window.location.hostname)) return env || DOMAIN_CADANGAN;
    return window.location.origin;
  }
  return env || DOMAIN_CADANGAN;
}

export function appLink(path: string = '/dashboard'): string {
  return `${appBaseUrl()}${path}`;
}
