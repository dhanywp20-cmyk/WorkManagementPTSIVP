/**
 * lib/learning-rank.ts - peringkat quiz seseorang, DAN klien tipis untuk
 * memanggilnya lewat /api/learning-center/rank.
 *
 * `hitungPeringkat` murni (tanpa Supabase/React) supaya bisa diuji langsung
 * dengan data tiruan - lihat uji/peringkat-quiz.ts. Route handler-nya sendiri
 * (app/api/learning-center/rank/route.ts) hanya menarik baris dari DB lalu
 * memanggil fungsi ini; `ambilPeringkatSaya` dipakai kartu dashboard dan
 * ScorePage.tsx supaya bentuk datanya - dan cara gagalnya - sama persis di
 * keduanya.
 */

export interface BarisAttempt {
  user_id: string;
  score: number | null;
  grading_status: string | null;
  role: string | null;
  sales_division: string | null;
  /** Nama asli - HANYA dipakai server; yang bukan milik pemanggil disamarkan sebelum dikirim. */
  full_name?: string | null;
  passed?: boolean | null;
  tab_switches?: number | null;
  time_taken_sec?: number | null;
}

/**
 * Satu baris papan peringkat SESUDAH disamarkan.
 *
 * `nama` untuk peserta lain sudah diganti di SERVER jadi "Peserta #N" - bukan
 * dikirim utuh lalu ditutup blur() di CSS. Bedanya bukan kosmetik: yang kedua
 * tetap terbaca lengkap di DevTools/Network, jadi ia bukan proteksi sama
 * sekali. Angkanya (skor, jumlah quiz, lulus) sengaja tetap dikirim - itulah
 * yang membuat papan ini ada gunanya, dan tanpa nama ia tidak menunjuk siapa
 * pun.
 */
export interface BarisPapan {
  /** Peringkat sebenarnya di dalam kelompok. 0 = belum punya nilai terhitung. */
  rank: number;
  nama: string;
  quiz: number;
  avg: number;
  lulus: number;
  flags: number;
  /** true = baris milik pemanggil sendiri; hanya baris ini yang bernama asli. */
  aku: boolean;
  /**
   * Baris pemanggil yang DISISIPKAN karena peringkatnya di luar papan teratas.
   * Dipakai tampilan untuk memberi pemisah, supaya "#47" tidak terbaca seolah
   * menempel persis di bawah "#10".
   */
  disisipkan?: boolean;
  /**
   * Pemanggil belum punya nilai yang bisa diperingkat - belum pernah submit,
   * atau semua jawabannya masih menunggu penilaian essay.
   */
  belumDinilai?: boolean;
}

export interface HasilPeringkat {
  role: string;
  globalRank: number | null;
  globalTotal: number;
  divisi: string | null;
  divisiRank: number | null;
  divisiTotal: number;
  /** Papan peringkat sekelompok (role yang sama), nama peserta lain sudah disamarkan. */
  papan: BarisPapan[];
}

/** Berapa baris teratas yang dikirim ke papan. Baris pemanggil selalu ikut di luar ini. */
export const PAPAN_TERATAS = 20;

/**
 * Hitung peringkat SATU pemanggil dari seluruh baris attempt yang sudah
 * submit. Peer group = role yang SAMA PERSIS ('guest' tidak digabung dengan
 * 'sales') - menyamai konvensi lama ScorePage ("Top Performers — Guest").
 */
