-- 040_pustaka_tools_team.sql
--
-- Pustaka Tools Team: katalog produk (proyektor, speaker, amplifier, display/panel videowall,
-- perangkat rak & PoE), data acuan (material akustik, bitrate AV-over-IP) dan artikel panduan yang
-- diisi tim lewat Tools Team > Pustaka - mengurangi angka yang ditulis langsung di kode.
-- Jenis & bidangnya didefinisikan di lib/pustaka.ts (registri); `data` divalidasi server menurut
-- registri itu. RLS menyala tanpa policy: hanya service role di /api/tools-team/pustaka.
--
-- Isi awal = nilai bawaan yang sebelumnya tertulis di kode (kalkulator tetap memakai nilai bawaan
-- bila pustaka kosong), contoh produk generik, dan artikel panduan dasar.

create table if not exists public.tools_pustaka (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis ~ '^[a-z][a-z-]{1,39}$'),
  nama text not null check (char_length(nama) between 1 and 120),
  data jsonb not null default '{}'::jsonb,
  dibuat_oleh uuid references public.users(id) on delete set null,
  diubah_oleh_nama text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tools_pustaka_jenis_idx on public.tools_pustaka (jenis, nama);
alter table public.tools_pustaka enable row level security;
comment on table public.tools_pustaka is
  'Pustaka Tools Team (produk, data acuan, artikel). Jenis & bidang: lib/pustaka.ts. Akses lewat /api/tools-team/pustaka.';

