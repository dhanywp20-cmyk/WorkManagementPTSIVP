-- ═══════════════════════════════════════════════════════════════════════════
-- Skema Insentif PTS IVP & MVI 2026 — versi FINAL (revisi Direktur).
--
-- Menyisipkan satu versi skema baru. simpanSkema() sekarang MENAMBAH baris,
-- tidak menimpa, jadi INSERT di sini setara dengan menekan Simpan di layar
-- Skema Pembagian - bedanya angkanya tercatat hitam di atas putih dan bisa
-- dicocokkan dengan dokumen proposal tanpa membuka layar.
--
-- Versi LAMA tidak dihapus. Proyek yang tahapan pencairannya sudah dibuat
-- tetap dibayar memakai skema yang dibekukan padanya.
--
-- SYARAT URUTAN:
--   1. sql/incentive-skema-versi.sql     (kolom scheme_snapshot & riwayat)
--   2. sql/incentive-lingkup-brand.sql   (lingkup brand petugas Finance)
--   3. berkas ini
--
-- ── ATURAN "KERUCUT" DARI DIREKTUR ─────────────────────────────────────────
--
-- Ada DUA Supervisor yang memegang proyek sendiri-sendiri, sedangkan Manager
-- kebagian dari KEDUANYA. Supaya penghasilan setahun Manager setara dengan
-- penghasilan setahun SATU Supervisor:
--
--     tiap SPV = (N/2) x SPV%        Manager = N x MGR%
--     setara  ->  N x MGR% = (N/2) x SPV%  ->  MGR% = SPV% / 2
--
-- Karena itu porsi Manager selalu setengah porsi Supervisor - BUKAN sama.
--
-- ── ANGKA YANG DIPAKAI ─────────────────────────────────────────────────────
--
--  ONSITE, ada Support   PIC 60 · Support 17 · SPV 15 · Manager 8      = 100
--  ONSITE, tanpa Support PIC 55 · SPV 30 · Manager 15                  = 100
--  REMOTE, ada Support   PIC 40 · Support 15 · SPV 20 · Mgr 10 · Inst 15 = 100
--  REMOTE, tanpa Support PIC 55 · SPV 20 · Mgr 10 · Inst 15            = 100
--  Manager jadi PIC      ada TS: Mgr 70 · Support 30   |  tanpa TS: Mgr 100
--  Pencairan Tim PTS     50 / 35 / 15 selama 3 tahun
--
-- Porsi REMOTE diatur SENDIRI (porsiRemote.aktif = true), bukan diturunkan
-- dari porsi Onsite dikali sisa pool. Disengaja: beban koordinasi Supervisor
-- & Manager naik pada proyek remote, jadi porsinya sengaja lebih besar
-- daripada hasil penurunan otomatis.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO incentive_scheme_settings (scheme, updated_by, updated_at)
VALUES ('{
  "versi": 3,
  "porsi": [
    { "peran": "pic",        "label": "PIC Proyek",                    "persen": 60, "bagiRata": false },
    { "peran": "support",    "label": "Tim Support (Troubleshooting)", "persen": 17, "bagiRata": true  },
    { "peran": "supervisor", "label": "Supervisor",                    "persen": 15, "bagiRata": true  },
    { "peran": "manager",    "label": "Manager",                       "persen": 8,  "bagiRata": false }
  ],
  "tanpaSupport": { "pic": 55, "supervisor": 30, "manager": 15 },
  "jendelaSupportBulan": 12,
  "hangusSupervisorKe": "manager",
  "managerSebagaiPic": {
    "adaSupport":   { "pic": 70, "support": 30 },
    "tanpaSupport": { "pic": 100 }
  },
  "installerAktif": true,
  "installerRemotePersen": 15,
  "installerHanyaRemote": true,
  "installerBayarDiMuka": true,
  "porsiRemote": {
    "aktif": true,
    "adaSupport":   { "pic": 40, "support": 15, "supervisor": 20, "manager": 10, "installer": 15 },
    "tanpaSupport": { "pic": 55, "supervisor": 20, "manager": 10, "installer": 15 }
  },
  "tranche": [
    { "nomor": 1, "persen": 50, "tahunKe": 1 },
    { "nomor": 2, "persen": 35, "tahunKe": 2 },
    { "nomor": 3, "persen": 15, "tahunKe": 3 }
  ]
}'::jsonb, 'Proposal 2026 revisi Direktur (SQL)', NOW());

-- ── Periksa: kelima kelompok persen harus 100, dan Manager = SPV/2 ─────────
WITH terbaru AS (
  SELECT scheme FROM incentive_scheme_settings ORDER BY updated_at DESC LIMIT 1
)
SELECT
  (SELECT SUM((p->>'persen')::numeric) FROM terbaru, jsonb_array_elements(scheme->'porsi') p)                     AS total_onsite,
  (SELECT SUM(v::numeric) FROM terbaru, jsonb_each_text(scheme->'tanpaSupport') AS t(k,v))                        AS total_onsite_tanpa_support,
  (SELECT SUM(v::numeric) FROM terbaru, jsonb_each_text(scheme->'porsiRemote'->'adaSupport') AS t(k,v))           AS total_remote,
  (SELECT SUM(v::numeric) FROM terbaru, jsonb_each_text(scheme->'porsiRemote'->'tanpaSupport') AS t(k,v))         AS total_remote_tanpa_support,
  (SELECT SUM((t->>'persen')::numeric) FROM terbaru, jsonb_array_elements(scheme->'tranche') t)                   AS total_tahapan,
  (SELECT SUM(v::numeric) FROM terbaru, jsonb_each_text(scheme->'managerSebagaiPic'->'adaSupport') AS t(k,v))     AS total_mgr_pic_ada_ts,
  (SELECT SUM(v::numeric) FROM terbaru, jsonb_each_text(scheme->'managerSebagaiPic'->'tanpaSupport') AS t(k,v))   AS total_mgr_pic_tanpa_ts;