export function hitungPeringkat(
  rows: BarisAttempt[],
  caller: { id: string; role: string | null; sales_division: string | null },
): HasilPeringkat {
  const myRole = (caller.role ?? '').toLowerCase();

  const perOrang = new Map<string, {
    role: string; divisi: string | null; nama: string;
    total: number; jumlah: number; lulus: number; flags: number; waktu: number;
  }>();
  for (const a of rows) {
    if (a.grading_status === 'pending_review') continue;   // belum dinilai final
    if (!a.role) continue;                                  // baris yatim - user tidak ditemukan
    const rec = perOrang.get(a.user_id)
      ?? {
        role: a.role.toLowerCase(), divisi: a.sales_division, nama: a.full_name ?? '-',
        total: 0, jumlah: 0, lulus: 0, flags: 0, waktu: 0,
      };
    rec.total += a.score ?? 0;
    rec.jumlah += 1;
    if (a.passed) rec.lulus += 1;
    rec.flags += a.tab_switches ?? 0;
    rec.waktu += a.time_taken_sec ?? 0;
    perOrang.set(a.user_id, rec);
  }

  //  Skor rata-rata sama TIDAK berarti peringkatnya bebas - tanpa tie-break
  //  kedua, dua peserta yang seri (mis. sama-sama 100) terurut menurut
  //  urutan baris apa adanya dari database, bukan berdasar siapa yang lebih
  //  cepat. Ini papan yang dilihat peserta SENDIRI soal peringkat mereka,
  //  jadi urutan yang terlihat acak persis di sinilah yang paling sering
  //  memicu komplain "nilai saya sama tapi peringkat saya kalah". Waktu
  //  rata-rata lebih singkat menang saat skor seri - sama seperti perbaikan
  //  di ReportPage.tsx dan AdminDashboard.tsx.
  const sekelompok = [...perOrang.entries()]
    .filter(([, r]) => r.role === myRole)
    .map(([userId, r]) => ({
      userId, avg: r.total / r.jumlah, avgWaktu: r.waktu / r.jumlah, divisi: r.divisi,
      nama: r.nama, quiz: r.jumlah, lulus: r.lulus, flags: r.flags,
    }))
    .sort((a, b) => b.avg - a.avg || a.avgWaktu - b.avgWaktu);

  const globalIdx = sekelompok.findIndex(p => p.userId === caller.id);
  const globalRank = globalIdx >= 0 ? globalIdx + 1 : null;
  const globalTotal = sekelompok.length;

  let divisiRank: number | null = null;
  let divisiTotal = 0;
  if (caller.sales_division) {
    const sedivisi = sekelompok.filter(p => p.divisi === caller.sales_division);
    const idx = sedivisi.findIndex(p => p.userId === caller.id);
    divisiRank = idx >= 0 ? idx + 1 : null;
    divisiTotal = sedivisi.length;
  }

  /*
    Penyamaran nama dilakukan DI SINI - sebelum data meninggalkan server -
    supaya tidak ada jalan mendapatkannya kembali dari sisi klien. Baris milik
    pemanggil sendiri tetap bernama asli, karena itu memang datanya sendiri
    dan ia harus bisa menemukan dirinya di papan.
  */
  const jadiBaris = (p: typeof sekelompok[number], i: number): BarisPapan => {
    const aku = p.userId === caller.id;
    return {
      rank: i + 1,
      nama: aku ? p.nama : `Peserta #${i + 1}`,
      quiz: p.quiz,
      avg: Math.round(p.avg * 10) / 10,
      lulus: p.lulus,
      flags: p.flags,
      aku,
    };
  };

  /*
    Papan dipotong PAPAN_TERATAS baris - TAPI baris pemanggil selalu ikut.

    Dulu seluruh kelompok dikirim tanpa batas. Untuk kelompok kecil itu tidak
    terasa, tapi begitu satu acara menambah puluhan peserta sekaligus, papannya
    jadi daftar panjang berisi "Peserta #38" yang tidak memberi tahu apa pun -
    sementara satu-satunya baris yang dicari orang, barisnya sendiri, terkubur
    di tengahnya.

    Dan bila pemanggil belum punya nilai terhitung (belum pernah submit, atau
    semua essay-nya masih menunggu dinilai) ia dulu TIDAK PUNYA BARIS SAMA
    SEKALI: papan tampil berisi orang lain semua, tanpa satu pun keterangan
    kenapa dirinya tidak ada di sana. Sekarang barisnya tetap muncul, ditandai
    belum dinilai.
  */
  const papan: BarisPapan[] = sekelompok.slice(0, PAPAN_TERATAS).map(jadiBaris);

  if (globalIdx >= PAPAN_TERATAS) {
    papan.push({ ...jadiBaris(sekelompok[globalIdx], globalIdx), disisipkan: true });
  } else if (globalIdx < 0) {
    /*
      Pemanggil tidak ada di kelompoknya. Dua sebab yang SANGAT berbeda, dan
      keduanya dulu ditampilkan sama - "0 quiz, 0 nilai, belum dinilai":

      a. Ia memang belum punya nilai terhitung. Nol memang benar.
      b. Ia PUNYA nilai, tapi role-nya berbeda dari kelompok yang sedang
         ditampilkan (mis. datanya terbaca 'sales' sementara papan ini
         'guest'). Menampilkan nol di sini adalah kebohongan: nilainya ada,
         cuma tidak di papan ini. Peserta yang baru saja mengerjakan quiz lalu
         melihat "0 - belum dinilai" wajar menyimpulkan pekerjaannya hilang.

      Jadi angkanya diambil dari perOrang - yang memuat SEMUA peserta tanpa
      penyaring role - dan tanda "belum dinilai" hanya dipasang kalau di sana
      pun ia tidak ada.
    */
    const milikku = perOrang.get(caller.id);
    papan.push(milikku
      ? {
          rank: 0, nama: milikku.nama, quiz: milikku.jumlah,
          avg: Math.round((milikku.total / milikku.jumlah) * 10) / 10,
          lulus: milikku.lulus, flags: milikku.flags,
          aku: true, disisipkan: true,
        }
      : {
          rank: 0, nama: 'Kamu', quiz: 0, avg: 0, lulus: 0, flags: 0,
          aku: true, disisipkan: true, belumDinilai: true,
        });
  }

  return { role: myRole, globalRank, globalTotal, divisi: caller.sales_division, divisiRank, divisiTotal, papan };
}

export async function ambilPeringkatSaya(): Promise<HasilPeringkat | null> {
  try {
    /*
      cache: 'no-store' - WAJIB, bukan kehati-hatian berlebihan.

      Halaman ini dibuka tepat SESUDAH peserta menekan Submit. URL-nya sama
      persis dengan yang dibuka sebelum quiz, tanpa parameter apa pun, dan
      jawabannya GET 200 biasa - jadi peramban berhak menyajikan salinan
      lamanya. Yang terlihat: peringkat yang dihitung SEBELUM nilainya masuk.
      Peserta melihat papan berisi orang lain semua dan barisnya sendiri
      bertanda "belum dinilai", padahal nilainya sudah ada di basis data.
    */
    const res = await fetch('/api/learning-center/rank', {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as HasilPeringkat;
  } catch {
    return null;
  }
}
