'use client';

import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { IkonTeks } from '@/components/shared/Ikon';
import { uraikanPenanganan } from './format-penanganan';

const TINGGI_MAKS = 288;

export function sisipkanTemplate(isi: string, template: string): string {
  return isi.trim() ? `${isi.replace(/\s+$/, '')}\n\n${template}` : template;
}

export interface IsianPanjangProps {
  id: string;
  value: string;
  onChange: (nilai: string) => void;
  placeholder?: string;
  baris?: number;
  template?: string;
  className?: string;
  style?: CSSProperties;
}

export function IsianPanjang({ id, value, onChange, placeholder, baris = 4, template, className, style }: IsianPanjangProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, TINGGI_MAKS)}px`;
    el.style.overflowY = el.scrollHeight + 2 > TINGGI_MAKS ? 'auto' : 'hidden';
  }, [value]);

  const pakaiTemplate = () => {
    if (!template) return;
    const hasil = sisipkanTemplate(value, template);
    onChange(hasil);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      const awal = hasil.indexOf('[', hasil.length - template.length);
      const akhir = awal >= 0 ? hasil.indexOf(']', awal) + 1 : 0;
      if (awal >= 0 && akhir > awal) el.setSelectionRange(awal, akhir);
      else el.setSelectionRange(hasil.length, hasil.length);
    });
  };

  return (
    <div>
      <textarea ref={ref} id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={baris}
        className={`${className ?? ''} resize-none leading-relaxed`} style={style} />
      <div className="flex items-center justify-between gap-2 mt-1">
        {template
          ? (
            <button type="button" onClick={pakaiTemplate} title="Isi contoh kalimat; ganti bagian [ ... ] sesuai kondisi di lapangan"
              className="text-[10px] font-bold text-blue-700 hover:text-blue-800 hover:underline">
              <IkonTeks nama="📋" />Pakai template
            </button>
          )
          : <span />}
        <span className="text-[10px] text-gray-500 tabular-nums">{value.length} karakter</span>
      </div>
    </div>
  );
}

function IsiPenanganan({ teks, ukuran }: { teks: string; ukuran: string }) {
  return (
    <div className={`px-2.5 py-1.5 ${ukuran} text-gray-800 break-words leading-relaxed space-y-0.5`}>
      {uraikanPenanganan(teks).map((b, i) => {
        if (b.jenis === 'judul') return <p key={i} className={`text-[10px] font-bold tracking-wider text-blue-700 ${i ? 'pt-1.5' : ''}`}>{b.isi}</p>;
        if (b.jenis === 'poin') return <ul key={i} className="list-disc pl-4 space-y-0.5">{b.butir.map((x, j) => <li key={j}>{x}</li>)}</ul>;
        if (b.jenis === 'nomor') return <ol key={i} className="list-decimal pl-4 space-y-0.5">{b.butir.map((x, j) => <li key={j}>{x}</li>)}</ol>;
        return <p key={i} className="whitespace-pre-wrap">{b.isi}</p>;
      })}
    </div>
  );
}

export function BlokPenanganan({ action, notes, kecil }: { action?: string | null; notes?: string | null; kecil?: boolean }) {
  const ukuran = kecil ? 'text-[11px]' : 'text-xs';
  if (!action?.trim() && !notes?.trim()) return null;
  return (
    <div className="mt-1.5 space-y-1.5">
      {action?.trim() && (
        <div className="rounded-lg overflow-hidden border border-blue-200 bg-white">
          <p className="px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase text-blue-700 bg-blue-50 border-b border-blue-200">
            <IkonTeks nama="🔧" />Action Taken
          </p>
          <IsiPenanganan teks={action} ukuran={ukuran} />
        </div>
      )}
      {notes?.trim() && (
        <div className="rounded-lg overflow-hidden border border-gray-200 bg-white">
          <p className="px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase text-gray-600 bg-gray-50 border-b border-gray-200">
            <IkonTeks nama="📝" />Notes
          </p>
          <IsiPenanganan teks={notes} ukuran={ukuran} />
        </div>
      )}
    </div>
  );
}
