-- ═══════════════════════════════════════════════════════════════════════════
-- Terapkan angka Proposal Insentif PTS IVP & MVI 2026 sebagai versi skema baru.
--
-- KENAPA LEWAT SQL, BUKAN TOMBOL DI LAYAR
--
-- Hasilnya sama persis: simpanSkema() sekarang MENYISIPKAN baris baru, tidak
-- lagi menimpa. Jadi satu INSERT di sini setara dengan menekan "Kembalikan ke
-- bawaan" lalu "Simpan" - bedanya angkanya tercatat hitam di atas putih di
-- berkas ini, jadi bisa dibaca ulang dan dicocokkan dengan dokumen proposal
-- tanpa perlu membuka layar.
--
-- Versi LAMA tidak dihapus. Ia jadi riwayat, dan proyek yang tahapannya sudah
-- dibuat tetap dibayar memakai skema yang dibekukan padanya.
--
-- SYARAT: jalankan sql/incentive-skema-versi.sql lebih dulu.
--
-- Angka di bawah = Proposal 2026 Bagian III.A & VI:
--   PIC 65 · Support 15 · Supervisor 10 · Manager 10          (= 100)
--   Tanpa support: PIC 80 · Supervisor 10 · Manager 10        (= 100)
--   Supervisor jadi PIC  -> porsi koordinasinya ke Manager
--   Manager jadi PIC     -> Manager menerima seluruh pool
--   Installer daerah 15%, HANYA Remote, dibayar penuh di tahun pertama
--   Pencairan Tim PTS: 50 / 35 / 15 selama 3 tahun
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO incentive_scheme_settings (scheme, updated_by, updated_at)
VALUES ('{
  "versi": 3,
  "porsi": [
    { "peran": "pic",        "label": "PIC Proyek",                    "persen": 65, "bagiRata": true  },
    { "peran": "support",    "label": "Tim Support (Troubleshooting)", "persen": 15, "bagiRata": true  },
    { "peran": "supervisor", "label": "Supervisor",                    "persen": 10, "bagiRata": true  },
    { "peran": "manager",    "label": "Manager",                       "persen": 10, "bagiRata": false }
  ],
  "tanpaSupport": { "pic": 80, "supervisor": 10, "manager": 10 },
  "jendelaSupportBulan": 12,
  "hangusSupervisorKe": "manager",
  "managerSebagaiPic": { "pic": 100 },
  "installerAktif": true,
  "installerRemotePersen": 15,
  "installerHanyaRemote": true,
  "installerBayarDiMuka": true,
  "tranche": [
    { "nomor": 1, "persen": 50, "tahunKe": 1 },
    { "nomor": 2, "persen": 35, "tahunKe": 2 },
    { "nomor": 3, "persen": 15, "tahunKe": 3 }
  ]
}'::jsonb, 'Proposal 2026 (SQL)', NOW());

-- Periksa: versi teratas harus berjumlah 100 di ketiga kelompoknya.
SELECT
  updated_at,
  updated_by,
  (SELECT SUM((p->>'persen')::numeric) FROM jsonb_array_elements(scheme->'porsi') p)          AS total_porsi,
  (SELECT SUM(v::numeric) FROM jsonb_each_text(scheme->'tanpaSupport') AS t(k,v))             AS total_tanpa_support,
  (SELECT SUM((t->>'persen')::numeric) FROM jsonb_array_elements(scheme->'tranche') t)        AS total_tahapan,
  scheme->>'installerRemotePersen'                                                            AS porsi_installer
FROM incentive_scheme_settings
ORDER BY updated_at DESC
LIMIT 3;
