'use client';

/**
 * KonstelasiTim.tsx - "Konstelasi Tim": anggota Team Product sebagai graf 3D yang berputar perlahan,
 * dikelompokkan per tim (team_type). Seret untuk memutar, arahkan ke titik untuk melihat nama,
 * pilih chip untuk menyorot satu tim. Permintaan pemilik: beranda bergaya "3D dashboard".
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
import type { WidgetProps } from './primitives';

interface Anggota { full_name: string | null; team_type: string | null }
interface Titik { x: number; y: number; z: number }
interface Simpul extends Titik { nama: string; tim: number }
interface Gugus { nama: string; warna: string; pusat: Titik; anggota: Simpul[] }

const WARNA = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb7185', '#22d3ee'];
const KAM = 3.4;

/** Angka semu tetap dari teks - posisi tiap orang sama di setiap kunjungan. */
function acakDari(teks: string, garam: number): number {
  let h = 2166136261 ^ garam;
  for (let i = 0; i < teks.length; i++) { h ^= teks.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

const inisial = (nama: string) => nama.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]!.toUpperCase()).join('');
const namaTim = (t: string | null) => (t ?? '').replace(/^Team\s+/i, '').trim() || 'Lainnya';

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
    const pusat = { x: Math.cos(sudut) * 1.05, y: (i % 2 ? 0.2 : -0.2), z: Math.sin(sudut) * 1.05 };
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
    const bintang: Titik[] = Array.from({ length: 110 }, (_, i) => {
      const t = acakDari(`b${i}`, 7) * Math.PI * 2, p = Math.acos(2 * acakDari(`b${i}`, 8) - 1), r = 3.2 + acakDari(`b${i}`, 9) * 1.5;
      return { x: r * Math.sin(p) * Math.cos(t), y: r * Math.cos(p) * 0.6, z: r * Math.sin(p) * Math.sin(t) };
    });
    let w = 0, h = 0, dpr = 1;
    const ukur = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = el.clientWidth; h = el.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      cv.style.width = `${w}px`; cv.style.height = `${h}px`;
    };
    ukur();
    const ro = new ResizeObserver(ukur); ro.observe(el);

    let ay = 0.6, ax = -0.2, vy = geraKurang ? 0 : 0.0022, tarik: { x: number; y: number } | null = null;
    let tampak: { s: Simpul; px: number; py: number; r: number }[] = [];
    const proyek = (t: Titik) => {
      const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
      const x1 = t.x * cy + t.z * sy, z1 = -t.x * sy + t.z * cy;
      const y2 = t.y * cx - z1 * sx, z2 = t.y * sx + z1 * cx;
      const F = Math.min(w * 0.9, h * 1.7) * 0.82, k = F / (z2 + KAM);
      return { px: w / 2 + x1 * k, py: h * 0.54 + y2 * k, z: z2, k: k / F * KAM };
    };

    const gambar = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      for (const b of bintang) {
        const p = proyek(b);
        ctx.fillStyle = `rgba(191,219,254,${Math.max(0.08, 0.5 - (p.z + 3) * 0.08)})`;
        ctx.fillRect(p.px, p.py, 1.3, 1.3);
      }
      const pusat = proyek({ x: 0, y: 0, z: 0 });
      const sel = pilihRef.current;
      // Garis: pusat -> tim, tim -> anggota.
      ctx.lineWidth = 1;
      for (const [i, g] of gugus.entries()) {
        const redup = sel !== null && sel !== i;
        const hp = proyek(g.pusat);
        ctx.strokeStyle = redup ? 'rgba(148,163,184,.08)' : 'rgba(191,219,254,.35)';
        ctx.beginPath(); ctx.moveTo(pusat.px, pusat.py); ctx.lineTo(hp.px, hp.py); ctx.stroke();
        ctx.strokeStyle = redup ? 'rgba(148,163,184,.05)' : `${g.warna}40`;
        for (const a of g.anggota) { const ap = proyek(a); ctx.beginPath(); ctx.moveTo(hp.px, hp.py); ctx.lineTo(ap.px, ap.py); ctx.stroke(); }
      }
      // Simpul diurutkan dari yang terjauh.
      const daftar = gugus.flatMap(g => g.anggota).map(s => ({ s, ...proyek(s) })).sort((a, b) => b.z - a.z);
      tampak = [];
      for (const d of daftar) {
        const g = gugus[d.s.tim], redup = sel !== null && sel !== d.s.tim;
        const r = Math.max(6, 12.5 * d.k);
        ctx.globalAlpha = redup ? 0.18 : Math.min(1, 0.55 + d.k * 0.45);
        ctx.shadowColor = g.warna; ctx.shadowBlur = redup ? 0 : 14;
        const gr = ctx.createRadialGradient(d.px - r * 0.35, d.py - r * 0.35, r * 0.1, d.px, d.py, r);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, g.warna); gr.addColorStop(1, '#1e293b');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(d.px, d.py, r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        if (r >= 9) {
          ctx.fillStyle = '#0b1220'; ctx.font = `700 ${Math.round(r * 0.72)}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(inisial(d.s.nama), d.px, d.py + 0.5);
        }
        ctx.globalAlpha = 1;
        if (!redup) tampak.push({ s: d.s, px: d.px, py: d.py, r });
      }
      // Label tim.
      for (const [i, g] of gugus.entries()) {
        if (sel !== null && sel !== i) continue;
        const hp = proyek(g.pusat);
        const teks = `${g.nama} · ${g.anggota.length}`;
        ctx.font = '700 11px Inter, system-ui, sans-serif';
        const lb = ctx.measureText(teks).width + 22, ly = hp.py - 46 * hp.k - 10;
        ctx.fillStyle = 'rgba(15,23,42,.78)'; ctx.strokeStyle = 'rgba(255,255,255,.18)';
        ctx.beginPath(); ctx.roundRect(hp.px - lb / 2, ly - 10, lb, 20, 10); ctx.fill(); ctx.stroke();
        ctx.fillStyle = g.warna; ctx.beginPath(); ctx.arc(hp.px - lb / 2 + 9, ly, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(teks, hp.px - lb / 2 + 16, ly + 0.5);
      }
      // Pusat: platform.
      const rp = 15 * pusat.k + 6;
      ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 24;
      const gp = ctx.createRadialGradient(pusat.px - 4, pusat.py - 4, 2, pusat.px, pusat.py, rp);
      gp.addColorStop(0, '#fffbeb'); gp.addColorStop(1, '#f59e0b');
      ctx.fillStyle = gp; ctx.beginPath(); ctx.arc(pusat.px, pusat.py, rp, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    };

    let raf = 0, jalan = false;
    const putar = () => {
      if (!tarik) { ay += vy; if (!geraKurang) vy += (0.0022 - vy) * 0.02; }
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
        ay += dx * 0.008; ax = Math.max(-1, Math.min(0.6, ax + dy * 0.006)); vy = dx * 0.0015; tarik = p;
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

  return (
    <section className="konstelasi-3d relative overflow-hidden rounded-2xl text-white">
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-3 p-4 md:p-5 pb-0 md:pb-0">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-sky-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" /> Graf tim 3D
          </p>
          <h3 className="text-lg md:text-xl font-bold tracking-tight mt-1">Konstelasi Tim</h3>
          <p className="text-[12px] text-slate-300/80 mt-0.5">
            {data === null ? 'Memuat…' : `${total} anggota · ${gugus.length} tim · seret untuk memutar, arahkan ke titik untuk melihat nama`}
          </p>
        </div>
        {gugus.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sorot tim">
            <button type="button" onClick={() => setPilih(null)} aria-pressed={pilih === null}
              className={`konstelasi-chip ${pilih === null ? 'aktif' : ''}`}>Semua <span>{total}</span></button>
            {gugus.map((g, i) => (
              <button key={g.nama} type="button" onClick={() => setPilih(p => (p === i ? null : i))} aria-pressed={pilih === i}
                className={`konstelasi-chip ${pilih === i ? 'aktif' : ''}`}>
                <i style={{ background: g.warna }} />{g.nama} <span>{g.anggota.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div ref={bungkus} className="relative h-[300px] md:h-[380px]">
        {data !== null && total === 0 && (
          <p className="absolute inset-0 grid place-items-center text-sm text-slate-300/80">Belum ada anggota tim.</p>
        )}
        <canvas ref={kanvas} className="absolute inset-0 touch-none" style={{ cursor: 'grab' }}
          role="img" aria-label={`Graf 3D ${total} anggota tim dalam ${gugus.length} tim: ${gugus.map(g => `${g.nama} ${g.anggota.length}`).join(', ')}`} />
        {tip && (
          <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-semibold"
            style={{ left: tip.x, top: tip.y, background: 'rgba(15,23,42,.92)', border: `1px solid ${tip.warna}66`, boxShadow: `0 8px 24px -6px ${tip.warna}55` }}>
            {tip.nama} <span className="font-normal text-slate-400">· {tip.tim}</span>
          </div>
        )}
      </div>
    </section>
  );
}
