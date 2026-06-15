import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi.' }, { status: 400 });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password, full_name, role, team_type, sales_division, jabatan, phone_number, allowed_menus, kpi_enabled')
      .eq('username', username)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Username atau password salah!' }, { status: 401 });
    }

    const stored: string = user.password ?? '';
    const isHashed = stored.startsWith('$2b$') || stored.startsWith('$2a$');
    let valid = false;

    if (isHashed) {
      valid = await bcrypt.compare(password, stored);
    } else {
      valid = stored === password;
      if (valid) {
        const hash = await bcrypt.hash(password, 10);
        await supabase.from('users').update({ password: hash }).eq('id', user.id);
      }
    }

    if (!valid) {
      return NextResponse.json({ error: 'Username atau password salah!' }, { status: 401 });
    }

    const { password: _pwd, ...safeUser } = user;
    return NextResponse.json({ user: safeUser });
  } catch {
    return NextResponse.json({ error: 'Login gagal. Coba lagi.' }, { status: 500 });
  }
}
