# Checklist AV - Smart Meeting Room BPKP

## 1. Persiapan

- [ ] Wiring diagram & layout rak dicetak
- [ ] Semua perangkat lengkap sesuai daftar
- [ ] Kabel & konektor lengkap
- [ ] Jalur kabel siap (wall, meja, operator ke rak)
- [ ] Listrik rak siap, lewat 2 UPS
- [ ] Alat kerja & laptop teknisi siap
- [ ] Firmware & software perangkat siap

## 2. Instalasi Rak

Urutan atas ke bawah: Router, Switch, Extender, Scaler + Cue, Matrix, DSP, Receiver mic, Amplifier, UPS.

- [ ] Rak berdiri kokoh, roda terkunci
- [ ] Semua perangkat terpasang sesuai urutan
- [ ] UPS & amplifier pakai rail penahan
- [ ] Ventilasi cukup
- [ ] Kabel daya & sinyal dipisah, rapi

## 3. Instalasi Ruangan

**Dinding**

- [ ] IFP terpasang
- [ ] 3 signage terpasang sejajar
- [ ] Kamera terpasang menghadap meja
- [ ] 8 speaker plafon terpasang
- [ ] Sensor okupansi terpasang
- [ ] Keypad lampu terpasang
- [ ] Roll banner terpasang

**Meja Operator**

- [ ] PC operator, soundcard & WPS terpasang
- [ ] Wallplate & extender terpasang
- [ ] Tablet controller operator siap

**Meja Meeting**

- [ ] 5 tabletop box & 2 switcher Aten terpasang
- [ ] Monitor sentuh 27" pimpinan terpasang
- [ ] Mic chairman & delegate siap
- [ ] Tablet controller pimpinan siap

## 4. Kabel

- [ ] Semua kabel ditarik & dilabel di kedua ujung
- [ ] Semua jalur LAN / HDBaseT dites
- [ ] Video: sumber ke matrix, scaler, display
- [ ] Audio: mic & sumber ke DSP, amplifier, speaker
- [ ] Kontrol: IFP, switcher Aten, receiver mic ke Cue (RS232)
- [ ] Semua perangkat IP masuk switch

## 5. Konfigurasi

| Perangkat | IP |
| --- | --- |
| DSP | .88 |
| Lampu (Lutron) | .89 |
| Kamera | .90 |
| Scaler | .91 |
| WPS | .92 |
| Matrix | .93 |
| Display Kiri / Tengah / Kanan | .94 / .95 / .96 |
| IFP | .97 |
| Cue | .127 |

Jaringan 192.168.1.x, gateway .1, laptop teknisi .250.

- [ ] IP semua perangkat sesuai tabel, 11/11 online
- [ ] DSP: routing, gain mic, AEC
- [ ] Matrix & scaler: routing & resolusi
- [ ] Display & IFP: input & kontrol aktif
- [ ] Kamera: preset posisi
- [ ] WPS: pairing dongle
- [ ] Lampu: scene & keypad
- [ ] Cue: driver, tampilan tablet, ON/OFF ruangan
- [ ] Sensor okupansi: auto-OFF saat kosong
- [ ] Mic: kanal frekuensi & pairing
- [ ] PC: audio & kamera di Zoom / Teams

## 6. Uji Coba

- [ ] Semua sumber tampil di display
- [ ] Semua mic jernih, tanpa feedback
- [ ] Rapat online tanpa echo
- [ ] Tablet: ON/OFF, pindah sumber, volume, lampu, kamera, roll banner
- [ ] Listrik dicabut, rak tetap hidup lewat UPS

## 7. Serah Terima

- [ ] Training penggunaan ke user
