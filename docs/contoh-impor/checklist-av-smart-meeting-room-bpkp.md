# Checklist Instalasi & Konfigurasi AV – Smart Meeting Room BPKP

Ekspor dokumen checklist 2 Okt 2026. Impor lewat Project Progress → buka proyek → Checklist lokasi → Isi awal: Impor → Teks / Markdown → Buka file .md.

## 1. Info proyek & daftar perangkat

Proyek Smart Meeting Room BPKP, acuan wiring diagram rev. 0 tanggal 12/08/2026 (Y.K.S.). Ruangan dibagi 4 zona: **WALL**, **RACK**, **OPERATOR**, **TABLE**. Semua perangkat kontrol ada di subnet 192.168.1.0/24; laptop teknisi pakai IP statis 192.168.1.250 saat konfigurasi.

| Perangkat | Model | Zona | IP | Catatan |
| --- | --- | --- | --- | --- |
| DSP | Tricolor TAP | Rack | 192.168.1.88 | 4 in / 4 out, USB audio |
| Lampu | Lutron Interface + DALI | Rack | 192.168.1.89 | Keypad + lighting via DALI |
| Camera | Aver (PTZ) | Wall | 192.168.1.90 | USB lewat HDBaseT ke matrix |
| Scaler | MX-0404-SCL | Rack | 192.168.1.91 | Matrix Out 1-3 ke 3 signage |
| WPS | SW-640-TX | Operator | 192.168.1.92 | HDMI ke matrix In 8 |
| Matrix | MX-1007-HYB | Rack | 192.168.1.93 | Hybrid matrix 9 in |
| Display Kiri | Philips signage | Wall | 192.168.1.94 | HDBaseT dari scaler |
| Display Tengah | Philips signage | Wall | 192.168.1.95 | HDBaseT dari scaler |
| Display Kanan | Philips signage | Wall | 192.168.1.96 | HDBaseT dari scaler |
| Interactive Display | IFP | Wall | 192.168.1.97 | Matrix Out 4, RS232 ke Cue |
| Control | Cue Versatile | Rack | 192.168.1.127 | + Cue Relay |

Perangkat tanpa IP di daftar: router dualband, switch 16 port, 4 extender set HDMI/HDBaseT, 2 amplifier, 8 speaker plafon, receiver mic chairman-delegate + receiver clip-on, sensor okupansi plafon, relay + roll banner, 5 tabletop box (7 input HDMI) + 2 switcher Aten 4x1, PC operator, soundcard, monitor sentuh 27" pimpinan, 2 tablet 10", 2 UPS APC.

## 2. Persiapan & pra-instalasi

- [x] Cetak wiring diagram rev. 0 dan layout rak; bawa versi terbaru ke lokasi
- [x] Cek fisik semua perangkat sesuai daftar (jumlah, model, aksesori, adaptor, bracket)
- [x] Cek material kabel: CAT6, HDMI (1 m, 2 m, 10 m), USB A-B 3.0 (10 m, 30 m), kabel audio XLR/AKAI, kabel speaker, kabel power
- [x] Siapkan konektor: RJ45, XLR male/female, XLR cabang female, AKAI male, Speakon, terminal phoenix
- [x] Survei ruangan: titik dinding untuk 3 signage + IFP, titik kamera, 8 titik speaker plafon, titik sensor okupansi, keypad lampu, roll banner
- [x] Survei meja: posisi 5 tabletop box, 2 switcher 4x1, mic chairman & delegate, posisi monitor 27" pimpinan
- [x] Pastikan jalur kabel (conduit/trunking/raceway) dari wall, table, dan operator ke rak sudah tersedia
- [x] Pastikan stop kontak & daya rak cukup, grounding OK, jalur listrik rak lewat 2 UPS
- [x] Siapkan alat: crimping, LAN tester, multimeter, solder, label maker, laptop + adaptor LAN, kabel RS232/USB-serial
- [x] Siapkan firmware, software, dan lisensi tiap perangkat (DSP, matrix, scaler, Cue, Lutron, kamera)

## 3. Instalasi rak (Intellinet)

Pasang dari bawah ke atas: perangkat berat (UPS, amplifier) di bawah. Urutan sesuai layout rak:

