import { NextRequest, NextResponse } from 'next/server';

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

export async function POST(request: NextRequest) {
  try {
    if (!GEMINI_KEY) {
      return NextResponse.json({ error: 'AI service tidak tersedia.' }, { status: 503 });
    }
    const body = await request.json();
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Gagal menghubungi AI service.' }, { status: 500 });
  }
}
