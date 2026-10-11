/**
 * lib/perbandingan-prompt.ts - Prompt Product Comparison: dipakai server (Gemini, mode otomatis) DAN disalin
 * pengguna ke AI chat lain (Claude.ai, ChatGPT, Gemini app) - aturannya satu sumber. Isi brosur dikirim
 * sebagai teks hasil ekstraksi di peramban, bertanda halaman, supaya kutipan bisa diverifikasi
 * (lib/perbandingan.ts kutipanAda).
 */
import { type Bahasa, LABEL, MAKS_KARAKTER_PRODUK, MAKS_KARAKTER_TOTAL, MAKS_PRODUK, MIN_KARAKTER_TEKS, MIN_PRODUK } from './perbandingan';

export interface SumberProduk { nama: string; berkas: string; halaman: string[] }

/** Teks brosur bertanda halaman, dipangkas ke batas per produk. */
export function teksBertanda(s: SumberProduk): { teks: string; terpangkas: boolean } {
  let out = '', terpangkas = false;
  for (let i = 0; i < s.halaman.length; i++) {
    const bagian = `\n[Page ${i + 1}]\n${s.halaman[i]}`;
    if (out.length + bagian.length > MAKS_KARAKTER_PRODUK) { out += bagian.slice(0, Math.max(0, MAKS_KARAKTER_PRODUK - out.length)); terpangkas = true; break; }
    out += bagian;
  }
  return { teks: out.trim(), terpangkas };
}

export function promptSistem(bahasa: Bahasa): string {
  const L = LABEL[bahasa];
  const bhs = bahasa === 'id' ? 'Bahasa Indonesia' : 'English';
  return `You are a pre-sales engineer at PT Indovisual Group (Indonesia) writing a product comparison battle card for the sales team.
Write every text field in ${bhs}. Output ONLY one JSON object (no markdown fences, no commentary).

STRICT DATA RULES
- Use ONLY facts found in the brochure texts provided. Never use outside knowledge, never guess, never "typically".
- Every value with status "ada" MUST include bukti.kutipan: a SHORT verbatim excerpt (3-120 chars) copied exactly from that product's brochure text, plus bukti.halaman (the [Page N] number).
- If a brochure does not mention a spec: status "tidak-disebut", teks "" (it is printed as "${L.tidakDisebut}").
- If a brochure explicitly states the feature is absent: status "tidak-tersedia" with its own wording + kutipan.
- If a brochure contradicts itself or the value is ambiguous: status "cek" + alasanCek.
- Keep original units and technical context. Do not convert units unless the conversion is exact and you state both. Do not treat similarly named features as identical when their definitions differ.
- "unggul": true only on a value of the RECOMMENDED product (column 0) when it is objectively documented and the advantage is clear for buyers (e.g. a published spec vs an unpublished one, or a longer warranty). A higher number is not automatically better - judge by the spec's meaning. Never mark unggul on unverifiable claims.

STRUCTURE (match the company's fixed template)
- kategori: uppercase eyebrow, e.g. "PRODUCT COMPARISON — COMPACT DISPLAY 22\\"".
- judul: "<Product A> vs <Product B> [vs ...]".
- pengantar: 2-4 sentences: what is compared, the source (official datasheets/brochures), the sections covered, purpose for PT Indovisual Group.
- produk: one entry per product IN THE GIVEN ORDER (index 0 = recommended): merek (brand line, uppercase, e.g. "LG INFORMATION DISPLAY"), nama (model name), judulKartu ("<model> — <type/size>"), deskripsi (1-2 factual sentences).
- bagian: 3-6 numbered sections grouping related specs (e.g. Panel & Display; Operating System, CMS & Content Management; Connectivity, Physical Build & Installation; Certification, Warranty & Support - adapt to the product category). Each row: spesifikasi (short label) and nilai with exactly one entry per product in the same order.
- ringkasan: one paragraph; wrap product model names in **double asterisks**.
- sorotan: exactly 3 items {judul, teks} - the recommended product's key strengths, each grounded in the brochure facts.
- rekomendasi: one paragraph (without the "${L.rekomendasi}" prefix); wrap the recommended model in **double asterisks**.
- catatan: one sentence on data sources; say that values marked "${L.tidakDisebut}" must be confirmed with the principal before quoting.

JSON SHAPE
{"kategori":"","judul":"","pengantar":"","produk":[{"merek":"","nama":"","judulKartu":"","deskripsi":""}],
 "bagian":[{"judul":"","baris":[{"spesifikasi":"","nilai":[{"teks":"","status":"ada|tidak-disebut|tidak-tersedia|cek","unggul":false,"bukti":{"halaman":1,"kutipan":""},"alasanCek":""}]}]}],
 "ringkasan":"","sorotan":[{"judul":"","teks":""}],"rekomendasi":"","catatan":""}`;
}

