'use client';
import React, { useEffect, useState } from 'react';
import type { RingkasAgenda } from '../workcenter/PanelAgenda';

export interface MenuCepat { key: string; title: string; keterangan?: string; ikon: React.ReactNode }

const PRIORITAS = [
  'ticket-troubleshooting', 'reminder-schedule', 'daily-report', 'project-progress', 'tools-team',
  'unit-movement', 'incentive-pts', 'summary-project', 'picket-showroom', 'request-design-project',
  'form-bast', 'kpi-team', 'tech-note', 'learning-center',
];
const MAKS_AKSES = 6;

function salamWaktu(jam: number) {
  if (jam < 11) return 'Selamat pagi';
  if (jam < 15) return 'Selamat siang';
  if (jam < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export function HeroKaca({ namaDepan, tanggal, ringkas, menuCepat, openMenu, alert }: {
  namaDepan: string;
  tanggal: string;
  ringkas: RingkasAgenda | null;
  menuCepat: MenuCepat[];
  openMenu: (key: string) => void;
  alert: number | null;
}) {
  const [salam, setSalam] = useState('Halo');
  useEffect(() => {
    const segarkan = () => setSalam(salamWaktu(new Date().getHours()));
    segarkan();
    const t = window.setInterval(segarkan, 60_000);
    return () => window.clearInterval(t);
  }, []);

  const urutan = (k: string) => { const i = PRIORITAS.indexOf(k); return i < 0 ? PRIORITAS.length : i; };
  const akses = [...menuCepat].sort((a, b) => urutan(a.key) - urutan(b.key)).slice(0, MAKS_AKSES);

  const chip: { teks: string; nada: 'netral' | 'aksen' | 'kritis' | 'peringatan'; ikon: React.ReactNode }[] = [];
  if (ringkas) {
    chip.push({ teks: ringkas.aksi ? `${ringkas.aksi} perlu tindakan` : 'Tidak ada yang mendesak', nada: ringkas.aksi ? 'kritis' : 'aksen', ikon: <IkonTitik /> });
    chip.push({ teks: `${ringkas.hari} agenda hari ini`, nada: 'netral', ikon: <IkonKalender /> });
    if (ringkas.nanti > 0) chip.push({ teks: `${ringkas.nanti} agenda mendatang`, nada: 'netral', ikon: <IkonJam /> });
  }
  if (alert !== null) chip.push({ teks: alert ? `${alert} alert Command Center` : 'Command Center aman', nada: alert ? 'peringatan' : 'netral', ikon: <IkonPerisai /> });
  chip.push({ teks: `${menuCepat.length} modul aktif`, nada: 'netral', ikon: <IkonKisi /> });

  const kalimat = ringkas
    ? ringkas.aksi
      ? `Ada ${ringkas.aksi} hal yang menunggu tindakan Anda${ringkas.hari ? `, dan ${ringkas.hari} agenda terjadwal hari ini` : ''}.`
      : `Tidak ada yang mendesak${ringkas.hari ? ` — ${ringkas.hari} agenda terjadwal hari ini` : ''}.`
    : null;

  return (
    <section className="pk-hero bb-naik" aria-label="Ringkasan hari ini">
      <div className="pk-hero-utama">
        <p className="pk-hero-konteks">PTS IVP · {tanggal}</p>
        <h2 className="pk-hero-salam" suppressHydrationWarning>{salam}{namaDepan ? `, ${namaDepan}` : ''}</h2>
        <ul className="pk-chip-baris">
          {chip.map(c => (
            <li key={c.teks} className={`pk-chip pk-chip-${c.nada}`}>{c.ikon}<span>{c.teks}</span></li>
          ))}
        </ul>
        {kalimat && <p className="pk-hero-ringkas">{kalimat}</p>}
      </div>

      {akses.length > 0 && (
        <div className="pk-hero-akses">
          <p className="pk-label-kecil">Modul Anda</p>
          <div className="pk-akses-kisi">
            {akses.map((m, i) => (
              <button key={m.key} type="button" className="pk-akses" onClick={() => openMenu(m.key)}
                style={{ ['--d' as string]: i + 1 } as React.CSSProperties}>
                <span className="pk-akses-ikon" aria-hidden="true">{m.ikon}</span>
                <span className="min-w-0">
                  <b>{m.title}</b>
                  {m.keterangan && <small>{m.keterangan}</small>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

const svg = (d: React.ReactNode) => (
  <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">{d}</svg>
);
const IkonTitik = () => svg(<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />);
const IkonKalender = () => svg(<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />);
const IkonJam = () => svg(<><circle cx="12" cy="12" r="9" strokeWidth={2} /><path strokeLinecap="round" strokeWidth={2} d="M12 7v5l3 2" /></>);
const IkonPerisai = () => svg(<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />);
const IkonKisi = () => svg(<>
  <rect x="4" y="4" width="7" height="7" rx="1.5" strokeWidth={2} /><rect x="13" y="4" width="7" height="7" rx="1.5" strokeWidth={2} />
  <rect x="4" y="13" width="7" height="7" rx="1.5" strokeWidth={2} /><rect x="13" y="13" width="7" height="7" rx="1.5" strokeWidth={2} />
</>);
