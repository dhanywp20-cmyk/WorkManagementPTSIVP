'use client';
import { useState } from 'react';
import { type Snap, snapSah } from './inti';
import { lupakanPilihanKartu } from './mesin/ukurBlending';

export function usePreferensiKanvas() {
  const [chipBuka, setChipBukaMentah] = useState(() => { try { const s = localStorage.getItem('wm_desain3d_chip'); return s === null ? window.innerWidth >= 640 : s === '1'; } catch { return false; } });
  const setChipBuka = (f: (v: boolean) => boolean) => setChipBukaMentah(v => { const x = f(v); try { localStorage.setItem('wm_desain3d_chip', x ? '1' : '0'); } catch {  } return x; });
  const [sembunyiTeks, setSembunyiTeksMentah] = useState(() => { try { return localStorage.getItem('wm_desain3d_sembunyi_teks') === '1'; } catch { return false; } });
  const setSembunyiTeks = (v: boolean) => { setSembunyiTeksMentah(v); try { localStorage.setItem('wm_desain3d_sembunyi_teks', v ? '1' : '0'); } catch {  } };
  const [sinarNyata, setSinarNyataMentah] = useState(() => { try { return localStorage.getItem('wm_desain3d_sinar_nyata') !== '0'; } catch { return true; } });
  const setSinarNyata = (v: boolean) => { setSinarNyataMentah(v); try { localStorage.setItem('wm_desain3d_sinar_nyata', v ? '1' : '0'); } catch {  } };
  const [jarakDinding, setJarakDindingMentah] = useState(() => { try { return localStorage.getItem('wm_desain3d_jarak_dinding') === '1'; } catch { return false; } });
  const setJarakDinding = (v: boolean) => { setJarakDindingMentah(v); try { localStorage.setItem('wm_desain3d_jarak_dinding', v ? '1' : '0'); } catch {  } };
  const [detailBlending, setDetailBlendingMentah] = useState(() => { try { return localStorage.getItem('wm_desain3d_detail_blending') === '1'; } catch { return false; } });
  const setDetailBlending = (v: boolean) => {
    lupakanPilihanKartu(); setDetailBlendingMentah(v);
    try { localStorage.setItem('wm_desain3d_detail_blending', v ? '1' : '0'); } catch {  }
  };
  const [teksSinar, setTeksSinarMentah] = useState(() => { try { return localStorage.getItem('wm_desain3d_teks_sinar') !== '0'; } catch { return true; } });
  const setTeksSinar = (v: boolean) => { setTeksSinarMentah(v); try { localStorage.setItem('wm_desain3d_teks_sinar', v ? '1' : '0'); } catch {  } };
  const [snap, setSnapMentah] = useState<Snap>(() => { try { return snapSah(JSON.parse(localStorage.getItem('wm_desain3d_snap') ?? 'null')); } catch { return snapSah(null); } });
  const setSnap = (s: Snap) => { setSnapMentah(s); try { localStorage.setItem('wm_desain3d_snap', JSON.stringify(s)); } catch {  } };
  const [daftarKanvas, setDaftarKanvasMentah] = useState(() => { try { return localStorage.getItem('wm_desain3d_daftar') === '1'; } catch { return false; } });
  const setDaftarKanvas = (v: boolean) => { setDaftarKanvasMentah(v); try { localStorage.setItem('wm_desain3d_daftar', v ? '1' : '0'); } catch {  } };
  return { chipBuka, setChipBuka, sembunyiTeks, setSembunyiTeks, sinarNyata, setSinarNyata, jarakDinding, setJarakDinding, detailBlending,
    setDetailBlending, teksSinar, setTeksSinar, snap, setSnap, daftarKanvas, setDaftarKanvas };
}
