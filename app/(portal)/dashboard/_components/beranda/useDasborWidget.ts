'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DASBOR_BAWAAN, EVENT_DASBOR_WIDGET, KUNCI_DASBOR_WIDGET, rapikanDasbor, type PengaturanDasbor } from '@/lib/dasbor-widget';

let muat: Promise<PengaturanDasbor> | null = null;

export function muatDasborWidget(ulang = false): Promise<PengaturanDasbor> {
  if (!muat || ulang) {
    muat = (async () => {
      try {
        const { data, error } = await supabase.from('app_settings').select('value').eq('key', KUNCI_DASBOR_WIDGET).maybeSingle();
        if (error) throw error;
        return rapikanDasbor(data?.value);
      } catch {
        muat = null;
        return DASBOR_BAWAAN;
      }
    })();
  }
  return muat;
}

export function useDasborWidget(): PengaturanDasbor {
  const [p, setP] = useState<PengaturanDasbor>(DASBOR_BAWAAN);
  useEffect(() => {
    let hidup = true;
    muatDasborWidget().then(v => { if (hidup) setP(v); });
    const ubah = (e: Event) => setP(rapikanDasbor((e as CustomEvent).detail));
    window.addEventListener(EVENT_DASBOR_WIDGET, ubah);
    return () => { hidup = false; window.removeEventListener(EVENT_DASBOR_WIDGET, ubah); };
  }, []);
  return p;
}
