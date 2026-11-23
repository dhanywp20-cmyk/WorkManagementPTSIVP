'use client';

import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { IkonTeks } from '@/components/shared/Ikon';

export const TEMPLATE_PENANGANAN = [
  'Kondisi Awal : ',
  'Tindakan     : ',
  'Hasil        : ',
  'Rekomendasi  : ',
].join('\n');

const TINGGI_MAKS = 288;

export function sisipkanTemplate(isi: string): string {
  return isi.trim() ? `${isi.replace(/\s+$/, '')}\n\n${TEMPLATE_PENANGANAN}` : TEMPLATE_PENANGANAN;
}

export interface IsianPanjangProps {
  id: string;
  value: string;
  onChange: (nilai: string) => void;
  placeholder?: string;
  baris?: number;
  template?: boolean;
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
    onChange(sisipkanTemplate(value));
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      const akhir = el.value.indexOf(': ', Math.max(0, el.value.length - TEMPLATE_PENANGANAN.length)) + 2;
      el.setSelectionRange(akhir, akhir);
    });
  };

  return (
    <div>
      <textarea ref={ref} id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={baris}
        className={`${className ?? ''} resize-none leading-relaxed`} style={style} />
      <div className="flex items-center justify-between gap-2 mt-1">
        {template
          ? (
            <button type="button" onClick={pakaiTemplate}
              className="text-[10px] font-bold text-blue-700 hover:text-blue-800 hover:underline">
              <IkonTeks nama="📋" />Sisipkan template
            </button>
          )
          : <span />}
        <span className="text-[10px] text-gray-500 tabular-nums">{value.length} karakter</span>
      </div>
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
          <p className={`px-2.5 py-1.5 ${ukuran} text-gray-800 whitespace-pre-wrap break-words leading-relaxed`}>{action}</p>
        </div>
      )}
      {notes?.trim() && (
        <div className="rounded-lg overflow-hidden border border-gray-200 bg-white">
          <p className="px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase text-gray-600 bg-gray-50 border-b border-gray-200">
            <IkonTeks nama="📝" />Notes
          </p>
          <p className={`px-2.5 py-1.5 ${ukuran} text-gray-800 whitespace-pre-wrap break-words leading-relaxed`}>{notes}</p>
        </div>
      )}
    </div>
  );
}
