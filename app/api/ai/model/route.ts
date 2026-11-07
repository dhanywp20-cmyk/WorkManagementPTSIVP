import { NextRequest, NextResponse } from 'next/server';
import { bacaRahasia } from '@/lib/auth/rahasia-server';
import { pastikanMasuk } from '@/lib/auth/penjaga-admin';

interface ModelGoogle {
  name?: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

export async function GET(request: NextRequest) {
  const jaga = await pastikanMasuk(request);
  if (!jaga.ok) return NextResponse.json({ error: { message: jaga.alasan } }, { status: jaga.status });
  try {
    const penilai = request.nextUrl.searchParams.get('profil') === 'penilai';

    const [khusus, umum] = await Promise.all([
      penilai ? bacaRahasia('ai.gemini_token_koreksi') : Promise.resolve(null),
      bacaRahasia('ai.gemini_token'),
    ]);
    const token = khusus || umum;
    if (!token) {
      return NextResponse.json(
        { error: { message: 'Token AI belum diisi di Admin Panel → Integrations.' } },
        { status: 503 },
      );
    }

    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
      headers: { 'x-goog-api-key': token },
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    if (!res.ok) {
      const pesan = (Array.isArray(data) ? data[0] : data)?.error?.message
        ?? `Gagal membaca daftar model (HTTP ${res.status}).`;
      return NextResponse.json({ error: { message: pesan } }, { status: res.status });
    }

    const model = ((data?.models ?? []) as ModelGoogle[])
      .filter(m => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map(m => ({
        id: (m.name ?? '').replace(/^models\//, ''),
        nama: m.displayName || (m.name ?? '').replace(/^models\//, ''),
      }))
      .filter(m => m.id)
      .sort((a, b) => a.id.localeCompare(b.id));

    return NextResponse.json({ model });
  } catch (e) {
    console.error('[api/ai/model]', e);
    return NextResponse.json(
      { error: { message: 'Gagal menghubungi Google: ' + (e instanceof Error ? e.message : String(e)) } },
      { status: 500 },
    );
  }
}
