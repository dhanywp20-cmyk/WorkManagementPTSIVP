/**
 * lib/notifikasi/penyedia-wa.ts - daftar penyedia gateway WhatsApp.
 *
 * KENAPA BERKAS INI ADA
 *
 * Sebelumnya Fonnte tertanam di mana-mana: nama tokennya, alamat API-nya,
 * bentuk jawabannya, bahkan judul kartunya di Admin Panel. Berpindah penyedia
 * berarti menyunting berkas-berkas itu satu per satu lalu deploy ulang.
 *
 * Sekarang tiap penyedia dijelaskan sebagai data di sini - kolom apa yang ia
 * butuhkan, mana yang rahasia, dan alamat mana yang dipanggil. Admin Panel
 * membangun formulirnya dari daftar ini, dan route servernya memilih alamat
 * dari daftar ini juga. Menambah penyedia baru = menambah satu entri.
 *
 * PEMISAHAN RAHASIA vs BUKAN, dan kenapa penting
 *
 * `rahasia: true` -> tabel rahasia_integrasi (RLS tanpa policy; hanya
 * service_role di sisi server yang bisa membacanya, dan nilainya tidak pernah
 * dikirim balik ke peramban).
 *
 * `rahasia: false` -> ikut menumpang di app_settings bersama pengaturan
 * notifikasi lain. Yang boleh ke sana hanya hal yang tidak memberi akses
 * kalau bocor - id nomor telepon, alamat webhook. app_settings terbaca oleh
 * siapa pun yang memegang anon key, jadi menaruh token di sana sama saja
 * dengan menempelkannya di depan pintu. Basis datanya pun menolak: ada
 * trigger tolak_rahasia_di_pengaturan() yang memblokir kunci bernama
 * token/secret/api_key/password/credential.
 */

export type PenyediaWA = 'fonnte' | 'meta_cloud' | 'kustom';

export interface KolomPenyedia {
  /**
   * Untuk kolom rahasia: kunci baris di rahasia_integrasi.
   * Untuk kolom biasa: nama field di dalam PengaturanNotifikasi.waConfig.
   */
  kunci: string;
  label: string;
  rahasia: boolean;
  petunjuk: string;
  placeholder?: string;
}

export interface DefinisiPenyedia {
  key: PenyediaWA;
  label: string;
  /** Satu baris di bawah nama penyedia pada pemilihnya. */
  ringkas: string;
  /** Penyedia resmi Meta, bukan gateway pihak ketiga. */
  resmi: boolean;
  kolom: KolomPenyedia[];
  /** Batasan penting yang harus diketahui admin SEBELUM ia berpindah. */
  catatan?: string;
  /** Penyedia ini bisa ditanya "token saya sah?" tanpa mengirim pesan. */
  bisaCek: boolean;
}

export const PENYEDIA_WA: DefinisiPenyedia[] = [
  {
    key: 'fonnte',
    label: 'Fonnte',
    ringkas: 'Gateway pihak ketiga (Indonesia). Yang dipakai platform ini sekarang.',
    resmi: false,
    bisaCek: true,
    kolom: [
      {
        kunci: 'whatsapp.token',
        label: 'Token Fonnte',
        rahasia: true,
        petunjuk: 'Ambil di dashboard Fonnte → Device → Token.',
        placeholder: 'tempel token di sini',
      },
    ],
  },
  {
    key: 'meta_cloud',
    label: 'WhatsApp Cloud API (resmi Meta)',
    ringkas: 'API resmi dari Meta. Butuh akun WhatsApp Business & nomor terdaftar.',
    resmi: true,
    bisaCek: true,
    //  Ini BUKAN detail kecil: platform ini mengirim notifikasi yang tidak
    //  diminta penerimanya (tiket baru, reminder jatuh tempo). Cloud API hanya
    //  mengizinkan teks bebas dalam 24 jam sesudah orang itu membalas; di luar
    //  itu wajib memakai template yang sudah disetujui Meta. Berpindah ke sini
    //  tanpa menyiapkan template berarti sebagian besar notifikasi akan
    //  ditolak - dan lebih baik admin tahu sebelum berpindah, bukan sesudah
    //  tim berhenti menerima pemberitahuan.
    catatan:
      'Cloud API hanya mengizinkan pesan teks bebas dalam 24 jam sesudah penerima '
      + 'membalas. Di luar jendela itu Meta mewajibkan template yang sudah disetujui. '
      + 'Notifikasi platform ini kebanyakan di luar jendela tersebut, jadi siapkan '
      + 'template lebih dulu sebelum menjadikannya penyedia utama.',
    kolom: [
      {
        kunci: 'whatsapp.meta_token',
        label: 'Access Token',
        rahasia: true,
        petunjuk: 'Meta for Developers → aplikasi Anda → WhatsApp → API Setup. Pakai token permanen (System User), bukan token sementara 24 jam.',
        placeholder: 'tempel access token di sini',
      },
      {
        kunci: 'metaPhoneNumberId',
        label: 'Phone Number ID',
        rahasia: false,
        petunjuk: 'Angka di halaman API Setup, di bawah nomor pengirim. Bukan nomor teleponnya.',
        placeholder: 'mis. 123456789012345',
      },
    ],
  },
  {
    key: 'kustom',
    label: 'Webhook kustom',
    ringkas: 'Penyedia lain apa pun yang menerima POST JSON. Tanpa ubah kode.',
    resmi: false,
    //  Tidak ada cara umum menanyakan "token saya sah?" ke alamat sembarangan -
    //  yang ada cuma mengirim pesan sungguhan. Jadi tombol Tes Koneksi
    //  dimatikan untuk penyedia ini alih-alih memanggil sesuatu yang menebak.
    bisaCek: false,
    catatan:
      'Platform mengirim POST JSON {"target":"6281…","message":"…"} ke alamat yang '
      + 'Anda isi, dengan header Authorization berisi token. Penyedia dianggap '
      + 'berhasil bila membalas HTTP 2xx.',
    kolom: [
      {
        kunci: 'kustomUrl',
        label: 'URL endpoint',
        rahasia: false,
        petunjuk: 'Alamat lengkap yang menerima POST JSON.',
        placeholder: 'https://api.penyedia.com/send',
      },
      {
        kunci: 'whatsapp.kustom_token',
        label: 'Token / API key',
        rahasia: true,
        petunjuk: 'Dikirim sebagai header Authorization apa adanya. Tambahkan sendiri awalan "Bearer " bila penyedia Anda memintanya.',
        placeholder: 'tempel token di sini',
      },
    ],
  },
];

export function penyediaWA(key: PenyediaWA | undefined): DefinisiPenyedia {
  //  Fonnte jadi jatuhnya kalau nilainya tidak dikenal: itu penyedia yang
  //  sedang berjalan di produksi, jadi pilihan yang rusak/kosong tidak boleh
  //  menghentikan pengiriman - ia harus jatuh ke perilaku hari ini.
  return PENYEDIA_WA.find(p => p.key === key) ?? PENYEDIA_WA[0];
}