export function promptPengguna(produk: SumberProduk[]): { teks: string; terpangkas: string[] } {
  const terpangkas: string[] = [];
  const isi = produk.map((p, i) => {
    const t = teksBertanda(p);
    if (t.terpangkas) terpangkas.push(p.nama || p.berkas);
    return `=== PRODUCT ${i + 1}${i === 0 ? ' (RECOMMENDED)' : ''}: ${p.nama || '(name not given - read it from the brochure)'} — file "${p.berkas}" ===\n${t.teks}`;
  }).join('\n\n');
  return { teks: `Compare these ${produk.length} products. Column order = product order below.\n\n${isi}`, terpangkas };
}

/** Prompt lengkap untuk disalin ke AI chat lain (sistem + data dalam satu pesan). */
export const promptSalin = (bahasa: Bahasa, produk: SumberProduk[]) => `${promptSistem(bahasa)}\n\n${promptPengguna(produk).teks}`;

/** Ambil objek JSON dari jawaban AI (boleh terbungkus ```json ... ``` atau berteks pengantar). */
export function ambilJson(jawaban: string): unknown {
  const t = jawaban.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch { /* cari objek terluar */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

/** Bentuk permintaan dari peramban - semua batas diperiksa ulang di sini. */
export function periksaKiriman(x: unknown): { ok: true; bahasa: Bahasa; produk: SumberProduk[] } | { ok: false; alasan: string } {
  const b = x as Record<string, unknown>;
  if (!b || typeof b !== 'object' || !Array.isArray(b.produk)) return { ok: false, alasan: 'Format permintaan tidak sah.' };
  if (b.produk.length < MIN_PRODUK) return { ok: false, alasan: `Minimal ${MIN_PRODUK} produk.` };
  if (b.produk.length > MAKS_PRODUK) return { ok: false, alasan: `Maksimal ${MAKS_PRODUK} produk.` };
  const produk: SumberProduk[] = [];
  let total = 0;
  for (const p0 of b.produk) {
    const p = (p0 ?? {}) as Record<string, unknown>;
    const halaman = Array.isArray(p.halaman) ? p.halaman.filter((h): h is string => typeof h === 'string').slice(0, 200) : [];
    const berkas = typeof p.berkas === 'string' ? p.berkas.replace(/[^\w.\- ()]/g, '').slice(0, 120) : 'brosur.pdf';
    const nama = typeof p.nama === 'string' ? p.nama.trim().slice(0, 80) : '';
    const isi = halaman.join('');
    if (isi.replace(/\s/g, '').length < MIN_KARAKTER_TEKS) {
      return { ok: false, alasan: `${berkas}: tidak ada teks yang bisa dibaca (kemungkinan PDF hasil scan / gambar).` };
    }
    total += Math.min(isi.length, 60_000);
    produk.push({ nama, berkas, halaman });
  }
  if (total > MAKS_KARAKTER_TOTAL + 40_000) return { ok: false, alasan: 'Teks brosur terlalu panjang.' };
  return { ok: true, bahasa: b.bahasa === 'id' ? 'id' : 'en', produk };
}

/** responseSchema Gemini (subset OpenAPI): keluaran dijamin JSON sah berbentuk kartu template. */
const S = (type: string, extra: Record<string, unknown> = {}) => ({ type, ...extra });
export const SKEMA_GEMINI: Record<string, unknown> = S('OBJECT', {
  properties: {
    kategori: S('STRING'), judul: S('STRING'), pengantar: S('STRING'),
    produk: S('ARRAY', { items: S('OBJECT', { properties: { merek: S('STRING'), nama: S('STRING'), judulKartu: S('STRING'), deskripsi: S('STRING') }, required: ['merek', 'nama', 'judulKartu', 'deskripsi'] }) }),
    bagian: S('ARRAY', { items: S('OBJECT', { properties: {
      judul: S('STRING'),
      baris: S('ARRAY', { items: S('OBJECT', { properties: {
        spesifikasi: S('STRING'),
        nilai: S('ARRAY', { items: S('OBJECT', { properties: {
          teks: S('STRING'), status: S('STRING', { enum: ['ada', 'tidak-disebut', 'tidak-tersedia', 'cek'] }), unggul: S('BOOLEAN'),
          bukti: S('OBJECT', { properties: { halaman: S('INTEGER'), kutipan: S('STRING') } }), alasanCek: S('STRING'),
        }, required: ['teks', 'status'] }) }),
      }, required: ['spesifikasi', 'nilai'] }) }),
    }, required: ['judul', 'baris'] }) }),
    ringkasan: S('STRING'),
    sorotan: S('ARRAY', { items: S('OBJECT', { properties: { judul: S('STRING'), teks: S('STRING') }, required: ['judul', 'teks'] }) }),
    rekomendasi: S('STRING'), catatan: S('STRING'),
  },
  required: ['kategori', 'judul', 'pengantar', 'produk', 'bagian', 'ringkasan', 'sorotan', 'rekomendasi', 'catatan'],
  propertyOrdering: ['kategori', 'judul', 'pengantar', 'produk', 'bagian', 'ringkasan', 'sorotan', 'rekomendasi', 'catatan'],
});
