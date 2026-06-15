import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter.' }, { status: 400 });
    }
    const hash = await bcrypt.hash(password, 10);
    return NextResponse.json({ hash });
  } catch {
    return NextResponse.json({ error: 'Gagal proses password.' }, { status: 500 });
  }
}
