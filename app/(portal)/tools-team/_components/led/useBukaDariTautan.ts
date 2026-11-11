'use client';
import { useEffect, useRef } from 'react';
import type { FileAktifLED } from './FileLED';

let sudahDibuka = false;

export function useBukaDariTautan(buka: (data: Record<string, unknown>, file: FileAktifLED) => void) {
  const bukaRef = useRef(buka);
  useEffect(() => { bukaRef.current = buka; });
  useEffect(() => {
    if (sudahDibuka) return;
    const url = new URL(window.location.href);
    const id = url.searchParams.get('led');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    sudahDibuka = true;
    url.searchParams.delete('led');
    window.history.replaceState(window.history.state, '', url.toString());
    void fetch(`/api/tools-team/led?id=${encodeURIComponent(id)}`, { credentials: 'include', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j?.ok) bukaRef.current(j.file.data as Record<string, unknown>, { id: j.file.id, nama: j.file.nama, bolehUbah: !!j.file.bolehUbah }); })
      .catch(() => {});
  }, []);
}
