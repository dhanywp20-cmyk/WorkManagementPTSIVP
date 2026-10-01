'use client';
import { useEffect, useRef, useState } from 'react';
import { Ikon } from '@/components/shared/Ikon';
import { ambilRilisTerbaru, formatTanggal, formatUkuran, URL_UNDUH_APK, type RilisAndroid } from '@/lib/rilis-android';

/**
 * Admin Panel -> Aplikasi Android. Admin mengunggah APK hasil build di laptop;
 * berkasnya masuk bucket privat Supabase dan langsung muncul di Profil semua
 * pengguna (hanya versi terbaru). Alur unggah:
 *   1. /api/android {aksi:'siapkan'}  -> signed upload URL (cek admin + kode naik)
 *   2. PUT berkas langsung ke Supabase Storage (tidak lewat Vercel)
 *   3. /api/android {aksi:'terbitkan'} -> rilis tercatat & berkas lama dibuang
 */
const MIME_APK = 'application/vnd.android.package-archive';

type Pesan = { tipe: 'ok' | 'gagal'; teks: string } | null;

async function panggil(body: Record<string, unknown>) {
  const r = await fetch('/api/android', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.alasan ?? `Gagal (${r.status})`);
  return j;
}

function unggahBerkas(path: string, token: string, berkas: File, onProgres: (p: number) => void) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/upload/sign/aplikasi-android/${path}?token=${encodeURIComponent(token)}`;
  return new Promise<void>((ok, gagal) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url);
    x.setRequestHeader('Content-Type', MIME_APK);
    x.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '');
    x.setRequestHeader('x-upsert', 'false');
    x.upload.onprogress = e => { if (e.lengthComputable) onProgres(e.loaded / e.total); };
    x.onload = () => (x.status < 300 ? ok() : gagal(new Error(`Unggah gagal (${x.status}): ${x.responseText.slice(0, 160)}`)));
    x.onerror = () => gagal(new Error('Koneksi terputus saat mengunggah.'));
    x.send(berkas);
  });
}

function Kartu({ judul, children, aksi }: { judul: string; children: React.ReactNode; aksi?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <header className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-bold tracking-widest uppercase text-slate-500">{judul}</h3>
        {aksi}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

const Baris = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0 text-sm">
    <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500">{label}</span>
    <span className="font-semibold text-slate-800 text-right min-w-0 truncate">{children}</span>
  </div>
);

export function AplikasiAndroidInline() {
  const [riwayat, setRiwayat] = useState<RilisAndroid[] | null>(null);
  const [berkas, setBerkas] = useState<File | null>(null);
  const [versi, setVersi] = useState('');
  const [kode, setKode] = useState('');
  const [catatan, setCatatan] = useState('');
  const [wajib, setWajib] = useState(false);
  const [progres, setProgres] = useState<number | null>(null);
  const [pesan, setPesan] = useState<Pesan>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const muat = async () => {
    try {
      const r = await fetch('/api/android?riwayat=1', { credentials: 'include' });
      const j = await r.json();
      if (!j.ok) throw new Error(j.alasan);
      const daftar = (j.riwayat ?? []) as RilisAndroid[];
      setRiwayat(daftar);
      setKode(String((daftar[0]?.kode_versi ?? 0) + 1));
    } catch (e) {
      setRiwayat([]);
      setPesan({ tipe: 'gagal', teks: (e as Error).message || 'Gagal memuat rilis.' });
    }
  };
  useEffect(() => { void muat(); }, []);

  const terbaru = riwayat?.find(r => r.tersedia) ?? null;
  const kodeTerakhir = riwayat?.[0]?.kode_versi ?? 0;
  const sibuk = progres !== null;

  const pilihBerkas = (f: File | null) => {
    setPesan(null);
    if (f && !/\.apk$/i.test(f.name)) { setPesan({ tipe: 'gagal', teks: 'Pilih berkas .apk.' }); return; }
    setBerkas(f);
    // app-release-1.0.3.apk -> isi otomatis versinya bila masih kosong.
    const m = f?.name.match(/(\d+\.\d+(?:\.\d+)?)/);
    if (m && !versi) setVersi(m[1]);
  };

  const terbitkan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!berkas) { setPesan({ tipe: 'gagal', teks: 'Pilih berkas APK dulu.' }); return; }
    const kodeN = Number(kode);
    setPesan(null);
    setProgres(0);
    try {
      const siap = await panggil({ aksi: 'siapkan', versi, kode_versi: kodeN, ukuran: berkas.size });
      await unggahBerkas(siap.path, siap.token, berkas, setProgres);
      await panggil({ aksi: 'terbitkan', path: siap.path, versi, kode_versi: kodeN, catatan, wajib });
      setPesan({ tipe: 'ok', teks: `v${versi.replace(/^v/i, '')} terbit - langsung tampil di Profil semua pengguna.` });
      setBerkas(null); setVersi(''); setCatatan(''); setWajib(false);
      if (inputRef.current) inputRef.current.value = '';
      await ambilRilisTerbaru(true);
      await muat();
    } catch (err) {
      setPesan({ tipe: 'gagal', teks: (err as Error).message });
    } finally {
      setProgres(null);
    }
  };

  const kelasInput = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 disabled:bg-slate-50';

  return (
    <div className="p-4 sm:p-6 grid gap-4 lg:grid-cols-2 items-start">
      <div className="space-y-4 min-w-0">
        <Kartu judul="Rilis saat ini" aksi={terbaru && (
          <a href={URL_UNDUH_APK} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700">
            <Ikon nama="⬇" ukuran={14} /> Unduh APK
          </a>
        )}>
          {riwayat === null ? (
            <p className="text-sm text-slate-500">Memuat...</p>
          ) : !terbaru ? (
            <p className="text-sm text-slate-500">Belum ada APK yang diunggah. Unggah versi pertama di bawah.</p>
          ) : (
            <div>
              <Baris label="Versi">v{terbaru.versi}</Baris>
              <Baris label="Kode versi">{terbaru.kode_versi}</Baris>
              <Baris label="Ukuran">{formatUkuran(terbaru.ukuran)}</Baris>
              <Baris label="Diunggah">{formatTanggal(terbaru.diunggah_pada)}</Baris>
              <Baris label="Update wajib">
                {terbaru.wajib
                  ? <span className="text-rose-600">Ya - aplikasi lama diminta update</span>
                  : <span className="text-slate-500">Tidak</span>}
              </Baris>
              {terbaru.catatan && (
                <p className="mt-3 text-xs text-slate-600 whitespace-pre-line leading-relaxed rounded-lg bg-slate-50 p-3">{terbaru.catatan}</p>
              )}
            </div>
          )}
        </Kartu>

        <Kartu judul="Unggah versi baru">
          <form onSubmit={terbitkan} className="space-y-3">
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1">Berkas APK</span>
              <input ref={inputRef} type="file" accept=".apk,application/vnd.android.package-archive" disabled={sibuk}
                onChange={e => pilihBerkas(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200" />
              {berkas && <span className="block mt-1 text-[11px] text-slate-500 truncate">{berkas.name} · {formatUkuran(berkas.size)}</span>}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-semibold text-slate-600 mb-1">Versi</span>
                <input value={versi} onChange={e => setVersi(e.target.value)} placeholder="1.0.1" required disabled={sibuk}
                  pattern="v?[0-9A-Za-z.\-]{1,32}" className={kelasInput} />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-600 mb-1">Kode versi</span>
                <input value={kode} onChange={e => setKode(e.target.value.replace(/\D/g, ''))} inputMode="numeric" required disabled={sibuk}
                  className={kelasInput} />
              </label>
            </div>
            <p className="text-[11px] text-slate-500 -mt-1">
              Kode versi = <code>versionCode</code> di <code>android/version.properties</code>; harus lebih dari {kodeTerakhir}.
            </p>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1">Yang berubah</span>
              <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={3} maxLength={2000} disabled={sibuk}
                placeholder="Mis. notifikasi berbunyi walau aplikasi ditutup" className={kelasInput} />
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={wajib} onChange={e => setWajib(e.target.checked)} disabled={sibuk}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500" />
              <span><strong>Wajib</strong> <span className="text-slate-500">- pengguna aplikasi versi lama tidak bisa lanjut sebelum update</span></span>
            </label>

            {progres !== null && (
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={Math.round(progres * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${Math.max(3, progres * 100)}%` }} />
              </div>
            )}
            {pesan && (
              <p role="status" className={`text-xs font-semibold rounded-lg px-3 py-2 ${pesan.tipe === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {pesan.teks}
              </p>
            )}
            <button type="submit" disabled={sibuk || !berkas}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <Ikon nama="⬆" ukuran={16} />
              {sibuk ? `Mengunggah ${Math.round((progres ?? 0) * 100)}%...` : 'Unggah & terbitkan'}
            </button>
          </form>
        </Kartu>
      </div>

      <div className="space-y-4 min-w-0">
        <Kartu judul="Langkah merilis">
          <ol className="space-y-3 text-sm text-slate-600 list-decimal pl-5 leading-relaxed">
            <li>Naikkan <code>versionCode</code> & <code>versionName</code> di <code>android/version.properties</code>, lalu merge ke <code>main</code>.</li>
            <li><strong>Otomatis:</strong> GitHub Actions membangun APK rilis dan langsung menerbitkannya di sini - tidak perlu Android Studio maupun laptop.</li>
            <li><strong>Manual</strong> (bila perlu): unduh artefak <em>apk</em> dari GitHub Actions, atau build di laptop dengan <code className="break-all">cd android &amp;&amp; ./gradlew assembleRelease</code>, lalu unggah lewat formulir di samping.</li>
            <li>Tombol unduh di Profil semua pengguna langsung berganti ke versi ini. Aplikasi versi lama menampilkan ajakan update (paksa bila <strong>Wajib</strong>).</li>
          </ol>
          <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
            Perubahan tampilan/fitur web tidak butuh APK baru - aplikasi memuat web terbaru dari server. APK baru hanya untuk perubahan di folder <code>android/</code>.
            Hanya 2 berkas APK terakhir yang disimpan agar kuota Storage tetap hemat.
          </p>
        </Kartu>

        {riwayat && riwayat.length > 1 && (
          <Kartu judul="Riwayat rilis">
            <ul className="divide-y divide-slate-100">
              {riwayat.map(r => (
                <li key={r.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-semibold text-slate-800">v{r.versi}</span>
                    <span className="text-slate-500"> · kode {r.kode_versi}{r.wajib ? ' · wajib' : ''}</span>
                    <span className="block text-[11px] text-slate-500">{formatTanggal(r.diunggah_pada)} · {formatUkuran(r.ukuran)}</span>
                  </span>
                  {r.tersedia
                    ? <a href={`${URL_UNDUH_APK}?kode=${r.kode_versi}`} className="text-xs font-bold text-emerald-700 hover:underline flex-shrink-0">Unduh</a>
                    : <span className="text-[11px] text-slate-500 flex-shrink-0">berkas dihapus</span>}
                </li>
              ))}
            </ul>
          </Kartu>
        )}
      </div>
    </div>
  );
}
