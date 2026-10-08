'use client';
/**
 * Kalkulator audio: speaker plafon & SPL, line 70/100 V, impedansi & kabel speaker, akustik ruang (RT60).
 * Satu berkas per bagian di av/audio/; rumus di lib/av-hitung.ts & lib/av-audio-jaringan.ts.
 */
import { Segmen } from '../bersama/ui';
import { AudioAkustik } from './audio/AudioAkustik';
import { AudioKabel } from './audio/AudioKabel';
import { AudioLine } from './audio/AudioLine';
import { AudioSpeaker } from './audio/AudioSpeaker';
import { useState } from 'react';

const BAGIAN = [
  { v: 'speaker', l: 'Speaker & SPL', C: AudioSpeaker },
  { v: 'line', l: 'Line 70/100 V', C: AudioLine },
  { v: 'kabel', l: 'Impedansi & kabel', C: AudioKabel },
  { v: 'akustik', l: 'Akustik ruang (RT60)', C: AudioAkustik },
] as const;
type KodeBagian = (typeof BAGIAN)[number]['v'];

export function KalkulatorAudio() {
  const [bagian, setBagian] = useState<KodeBagian>('speaker');
  const C = BAGIAN.find(b => b.v === bagian)!.C;
  return (
    <div className="space-y-3">
      <div className="max-w-full overflow-x-auto print:hidden">
        <Segmen nilai={bagian} onUbah={setBagian} opsi={BAGIAN.map(b => ({ v: b.v, l: b.l }))} />
      </div>
      <C />
    </div>
  );
}
