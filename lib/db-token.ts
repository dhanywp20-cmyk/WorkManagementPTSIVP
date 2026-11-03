import crypto from 'crypto';

const SECRET = process.env.SUPABASE_JWT_SECRET ?? '';

const TOKEN_HOURS = 6;

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export interface DbTokenUser {
  id: string;
  username: string;
  full_name?: string | null;
  role?: string | null;
  sales_division?: string | null;
  access_level?: string | null;
}

export function issueDbToken(user: DbTokenUser): string | null {
  if (!SECRET) return null;

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + TOKEN_HOURS * 3600;

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub:  user.id,
    role: 'anon',
    aud:  'authenticated',
    iat,
    exp,
    username:       user.username,
    user_role:      user.role ?? '',
    full_name:      user.full_name ?? '',
    sales_division: user.sales_division ?? '',
    access_level:   user.access_level ?? '',
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.createHmac('sha256', SECRET).update(signingInput).digest();

  return `${signingInput}.${base64url(signature)}`;
}
