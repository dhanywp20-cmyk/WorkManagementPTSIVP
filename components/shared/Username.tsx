
export function formatUsername(username: string | null | undefined): string {
  const u = (username ?? '').trim();
  if (!u) return '';
  return u.includes('@') ? u : '@' + u;
}

export function Username({ value }: { value: string | null | undefined }) {
  return <>{formatUsername(value)}</>;
}
