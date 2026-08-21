import { createClient } from '@supabase/supabase-js';

/**
 * Token PostgREST milik user yang sedang login (lihat lib/db-token.ts).
 * Disimpan di module scope + sessionStorage, bukan React state, karena klien
 * Supabase di bawah adalah singleton yang diimpor ratusan berkas.
 */
const TOKEN_KEY = 'ivp_db_token';

let dbToken: string | null =
  typeof window !== 'undefined' ? window.sessionStorage.getItem(TOKEN_KEY) : null;

/**
 * Pasang / hapus token. Dipanggil saat login berhasil dan saat sesi dipulihkan
 * dari cookie (lihat lib/auth.ts). Nilainya dibaca ulang dari sessionStorage
 * saat modul dimuat supaya query paling awal setelah refresh halaman tetap
 * membawa identitas, bukan berangkat sebagai anonim.
 */
export function setDbToken(token: string | null): void {
  dbToken = token;
  pasangTokenRealtime(token);
  if (typeof window === 'undefined') return;
  if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
  else window.sessionStorage.removeItem(TOKEN_KEY);
}

/**
 * Realtime memakai WebSocket, BUKAN fetch - jadi override global.fetch di bawah
 * tidak menyentuhnya sama sekali. Tanpa baris ini soketnya berangkat hanya
 * membawa anon key, tanpa klaim identitas.
 *
 * Selama RLS mati itu tidak terasa: semua baris lolos, semua perubahan sampai.
 * Begitu RLS menyala di tickets & reminders (dua tabel yang ikut publication
 * `supabase_realtime`), Realtime ikut mengecek izin SELECT per baris - dan
 * soket tanpa klaim tidak berhak melihat apa pun, sehingga halaman berhenti
 * menyegarkan diri sendiri. Yang dikirim ke sini token yang sama dengan yang
 * dipakai PostgREST, sehingga penyaringannya juga sama persis.
 */
function pasangTokenRealtime(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    supabase.realtime.setAuth(token);
  } catch {
    /* soket belum siap - percobaan berikutnya (login/refresh token) memasangnya */
  }
}

/** Token yang sedang dipakai - dibaca pemantau sesi untuk tahu kapan harus diperbarui. */
export function getDbToken(): string | null {
  return dbToken;
}

/**
 * Kapan token kedaluwarsa (epoch ms), dibaca dari klaim `exp`. Yang dibaca di
 * sini SEMATA waktu kedaluwarsa untuk menjadwalkan pembaruan; keabsahan tanda
 * tangannya tetap diverifikasi PostgREST. Null bila token tidak ada atau
 * bentuknya tak terbaca.
 */
export function dbTokenExpiryMs(): number | null {
  if (!dbToken) return null;
  try {
    const payload = dbToken.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Perbarui token dari /api/auth/session, yang menerbitkan token baru selama
 * cookie sesi masih sah. Dipakai penjaga di fetchWithToken dan pemantau sesi
 * berkala di lib/auth.ts. Tinggal di berkas ini supaya fetchWithToken bisa
 * memakainya tanpa impor melingkar.
 */
let pembaruanBerjalan: Promise<void> | null = null;

export function refreshDbToken(): Promise<void> {
  // Satu pembaruan pada satu waktu: tanpa ini, sepuluh query yang berangkat
  // bersamaan akan memicu sepuluh panggilan /api/auth/session sekaligus.
  if (pembaruanBerjalan) return pembaruanBerjalan;
  pembaruanBerjalan = (async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      if (!res.ok) return;
      const { db_token } = await res.json();
      if (db_token) setDbToken(db_token);
    } catch {
      /* jaringan bermasalah — biarkan, percobaan berikutnya akan mencoba lagi */
    } finally {
      pembaruanBerjalan = null;
    }
  })();
  return pembaruanBerjalan;
}

/**
 * fetch yang menyelipkan Authorization pada tiap permintaan. Opsi global.fetch
 * adalah satu-satunya cara menyisipkan token yang BERUBAH-UBAH ke klien
 * singleton; global.headers hanya dibaca sekali saat klien dibuat.
 *
 * Token yang lewat batas waktu diperbarui dulu sebelum dikirim. Penjagaannya
 * ada di lapisan ini, bukan di tiap halaman, supaya semua modul terlindungi -
 * hanya sebagian halaman yang memasang pemantau sesi. Tanpa token, permintaan
 * berangkat memakai anon key.
 */
const fetchWithToken: typeof fetch = async (input, init) => {
  if (dbToken) {
    const exp = dbTokenExpiryMs();
    // Ambang 60 detik: menutup kemungkinan token kedaluwarsa persis saat
    // permintaan sedang di jalan.
    if (exp !== null && exp - Date.now() < 60_000) await refreshDbToken();
  }
  const headers = new Headers(init?.headers);
  if (dbToken) headers.set('Authorization', `Bearer ${dbToken}`);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { fetch: fetchWithToken } },
);

// Token yang dipulihkan dari sessionStorage di atas belum lewat setDbToken,
// jadi Realtime-nya dipasang di sini - sesudah klien ada. Tanpa ini, tab yang
// di-refresh berlangganan tanpa identitas sampai token diperbarui.
pasangTokenRealtime(dbToken);

/**
 * Basis data Services - TERPISAH dari basis data utama.
 *
 * Dipakai ticketing untuk alur lintas divisi/lintas kantor (Team Services
 * Servisindo). Sengaja tidak membawa token identitas: kredensialnya milik
 * organisasi lain, dan penyaringannya dikerjakan di sisi sana.
 */
export const supabaseServices = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_SERVICES_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY!
);

/**
 * Apakah konfigurasi dua basis data ini masuk akal. Yang paling berbahaya
 * adalah URL keduanya SAMA: setiap mirror ke Services DB menulis balik ke
 * basis data yang sama, sehingga alur lintas organisasi tampak berhasil
 * padahal tidak ada yang menyeberang. Wajar di lokal, fatal di produksi.
 */
export function periksaKonfigurasiServices(): {
  urlSama: boolean;
  servicesBelumDiset: boolean;
} {
  const utama = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const svc = process.env.NEXT_PUBLIC_SUPABASE_SERVICES_URL ?? '';
  return {
    urlSama: !!utama && !!svc && utama === svc,
    servicesBelumDiset: !svc || !process.env.NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY,
  };
}

if (process.env.NODE_ENV !== 'production') {
  const cek = periksaKonfigurasiServices();
  if (cek.servicesBelumDiset) {
    console.warn(
      '[supabase] NEXT_PUBLIC_SUPABASE_SERVICES_URL / ANON_KEY belum di-set — ' +
      'seluruh alur Team Services di Ticketing akan gagal.',
    );
  } else if (cek.urlSama) {
    console.warn(
      '[supabase] URL basis data utama dan Services SAMA. Di lokal ini normal, ' +
      'tapi artinya mirror ticket ke Services DB tidak benar-benar menyeberang. ' +
      'Pastikan di produksi keduanya berbeda.',
    );
  }
}
