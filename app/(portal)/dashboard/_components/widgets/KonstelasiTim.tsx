'use client';

/**
 * KonstelasiTim.tsx - "Konstelasi Tim": anggota Team Product sebagai graf 3D yang berputar perlahan,
 * dikelompokkan per tim (team_type). Seret untuk memutar, arahkan ke titik untuk melihat nama,
 * pilih chip untuk menyorot satu tim. Permintaan pemilik: beranda bergaya "3D dashboard".
 *
 * Bahasa visual mengikuti ubin beranda yang TERANG (pemilik: bukan mode gelap): permukaan putih
 * timbul yang sama, kedalaman dibawa cincin orbit tipis, bayangan lembut di bawah tiap titik, dan
 * titik yang jauh mengecil & memudar ke putih - bukan ruang angkasa gelap bercahaya neon. Pusat
 * memakai warna merek (--merek-utama), tim memakai palet kalem.
 *
 * - Data: kueri & kunci cache YANG SAMA dengan lonceng notifikasi (users role team, nama + tim,
 *   cache 5 menit, lib/cache-singkat) - tidak menambah permintaan ke Supabase selama cache berlaku.
 * - Gambar: canvas 2D dengan proyeksi perspektif sederhana (putar sumbu Y lalu X, k = F / (z + KAM)),
 *   digambar dari yang terjauh. Tanpa pustaka 3D - ringan untuk HP.
 * - Hemat: animasi berhenti saat kartu tidak terlihat / tab disembunyikan; tanpa putar otomatis
 *   bila perangkat meminta gerak dikurangi.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ingat } from '@/lib/cache-singkat';
import { Keterangan } from '@/components/shared';
import { UBIN, LABEL_UBIN, type WidgetProps } from './primitives';

interface Anggota { full_name: string | null; team_type: string | null }
interface Titik { x: number; y: number; z: number }
interface Simpul extends Titik { nama: string; tim: number }
interface Gugus { nama: string; warna: string; pusat: Titik; anggota: Simpul[] }

/** Palet tim kalem (bukan neon) - senada grafik lain di platform. */
const WARNA = ['#2563eb', '#0d9488', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#64748b'];
const KAM = 3.4;
const ORBIT = 1.05;

/** Angka semu tetap dari teks - posisi tiap orang sama di setiap kunjungan. */
function acakDari(teks: string, garam: number): number {
  let h = 2166136261 ^ garam;
  for (let i = 0; i < teks.length; i++) { h ^= teks.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

const inisial = (nama: string) => nama.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]!.toUpperCase()).join('');
const namaTim = (t: string | null) => (t ?? '').replace(/^Team\s+/i, '').trim() || 'Lainnya';

/** Campur warna hex ke putih (0 = warna asli, 1 = putih) - kabut kedalaman pada latar terang. */
function kePutih(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16), c = (v: number) => Math.round(v + (255 - v) * t);
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

export function susunGugus(data: Anggota[]): Gugus[] {
  const per = new Map<string, string[]>();
  for (const a of data) {
    const nama = (a.full_name ?? '').trim();
    if (!nama) continue;
    const t = namaTim(a.team_type);
    per.set(t, [...(per.get(t) ?? []), nama]);
  }
  const tim = [...per.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'id'));
  return tim.map(([nama, orang], i) => {
    const sudut = (i / Math.max(1, tim.length)) * Math.PI * 2;
    const pusat = { x: Math.cos(sudut) * ORBIT, y: (i % 2 ? 0.2 : -0.2), z: Math.sin(sudut) * ORBIT };
    const anggota = orang.sort((a, b) => a.localeCompare(b, 'id')).map(n => {
      const r = 0.22 + acakDari(n, 1) * 0.3, t = acakDari(n, 2) * Math.PI * 2, p = (acakDari(n, 3) - 0.5) * Math.PI;
      return { nama: n, tim: i, x: pusat.x + r * Math.cos(p) * Math.cos(t), y: pusat.y + r * Math.sin(p), z: pusat.z + r * Math.cos(p) * Math.sin(t) };
    });
    return { nama, warna: WARNA[i % WARNA.length], pusat, anggota };
  });
}