| Posisi (atas ke bawah) | Perangkat | Tinggi |
| --- | --- | --- |
| 1 | Router dualband | di ambalan atas |
| 2 | Switch Cisco | 1U |
| 3 | Extender HDBaseT (2 depan, 2 belakang) + Extender (4 depan, 2 belakang) | di ambalan |
| 4 | Ambalan rak | - |
| 5 | MX-0404-SCL, Cue Versatile, Cue Relay | di ambalan |
| 6 | Matrix MX-1007-HYB | 2U |
| 7 | DSP Tricolor | 1U |
| 8 | Receiver clip-on | 1U |
| 9 | Receiver chairman-delegate | 2U |
| 10 | Amplifier x2 | 2U per unit |
| 11 | UPS APC x2 | 2U per unit |

- [x] Rak berdiri tegak, roda terkunci/rata, posisi bisa diakses depan & belakang
- [x] UPS dan amplifier terpasang dengan rail/bracket penahan beban
- [x] Sisakan ventilasi di antara amplifier dan di atas DSP
- [x] Ambalan terpasang kuat; extender, scaler, Cue diikat (velcro/bracket) agar tidak geser
- [x] PDU terpasang; semua daya perangkat lewat UPS
- [x] Manajemen kabel: jalur daya terpisah dari jalur sinyal audio/video

Catatan: wiring diagram menulis "Switch HUB 16 Port", layout rak menulis "Switch Cisco 1U". Pastikan model final sebelum pasang.

## 4. Instalasi perangkat di ruangan

**Zona WALL**

- [ ] Bracket + IFP terpasang, level, tinggi sesuai gambar; receiver HDBaseT dan transmitter extender IFP di belakang unit
- [ ] 3 signage Philips (kiri, tengah, kanan) terpasang sejajar; receiver HDBaseT di belakang tiap signage
- [ ] Kamera Aver PTZ terpasang di tengah atas, menghadap meja, kabel LAN + HDBaseT/USB ke receiver signage tengah
- [ ] 8 speaker plafon (4 kiri, 4 kanan) terpasang, kabel daisy chain per sisi
- [ ] Sensor okupansi plafon terpasang di titik yang meliput area meja; set DIP switch A dan B (sensitivitas & waktu tunda), LED hidup
- [ ] Keypad lampu terpasang di dinding dekat pintu; lampu DALI terhubung
- [ ] Roll banner (motor) terpasang dan dayanya lewat Cue Relay

**Zona OPERATOR**

- [ ] PC operator + monitor, soundcard (USB ke PC), WPS SW-640-TX di meja operator
- [ ] Wallplate transmitter terpasang di meja/dinding operator
- [ ] Transmitter extender x2 di bawah meja operator
- [ ] Tablet 10" controller operator + dudukan/charger

**Zona TABLE**

- [x] 5 tabletop box terpasang di meja (2 kiri, 1 tengah, 2 kanan), total 7 input HDMI; beri label nomor input di tiap colokan
- [x] 2 switcher Aten 4x1 + transmitter extender x3 di bawah meja
- [x] Monitor sentuh 27" pimpinan terpasang; kabel HDMI 10 m + USB A-B 3.0 10 m dari PC operator
- [x] Tablet 10" controller pimpinan + dudukan/charger
- [x] Mic chairman & delegate (wireless) diberi nomor dan baterai/charger siap
- [x] Dongle wireless & Miracast siap untuk laptop tamu (laptop dari pihak lain)

## 5. Penarikan kabel & terminasi

Semua kabel diberi label di kedua ujung (asal - tujuan - port) dan dites sebelum disambung ke perangkat.

**Peta port video & USB matrix MX-1007-HYB**

| Port matrix | Tersambung ke | Media |
| --- | --- | --- |
| In 2-4 | Receiver extender x3 rak, dari transmitter IFP (HDMI out) + transmitter extender x2 PC operator | CAT6 + HDMI 1 m |
| In 5-7 | Receiver extender x3 rak, dari transmitter extender x3 meja (switcher Aten kiri, tabletop tengah, switcher Aten kanan) | CAT6 + HDMI 1 m |
| In 8 | WPS SW-640-TX | HDMI 10 m |
| In 9 (HDBT) | Wallplate transmitter operator | CAT6 |
| USB Host 2 | PC operator | USB A-B 3.0 30 m |
| Usb1 | Transmitter HDBaseT x3 (USB kamera via receiver signage) | USB |
| Usb2 | DSP (USB audio) | USB |
| Out 1-3 | Scaler MX-0404-SCL In 1-3, lalu Out 1-3 ke transmitter HDBaseT x3, ke signage kiri/tengah/kanan | HDMI 1 m + CAT6 |
| Out 4 | Transmitter HDBaseT, ke receiver HDBaseT IFP (HDMI in1) | CAT6 |
| In & Out 1 (audio) | DSP In 2 / Out 3 | Kabel audio |