insert into public.tools_pustaka (jenis, nama, data, diubah_oleh_nama) values
  -- Panel videowall (sebelumnya PANEL_VIDEOWALL di kode) & display tunggal umum
  ('display', 'Panel videowall 46" bezel 3,5 mm (umum)', '{"diagonal":46,"bezel":3.5,"resolusi":"FHD","nits":500}', 'Bawaan'),
  ('display', 'Panel videowall 49" bezel 3,5 mm (umum)', '{"diagonal":49,"bezel":3.5,"resolusi":"FHD","nits":500}', 'Bawaan'),
  ('display', 'Panel videowall 55" bezel 3,5 mm (umum)', '{"diagonal":55,"bezel":3.5,"resolusi":"FHD","nits":500}', 'Bawaan'),
  ('display', 'Panel videowall 55" bezel 1,8 mm (umum)', '{"diagonal":55,"bezel":1.8,"resolusi":"FHD","nits":500}', 'Bawaan'),
  ('display', 'Panel videowall 55" bezel 0,88 mm (umum)', '{"diagonal":55,"bezel":0.88,"resolusi":"FHD","nits":500}', 'Bawaan'),
  ('display', 'Display 75" 4K (umum)', '{"diagonal":75,"bezel":0,"resolusi":"4K","nits":400,"watt":250}', 'Bawaan'),
  ('display', 'Display 86" 4K (umum)', '{"diagonal":86,"bezel":0,"resolusi":"4K","nits":400,"watt":400}', 'Bawaan'),
  ('display', 'Display 98" 4K (umum)', '{"diagonal":98,"bezel":0,"resolusi":"4K","nits":450,"watt":550}', 'Bawaan'),
  -- Material akustik (koefisien 500 Hz, sebelumnya MATERIAL_AKUSTIK di kode)
  ('material-akustik', 'Beton / bata plester', '{"a":0.02}', 'Bawaan'),
  ('material-akustik', 'Keramik / granit', '{"a":0.02}', 'Bawaan'),
  ('material-akustik', 'Kaca', '{"a":0.04}', 'Bawaan'),
  ('material-akustik', 'Gipsum', '{"a":0.05}', 'Bawaan'),
  ('material-akustik', 'Panel kayu', '{"a":0.1}', 'Bawaan'),
  ('material-akustik', 'Karpet', '{"a":0.25}', 'Bawaan'),
  ('material-akustik', 'Gorden tebal', '{"a":0.5}', 'Bawaan'),
  ('material-akustik', 'Plafon akustik (mineral)', '{"a":0.7}', 'Bawaan'),
  ('material-akustik', 'Panel akustik 50 mm', '{"a":0.9}', 'Bawaan'),
  -- Aliran AV-over-IP (sebelumnya ALIRAN_IP di kode)
  ('aliran-ip', 'H.264 1080p (encoder / streaming)', '{"mbps":12}', 'Bawaan'),
  ('aliran-ip', 'H.265 4K', '{"mbps":25}', 'Bawaan'),
  ('aliran-ip', 'NDI|HX 1080p60', '{"mbps":20}', 'Bawaan'),
  ('aliran-ip', 'NDI (full) 1080p60', '{"mbps":150}', 'Bawaan'),
  ('aliran-ip', 'NDI (full) 4K60', '{"mbps":250}', 'Bawaan'),
  ('aliran-ip', 'JPEG2000 4K60 (AVoIP 1 GbE)', '{"mbps":900}', 'Bawaan'),
  ('aliran-ip', 'SDVoE 4K60 tanpa kompresi (10 GbE)', '{"mbps":9500}', 'Bawaan'),
  -- Perangkat rak & PoE umum
  ('perangkat-rak', 'Switcher / matrix HDMI (umum)', '{"u":1,"kg":4,"watt":60}', 'Bawaan'),
  ('perangkat-rak', 'DSP audio (umum)', '{"u":1,"kg":4,"watt":40}', 'Bawaan'),
  ('perangkat-rak', 'Network switch PoE 24 port (umum)', '{"u":1,"kg":4,"watt":200}', 'Bawaan'),
  ('perangkat-rak', 'PDU 1U (umum)', '{"u":1,"kg":2,"watt":0}', 'Bawaan'),
  ('perangkat-rak', 'UPS rackmount 2U (umum)', '{"u":2,"kg":25,"watt":50}', 'Bawaan'),
  ('perangkat-poe', 'Kamera PTZ (umum)', '{"watt":25,"kelas":"at"}', 'Bawaan'),
  ('perangkat-poe', 'Ceiling mic array (umum)', '{"watt":12,"kelas":"af"}', 'Bawaan'),
  ('perangkat-poe', 'Touch panel 10" (umum)', '{"watt":10,"kelas":"af"}', 'Bawaan'),
  ('perangkat-poe', 'Wireless access point (umum)', '{"watt":20,"kelas":"at"}', 'Bawaan'),
  ('perangkat-poe', 'Encoder / decoder AVoIP (umum)', '{"watt":13,"kelas":"af"}', 'Bawaan'),
  -- Contoh produk generik (ganti / tambah dengan model sebenarnya)
  ('proyektor', 'Contoh: laser 6.000 lm WUXGA lensa standar', '{"lumen":6000,"resolusi":"WUXGA","throwMin":1.39,"throwMaks":2.22,"shiftAtas":50,"shiftBawah":0,"sumber":"laser","catatan":"Contoh generik - ganti dengan model & datasheet sebenarnya."}', 'Bawaan'),
  ('proyektor', 'Contoh: laser 10.000 lm WUXGA venue', '{"lumen":10000,"resolusi":"WUXGA","throwMin":1.7,"throwMaks":2.4,"shiftAtas":67,"shiftBawah":67,"sumber":"laser","catatan":"Contoh generik - ganti dengan model & datasheet sebenarnya."}', 'Bawaan'),
  ('proyektor', 'Contoh: ultra short throw 4.000 lm', '{"lumen":4000,"resolusi":"WUXGA","throwMin":0.25,"throwMaks":0.25,"shiftAtas":0,"shiftBawah":0,"sumber":"laser","catatan":"Contoh generik - ganti dengan model & datasheet sebenarnya."}', 'Bawaan'),
  ('speaker', 'Contoh: speaker plafon 6,5" 100 V', '{"tipe":"plafon","sensitivitas":89,"sudut":100,"ohm":8,"tap":"3/6/12","wattMaks":30,"catatan":"Contoh generik - ganti dengan model & datasheet sebenarnya."}', 'Bawaan'),
  ('speaker', 'Contoh: speaker dinding 8" 100 V', '{"tipe":"dinding","sensitivitas":91,"sudut":90,"ohm":8,"tap":"7,5/15/30","wattMaks":60,"catatan":"Contoh generik - ganti dengan model & datasheet sebenarnya."}', 'Bawaan'),
  ('amplifier', 'Contoh: amplifier mixer 240 W 100 V', '{"kanal":1,"wattKanal":240,"beban":"100V","u":2,"kg":9,"watt":400,"catatan":"Contoh generik - ganti dengan model & datasheet sebenarnya."}', 'Bawaan'),
  -- Artikel panduan dasar
  ('artikel', 'Memilih ukuran layar: aturan 4-6-8', '{"kategori":"layar","ringkas":"Tinggi gambar ditentukan oleh penonton TERJAUH, bukan luas ruang.","isi":"1. Ukur jarak penonton terjauh (D).\n2. Tentukan jenis konten: video/presentasi umum H = D/8, dokumen/spreadsheet H = D/6, gambar teknik/angka kecil H = D/4.\n3. Lebar = H x rasio (16:9 -> lebar = 1,78 x H). Diagonal = akar(lebar^2 + H^2).\n4. Cek penonton TERDEKAT: sudut dari mata ke tepi atas gambar sebaiknya <= 30 derajat, dan resolusi cukup tajam bila penonton terdekat >= pitch piksel / tan(1 menit busur) (lihat Kalkulator AV > Ukuran Layar).\n5. Tepi bawah gambar 1,0-1,2 m dari lantai supaya terlihat melewati kepala penonton di depan.\n\nBila diagonal hasil di atas 110 inci, pertimbangkan videowall LCD, LED videotron, atau proyektor.","sumber":"Praktik AVIXA (Display Image Size for 2D Content)"}', 'Bawaan'),
  ('artikel', 'Kecerahan proyektor & kategori kontras', '{"kategori":"proyektor","ringkas":"Lumen dihitung dari cahaya ruang yang JATUH DI LAYAR dan kontras yang dibutuhkan konten.","isi":"Standar ANSI/INFOCOMM 3M-2011 membagi kebutuhan kontras: tontonan pasif 7:1, keputusan dasar (presentasi, rapat) 15:1, keputusan analitis (spreadsheet, CAD) 50:1, video gerak penuh 80:1.\n\nKontras = (cahaya proyektor + cahaya ruang di layar) / cahaya ruang di layar, sehingga lumen = lux di layar x luas layar (m2) x (kontras - 1) / gain layar.\n\nUkur lux dengan lux meter yang ditempel di permukaan layar menghadap ruangan, lampu ruang menyala seperti saat dipakai. Tambahkan cadangan susut cahaya: laser +-20%, lampu +-30-50%.\n\nCara termurah menaikkan kontras: mengurangi cahaya yang jatuh ke layar (zona lampu, tirai), bukan membeli proyektor lebih terang.","sumber":"ANSI/INFOCOMM 3M-2011"}', 'Bawaan'),
  ('artikel', 'Pitch LED, jarak pandang & resolusi konten', '{"kategori":"led","ringkas":"Pitch (mm) kira-kira = jarak pandang minimum (m); nyaman +-3x pitch.","isi":"- Jarak minimum: angka pitch dalam mm ~ jarak dalam meter (P2,5 -> +-2,5 m).\n- Jarak nyaman / piksel tidak terlihat: +-3x pitch (P2,5 -> +-7,5 m).\n- Resolusi konten = resolusi total layar (kolom x piksel per cabinet). Minta tim konten membuat video PERSIS di resolusi itu - bukan 1920x1080 lalu diregangkan.\n- Kecerahan: indoor 600-1.000 nits, semi-outdoor 2.500-4.000, outdoor 5.000+. Terlalu terang di indoor melelahkan mata - turunkan lewat controller.\n- Kapasitas port sending card +-650.000 piksel per port (8-bit 60 Hz); bit lebih tinggi / refresh lebih tinggi mengurangi kapasitas.","sumber":"Praktik industri LED (Novastar, pabrikan modul)"}', 'Bawaan'),
  ('artikel', 'Speaker line 70/100 V: tap, amplifier & kabel', '{"kategori":"audio","ringkas":"Jumlahkan tap seluruh speaker, tambah 25%, lalu pilih amplifier.","isi":"Sistem line tegangan konstan dipakai untuk banyak speaker berjarak jauh (plafon, paging, BGM).\n\n1. Pilih tap tiap speaker sesuai kebutuhan SPL area (tap lebih besar = lebih keras).\n2. Total tap x 1,25 = daya amplifier minimum. Jangan membebani amplifier sampai 100%.\n3. Impedansi line = V^2 / total tap (100 V, 120 W -> 83 ohm); tidak boleh di bawah minimum amplifier.\n4. Kabel: rugi sebaiknya <= 1 dB. Untuk line panjang naikkan penampang atau bagi menjadi beberapa zona.\n5. Jangan mencampur speaker low-impedance (4/8 ohm) di line 70/100 V tanpa trafo.","sumber":"Praktik instalasi audio"}', 'Bawaan'),
  ('artikel', 'RT60: kenapa ruang rapat bergema', '{"kategori":"audio","ringkas":"Ruang video conference sebaiknya RT60 <= 0,6 detik.","isi":"RT60 = waktu suara turun 60 dB setelah sumber berhenti. Rumus Sabine: RT60 = 0,161 x volume / serapan total.\n\nPermukaan keras (kaca, beton, keramik, gipsum) hampir tidak menyerap; ruang rapat berdinding kaca bisa > 1 detik sehingga mic menangkap gema dan lawan bicara mendengar suara jauh.\n\nTarget: ruang rapat 0,4-0,6 s; kelas 0,5-0,7 s; auditorium pidato 0,8-1,2 s.\nSolusi: panel akustik di dinding belakang & titik pantul samping, plafon akustik, karpet, gorden. Kalkulator AV > Audio > Akustik ruang menghitung luas panel yang dibutuhkan.","sumber":"Sabine; praktik akustik ruang"}', 'Bawaan'),
  ('artikel', 'PoE & jaringan AV-over-IP', '{"kategori":"jaringan","ringkas":"Hitung anggaran PoE +20% dan sisakan 30% kapasitas link.","isi":"PoE: 802.3af 15,4 W per port (di switch), 802.3at (PoE+) 30 W, 802.3bt 60/90 W. Pakai konsumsi maksimum dari datasheet; anggaran PoE switch >= total + 20%. Kabel maksimum 100 m.\n\nAV-over-IP: jumlahkan bitrate semua aliran (NDI|HX +-20 Mbps, NDI full 1080p +-150 Mbps, SDVoE +-9,5 Gbps) + Dante (+-1,7 Mbps per kanal 48 kHz). Total sebaiknya <= 70% kapasitas link. Gunakan switch managed dengan IGMP snooping untuk multicast dan QoS (DSCP) untuk Dante.","sumber":"IEEE 802.3af/at/bt; Audinate; NDI"}', 'Bawaan'),
  ('artikel', 'Cara menambah isi Pustaka', '{"kategori":"umum","ringkas":"Admin bisa menambah produk, data acuan & artikel tanpa mengubah kode.","isi":"Tools Team > Pustaka berisi katalog produk (proyektor, speaker, amplifier, display, perangkat rak & PoE), data acuan (material akustik, bitrate AV-over-IP) dan artikel panduan.\n\n- Semua anggota bisa membaca & memakai isinya di kalkulator (tombol \"dari Pustaka\").\n- Admin / Full Access bisa menambah, mengubah & menghapus.\n- Isi angka dari DATASHEET resmi; tulis sumbernya di Catatan.\n- Entri berlabel \"Contoh\" / \"(umum)\" adalah nilai generik - ganti dengan model sebenarnya yang dijual / dipasang tim.\n- Artikel: tulis langkah praktis dan pengalaman lapangan supaya engineer baru bisa belajar sendiri.","sumber":"Tim PTS"}', 'Bawaan');
