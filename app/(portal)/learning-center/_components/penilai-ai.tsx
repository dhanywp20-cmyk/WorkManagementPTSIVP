'use client';

import { GEMINI_URL, MAX_PDF_BYTES } from './shared';

export async function fileToBase64(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => res((e.target?.result as string).split(',')[1]);
    reader.onerror = () => rej(new Error('Read failed'));
    reader.readAsDataURL(f);
  });
}

export async function generateWithGemini(
  prompt: string, pdfFile?: File | null,
  profil?: 'penilai',
  model?: string,
): Promise<string> {
  if (pdfFile && pdfFile.size > MAX_PDF_BYTES) {
    throw new Error(
      `PDF terlalu besar (${(pdfFile.size / 1_000_000).toFixed(1)} MB, maks ${(MAX_PDF_BYTES / 1_000_000).toFixed(1)} MB). Coba PDF yang lebih kecil atau kompres dulu.`
    );
  }
  const parts: any[] = [];
  if (pdfFile) {
    const base64 = await fileToBase64(pdfFile);
    parts.push({ inline_data: { mime_type: pdfFile.type || 'application/pdf', data: base64 } });
  }
  parts.push({ text: prompt });
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { maxOutputTokens: 8192 },
      ...(profil ? { profil } : {}),
      ...(model ? { model } : {}),
    }),
  });

  const raw = await res.text();
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      res.ok
        ? 'Respons server tidak valid (bukan JSON). Coba ulangi, atau pakai PDF yang lebih kecil.'
        : `Server menolak request (HTTP ${res.status}), kemungkinan karena file terlalu besar. Coba PDF yang lebih kecil.`
    );
  }
  if (!res.ok) {
    throw new Error(data?.error?.message ?? 'Gemini API error');
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export interface ModelAI { id: string; nama: string }

export async function ambilDaftarModel(profil?: 'penilai'): Promise<ModelAI[]> {
  const res = await fetch(`/api/ai/model${profil ? `?profil=${profil}` : ''}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? 'Gagal membaca daftar model.');
  return (data?.model ?? []) as ModelAI[];
}

export interface SoalDinilai {
  id: string;
  question: string;
  modelAnswer?: string | null;
  studentAnswer: string;
}

export async function gradeEssaysBatchWithAI(
  daftar: SoalDinilai[],
): Promise<Record<string, { score: number; feedback: string }>> {
  if (daftar.length === 0) return {};

  const blok = daftar.map((d, i) => `--- SOAL ${i + 1} ---
ID: ${d.id}
PERTANYAAN: ${d.question}
${d.modelAnswer ? `KUNCI REFERENSI: ${d.modelAnswer}` : '(Tidak ada kunci referensi - nilai berdasar kelayakan & kelengkapan secara umum.)'}
JAWABAN PESERTA: ${d.studentAnswer || '(kosong / tidak dijawab)'}`).join('\n\n');

  const prompt = `Kamu adalah asisten penilai kuis internal perusahaan. Nilai SETIAP jawaban essay berikut secara OBJEKTIF terhadap kunci referensinya masing-masing.\
 Nilai kesesuaian ISI, bukan kemiripan kata demi kata - peserta yang memahami konsep yang sama dengan kalimatnya sendiri tetap dinilai benar.

${blok}

Balas HANYA dengan JSON array valid, tanpa markdown, tanpa teks lain. Satu entri untuk SETIAP id di atas, dengan urutan yang sama:
[{"id":"<id soal persis seperti di atas>","score":<angka 0-100>,"feedback":"<1-2 kalimat alasan singkat dalam Bahasa Indonesia>"}]`;

  const raw = await generateWithGemini(prompt, null, 'penilai');
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Keluaran AI tidak berupa JSON yang valid.');
  }
  if (!Array.isArray(parsed)) throw new Error('Keluaran AI bukan daftar penilaian.');

  const sah = new Set(daftar.map(d => d.id));
  const hasil: Record<string, { score: number; feedback: string }> = {};
  for (const baris of parsed as { id?: unknown; score?: unknown; feedback?: unknown }[]) {
    const id = typeof baris?.id === 'string' ? baris.id : '';
    if (!sah.has(id)) continue;
    const skor = Number(baris.score);
    if (!Number.isFinite(skor)) continue;
    hasil[id] = {
      score: Math.max(0, Math.min(100, Math.round(skor))),
      feedback: typeof baris.feedback === 'string' ? baris.feedback : '',
    };
  }
  return hasil;
}

export async function gradeEssayWithAI(
  question: string, modelAnswer: string | null | undefined, studentAnswer: string,
): Promise<{ score: number; feedback: string }> {
  const prompt = `Kamu adalah asisten penilai kuis internal perusahaan. Nilai jawaban essay peserta berikut secara OBJEKTIF, dengan mempertimbangkan kesesuaian isi terhadap kunci referensi (bukan sekadar kemiripan kata demi kata — paham konsep yang sama tetap dinilai benar).

SOAL:
${question}

${modelAnswer ? `KUNCI REFERENSI (acuan admin, bukan satu-satunya jawaban benar):\n${modelAnswer}\n` : '(Tidak ada kunci referensi — nilai berdasar kelayakan & kelengkapan jawaban secara umum.)\n'}
JAWABAN PESERTA:
${studentAnswer || '(kosong / tidak dijawab)'}

Balas HANYA dengan JSON valid persis format ini, tanpa markdown, tanpa teks lain:
{"score": <angka 0-100>, "feedback": "<1-2 kalimat alasan singkat dalam Bahasa Indonesia>"}`;

  const raw = await generateWithGemini(prompt, null, 'penilai');
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  let parsed: { score?: unknown; feedback?: unknown };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Keluaran AI tidak berupa JSON yang valid.');
  }
  const score = Number(parsed.score);
  if (!Number.isFinite(score)) throw new Error('AI tidak mengembalikan skor yang valid.');
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    feedback: typeof parsed.feedback === 'string' ? parsed.feedback : '',
  };
}