**Video & USB**

- [ ] Tarik CAT6 HDBaseT/extender dari wall, operator, dan table ke rak; tes tiap jalur dengan LAN tester
- [ ] PC operator: HDMI 2 m x2 ke transmitter extender x2, HDMI 2 m ke wallplate, HDMI 10 m + USB 10 m ke monitor 27"
- [ ] Meja: tabletop kiri & kanan ke switcher Aten 4x1 (HDMI), switcher + tabletop tengah ke transmitter extender x3 (HDMI)
- [ ] Kamera USB ke receiver HDBaseT signage tengah, lalu lewat HDBaseT ke matrix Usb1

**Audio (TAP IN / TAP OUT DSP Tricolor)**

| Kanal DSP | TAP IN (sumber) | TAP OUT (tujuan) |
| --- | --- | --- |
| 1 | Receiver chairman-delegate (XLR female: 1 Gnd, 2 Red, 3 White) | Amplifier 1 (XLR cabang female ke 2 input) |
| 2 | Matrix audio out (Gnd, Red & White) | Amplifier 2 (XLR cabang female ke 2 input) |
| 3 | Receiver clip-on (AKAI male: 1 Red, 2 Ground) | Matrix audio in |
| 4 | Soundcard out | Soundcard in |

- [ ] Solder/terminasi XLR, AKAI, dan phoenix sesuai pin di atas; cek polaritas dengan multimeter
- [ ] Amplifier ke speaker lewat Speakon (1+ / 1-); 4 speaker per sisi, cek impedansi total sesuai rating amplifier
- [ ] Soundcard ke PC operator (USB) dan ke DSP kanal 4 (XLR cabang / AKAI)

**Kontrol & jaringan**

- [ ] RS232: IFP ke Cue Serial 2, switcher Aten 4x1 meja ke Cue Versatile port 2 & 3 (F dan G di diagram), receiver chairman ke Cue Serial 1
- [ ] Sensor okupansi ke Cue Versatile 1 (+ LAN ke switch)
- [ ] Cue Relay ke roll banner (daya motor)
- [ ] Lutron interface ke DALI ke keypad & lampu; Lutron ke switch
- [ ] LAN ke switch: 3 signage, kamera, WPS, receiver chairman, DSP, matrix, scaler, Cue, Lutron, router
- [ ] Router dualband ke switch (uplink), Wi-Fi untuk tablet controller

## 6. Konfigurasi jaringan & IP

- [ ] Laptop teknisi: set IP statis 192.168.1.250/24 di adaptor LAN (pakai AV Network Tool, tombol Set IP Static)
- [ ] Router: set LAN 192.168.1.1/24, DHCP pool di luar rentang perangkat AV (mis. .150-.240), SSID + sandi untuk tablet
- [ ] Switch: aktifkan semua port yang dipakai; catat port switch per perangkat
- [ ] Set IP statis tiap perangkat sesuai tabel bagian 1 (.88 s/d .97 dan .127), gateway 192.168.1.1
- [ ] Pastikan tidak ada IP ganda (ping tiap IP sebelum dan sesudah set)
- [ ] AV Network Tool: klik Cek Perangkat, hasil 11/11 online
- [ ] Buka web UI tiap perangkat dari kartu di AV Network Tool; ganti sandi bawaan admin
- [ ] Tablet controller pimpinan & operator terhubung Wi-Fi router dan bisa menjangkau Cue (.127)

## 7. Konfigurasi per perangkat

**DSP Tricolor TAP (.88)**

- [ ] Update firmware, beri nama kanal sesuai tabel TAP IN / TAP OUT
- [ ] Naikkan gain input mic (kanal 1 chairman-delegate & kanal 3 clip-on): catatan diagram "MIC di DSP gain wajib naik"
- [ ] Atur routing: mic + matrix + soundcard ke Out 1-2 (amplifier); mic ke Out 3 (matrix) dan Out 4 (soundcard) untuk rapat online
- [ ] Aktifkan AEC, noise suppression, feedback suppressor; EQ speaker plafon
- [ ] Aktifkan USB audio ke matrix Usb2; simpan preset

**Matrix MX-1007-HYB (.93) & Scaler MX-0404-SCL (.91)**

- [ ] Beri nama input/output sesuai peta port bagian 5
- [ ] Set EDID sesuai resolusi signage & IFP; set resolusi output scaler per display
- [ ] Set routing USB: kamera (Usb1) dan audio DSP (Usb2) ke USB Host 2 (PC operator)
- [ ] Set de-embed audio matrix ke DSP kanal 2