export default function KonstelasiTim(_props: WidgetProps) {
  const [data, setData] = useState<Anggota[] | null>(null);
  const [pilih, setPilih] = useState<number | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; nama: string; tim: string; warna: string } | null>(null);
  const kanvas = useRef<HTMLCanvasElement | null>(null);
  const bungkus = useRef<HTMLDivElement | null>(null);
  const pilihRef = useRef<number | null>(null);
  //  Tim yang disorot dibaca putaran gambar lewat ref - mengganti pilihan tidak menyusun ulang adegan.
  useEffect(() => { pilihRef.current = pilih; }, [pilih]);

  useEffect(() => {
    let batal = false;
    ingat('users:team-kelompok', () => supabase.from('users').select('full_name, team_type').eq('role', 'team'))
      .then(({ data: d }) => { if (!batal) setData((d ?? []) as Anggota[]); })
      .catch(() => { if (!batal) setData([]); });
    return () => { batal = true; };
  }, []);

  const gugus = useMemo(() => susunGugus(data ?? []), [data]);
  const total = gugus.reduce((n, g) => n + g.anggota.length, 0);

  useEffect(() => {
    const cv = kanvas.current, el = bungkus.current;
    if (!cv || !el || !gugus.length) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const geraKurang = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const merek = getComputedStyle(document.documentElement).getPropertyValue('--merek-utama').trim() || '#e11d48';
    const merekHex = /^#[0-9a-f]{6}$/i.test(merek) ? merek : '#e11d48';
    let w = 0, h = 0, dpr = 1;
    const ukur = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = el.clientWidth; h = el.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      cv.style.width = `${w}px`; cv.style.height = `${h}px`;
    };
    ukur();
    const ro = new ResizeObserver(ukur); ro.observe(el);

    let ay = 0.6, ax = -0.32, vy = geraKurang ? 0 : 0.002, tarik: { x: number; y: number } | null = null;
    let tampak: { s: Simpul; px: number; py: number; r: number }[] = [];
    const proyek = (t: Titik) => {
      const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
      const x1 = t.x * cy + t.z * sy, z1 = -t.x * sy + t.z * cy;
      const y2 = t.y * cx - z1 * sx, z2 = t.y * sx + z1 * cx;
      const F = Math.min(w * 0.85, h * 1.55) * 0.78, k = F / (z2 + KAM);
      return { px: w / 2 + x1 * k, py: h * 0.57 + y2 * k, z: z2, k: k / F * KAM };
    };
    /** Kedalaman 0 (dekat) .. 1 (jauh) - untuk kabut & ukuran. */
    const jauh = (z: number) => Math.max(0, Math.min(1, (z + 1.6) / 3.2));

    const cincin = (r: number, y: number, alfa: number) => {
      ctx.beginPath();
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2, p = proyek({ x: Math.cos(a) * r, y, z: Math.sin(a) * r });
        if (i) ctx.lineTo(p.px, p.py); else ctx.moveTo(p.px, p.py);
      }
      ctx.strokeStyle = `rgba(148,163,184,${alfa})`; ctx.stroke();
    };

    const pil = (x: number, y: number, teks: string, warna: string) => {
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      const lb = ctx.measureText(teks).width + 24;
      ctx.shadowColor = 'rgba(15,23,42,.10)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(x - lb / 2, y - 11, lb, 22, 11); ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = warna; ctx.beginPath(); ctx.arc(x - lb / 2 + 10, y, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#334155'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(teks, x - lb / 2 + 18, y + 0.5);
    };

    const bola = (px: number, py: number, r: number, warna: string, kabut: number) => {
      // Bayangan lembut di "lantai" - memberi kesan melayang tanpa cahaya neon.
      ctx.fillStyle = `rgba(15,23,42,${0.10 * (1 - kabut)})`;
      ctx.beginPath(); ctx.ellipse(px, py + r * 1.15, r * 0.9, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      const dasar = kePutih(warna, kabut * 0.75);
      const gr = ctx.createRadialGradient(px - r * 0.4, py - r * 0.45, r * 0.1, px, py, r);
      gr.addColorStop(0, kePutih(warna, 0.55 + kabut * 0.35)); gr.addColorStop(1, dasar);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    };

    const gambar = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      cincin(ORBIT, 0, 0.35);
      cincin(ORBIT * 0.55, 0, 0.22);
      const pusat = proyek({ x: 0, y: 0, z: 0 });
      const sel = pilihRef.current;
      // Garis: pusat -> tim, tim -> anggota (makin jauh makin tipis).
      for (const [i, g] of gugus.entries()) {
        const redup = sel !== null && sel !== i;
        const hp = proyek(g.pusat);
        ctx.strokeStyle = redup ? 'rgba(148,163,184,.12)' : `rgba(100,116,139,${0.45 - jauh(hp.z) * 0.25})`;
        ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(pusat.px, pusat.py); ctx.lineTo(hp.px, hp.py); ctx.stroke();
        ctx.setLineDash([]);
        for (const a of g.anggota) {
          const ap = proyek(a);
          ctx.strokeStyle = redup ? 'rgba(148,163,184,.08)' : kePutih(g.warna, 0.55 + jauh(ap.z) * 0.3);
          ctx.beginPath(); ctx.moveTo(hp.px, hp.py); ctx.lineTo(ap.px, ap.py); ctx.stroke();
        }
      }
      // Simpul diurutkan dari yang terjauh.
      const daftar = gugus.flatMap(g => g.anggota).map(s => ({ s, ...proyek(s) })).sort((a, b) => b.z - a.z);
      tampak = [];
      for (const d of daftar) {
        const g = gugus[d.s.tim], redup = sel !== null && sel !== d.s.tim;
        const kabut = redup ? 0.85 : jauh(d.z) * 0.6;
        const r = Math.max(7, 13 * d.k);
        bola(d.px, d.py, r, g.warna, kabut);
        if (r >= 9 && !redup) {
          ctx.fillStyle = '#ffffff'; ctx.font = `700 ${Math.round(r * 0.7)}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(inisial(d.s.nama), d.px, d.py + 0.5);
        }
        if (!redup) tampak.push({ s: d.s, px: d.px, py: d.py, r });
      }
      // Pusat: warna merek.
      const rp = 13 * pusat.k + 5;
      bola(pusat.px, pusat.py, rp, merekHex, 0);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(pusat.px, pusat.py, rp * 0.32, 0, Math.PI * 2); ctx.fill();
      // Label tim di atas segalanya, supaya tidak tertutup titik di depannya.
      for (const [i, g] of gugus.entries()) {
        if (sel !== null && sel !== i) continue;
        const hp = proyek(g.pusat);
        pil(hp.px, hp.py - 52 * hp.k - 6, `${g.nama} · ${g.anggota.length}`, g.warna);
      }
    };

    let raf = 0, jalan = false;
    const putar = () => {
      if (!tarik) { ay += vy; if (!geraKurang) vy += (0.002 - vy) * 0.02; }
      gambar();
      raf = requestAnimationFrame(putar);
    };
    const mulai = () => { if (!jalan && !document.hidden) { jalan = true; raf = requestAnimationFrame(putar); } };
    const henti = () => { jalan = false; cancelAnimationFrame(raf); };
    let terlihat = true;
    const io = new IntersectionObserver(([e]) => { terlihat = e.isIntersecting; if (terlihat) mulai(); else henti(); });
    io.observe(el);
    const saatTab = () => { if (document.hidden) henti(); else if (terlihat) mulai(); };
    document.addEventListener('visibilitychange', saatTab);
    mulai();

    const posisi = (e: PointerEvent) => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    const turun = (e: PointerEvent) => { tarik = posisi(e); cv.setPointerCapture(e.pointerId); setTip(null); };
    const gerak = (e: PointerEvent) => {
      const p = posisi(e);
      if (tarik) {
        const dx = p.x - tarik.x, dy = p.y - tarik.y;
        ay += dx * 0.008; ax = Math.max(-1, Math.min(0.4, ax + dy * 0.006)); vy = dx * 0.0015; tarik = p;
        return;
      }
      const kena = tampak.slice().reverse().find(t => (t.px - p.x) ** 2 + (t.py - p.y) ** 2 <= (t.r + 3) ** 2);
      setTip(kena ? { x: kena.px, y: kena.py - kena.r - 8, nama: kena.s.nama, tim: gugus[kena.s.tim].nama, warna: gugus[kena.s.tim].warna } : null);
      cv.style.cursor = kena ? 'pointer' : 'grab';
    };
    const naik = () => { tarik = null; };
    const keluar = () => setTip(null);
    cv.addEventListener('pointerdown', turun);
    cv.addEventListener('pointermove', gerak);
    cv.addEventListener('pointerup', naik);
    cv.addEventListener('pointercancel', naik);
    cv.addEventListener('pointerleave', keluar);
    return () => {
      henti(); ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', saatTab);
      cv.removeEventListener('pointerdown', turun); cv.removeEventListener('pointermove', gerak);
      cv.removeEventListener('pointerup', naik); cv.removeEventListener('pointercancel', naik);
      cv.removeEventListener('pointerleave', keluar);
    };
  }, [gugus]);

  const chip = (aktif: boolean) => `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold border transition-colors ${
    aktif ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`;

  return (
    <section className={`${UBIN} !p-0`}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h3 className={`${LABEL_UBIN} flex items-center gap-1.5`}>
            Konstelasi Tim
            <Keterangan>Graf 3D anggota tim per kelompok. Seret untuk memutar, arahkan ke titik untuk melihat nama, pilih tim untuk menyorot.</Keterangan>
          </h3>
          <p className="mt-1.5 text-[22px] leading-none font-bold tracking-tight text-slate-900 tabular-nums">
            {data === null ? '–' : total}<span className="ml-1.5 text-[13px] font-medium text-slate-500">anggota · {gugus.length} tim</span>
          </p>
        </div>
        {gugus.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sorot tim">
            <button type="button" onClick={() => setPilih(null)} aria-pressed={pilih === null} className={chip(pilih === null)}>
              Semua <span className="opacity-60 tabular-nums">{total}</span>
            </button>
            {gugus.map((g, i) => (
              <button key={g.nama} type="button" onClick={() => setPilih(p => (p === i ? null : i))} aria-pressed={pilih === i} className={chip(pilih === i)}>
                <i className="w-2 h-2 rounded-full" style={{ background: g.warna }} />{g.nama} <span className="opacity-60 tabular-nums">{g.anggota.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div ref={bungkus} className="konstelasi-lantai relative h-[300px] md:h-[380px]">
        {data !== null && total === 0 && (
          <p className="absolute inset-0 grid place-items-center text-sm text-slate-500">Belum ada anggota tim.</p>
        )}
        <canvas ref={kanvas} className="absolute inset-0 touch-none" style={{ cursor: 'grab' }}
          role="img" aria-label={`Graf 3D ${total} anggota tim dalam ${gugus.length} tim: ${gugus.map(g => `${g.nama} ${g.anggota.length}`).join(', ')}`} />
        {tip && (
          <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 text-[12px] font-semibold text-slate-800 shadow-lg shadow-slate-900/10"
            style={{ left: tip.x, top: tip.y }}>
            <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: tip.warna }} />
            {tip.nama} <span className="font-normal text-slate-500">· {tip.tim}</span>
          </div>
        )}
      </div>
    </section>
  );
}
