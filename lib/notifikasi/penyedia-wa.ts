
export type PenyediaWA = 'fonnte' | 'meta_cloud' | 'kustom';

export interface KolomPenyedia {
  kunci: string;
  label: string;
  rahasia: boolean;
  petunjuk: string;
  placeholder?: string;
}

export interface DefinisiPenyedia {
  key: PenyediaWA;
  label: string;
  ringkas: string;
  resmi: boolean;
  kolom: KolomPenyedia[];
  catatan?: string;
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
  return PENYEDIA_WA.find(p => p.key === key) ?? PENYEDIA_WA[0];
}