**Switcher Aten 4x1 (meja)**

- [ ] Set RS232 switcher Aten (baudrate, protokol) sama dengan Cue Versatile port 2 & 3
- [ ] Daftarkan perintah ganti input di Cue; uji ketujuh input tabletop satu per satu

**Display Philips kiri/tengah/kanan (.94-.96) & IFP (.97)**

- [ ] Set IP, input default HDMI 1, nyalakan kontrol LAN/RS232, power-on via LAN
- [ ] IFP: RS232 ke Cue aktif, baudrate sama dengan Cue Serial 2

**Kamera Aver (.90)**

- [ ] Set IP, preset posisi (pimpinan, seluruh meja, presenter), terbaca sebagai kamera USB di PC operator

**WPS SW-640-TX (.92)**

- [ ] Set IP, nama ruangan, pairing dongle wireless, cek Miracast dari laptop

**Lutron + DALI (.89)**

- [ ] Alamatkan ballast/driver DALI, buat scene (presentasi, rapat, video call, mati), program keypad

**Cue Versatile + Relay (.127)**

- [x] Daftarkan driver: IFP & receiver chairman (serial), switcher Aten meja (Versatile port 2 & 3, RS232), sensor okupansi (Versatile 1), relay roll banner
- [x] Daftarkan perangkat IP: DSP, matrix, scaler, signage, kamera, Lutron
- [x] Buat GUI tablet pimpinan & operator: nyala/mati ruangan, pilih sumber, volume, preset kamera, scene lampu, roll banner
- [x] Buat makro: ruangan ON, ruangan OFF, auto-OFF saat sensor tidak mendeteksi orang

**Sensor okupansi plafon**

- [x] Set DIP switch A (sensitivitas) dan B (waktu tunda) sesuai luas ruangan; uji LED merah saat ada gerakan

**Mic & receiver**

- [x] Set kanal frekuensi receiver chairman-delegate & clip-on agar tidak bentrok; pairing semua mic; set prioritas chairman

**PC operator & soundcard**

- [x] Set perangkat audio & kamera default di Zoom/Teams; tampilan extend ke monitor 27" pimpinan + output ke matrix

## 8. Pengujian & commissioning

**Video**

- [ ] Tiap sumber (IFP, PC operator x2, wallplate, WPS, 7 input tabletop) tampil di 3 signage dan IFP tanpa flicker/no signal
- [ ] Switcher Aten meja berpindah input lewat tablet (RS232 via Cue Versatile port 2 & 3)
- [ ] Monitor 27" pimpinan tampil + layar sentuh berfungsi

**Audio**

- [ ] Tiap mic (chairman, delegate, clip-on) terdengar jernih di 8 speaker, tanpa feedback pada volume rapat
- [ ] Audio laptop/PC terdengar di speaker
- [ ] Rapat online: peserta jarak jauh mendengar mic ruangan tanpa echo, suara jarak jauh keluar di speaker

**Kamera & USB**

- [ ] Kamera terbaca di PC operator, preset kamera dipanggil dari tablet

**Kontrol & otomasi**

- [ ] Makro ruangan ON / OFF dari tablet pimpinan dan operator
- [ ] Scene lampu dari tablet dan keypad
- [ ] Roll banner naik/turun lewat relay
- [ ] Sensor okupansi: ruangan kosong memicu auto-OFF sesuai waktu tunda
- [ ] Display menyala/mati dan pindah input dari tablet

**Jaringan & daya**

- [ ] AV Network Tool: 11/11 online, aktifkan auto refresh 15 detik selama burn-in
- [ ] Cabut daya PLN: rak tetap hidup lewat UPS, perangkat kembali normal setelah daya pulih
- [ ] Burn-in minimal 1 hari kerja tanpa perangkat offline

## 9. Dokumentasi & serah terima

- [ ] Foto rak depan & belakang, tiap zona, dan label kabel
- [ ] Update wiring diagram menjadi as-built (rev. 1) bila ada perubahan di lapangan
- [ ] Backup konfigurasi: preset DSP, matrix, scaler, program Cue, Lutron, kamera
- [ ] Serahkan daftar IP, sandi admin, dan file backup ke pemilik (lewat jalur aman, bukan chat)
- [ ] Pelatihan singkat pengguna: tablet pimpinan, tablet operator, mic, WPS
- [ ] Berita acara serah terima ditandatangani (Drawn by / Checked by / Approved by)
