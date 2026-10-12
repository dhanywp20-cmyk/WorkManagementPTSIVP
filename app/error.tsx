'use client';

import { LayarGalat } from '@/components/shared/LayarGalat';

/** Batas galat tingkat atas (di dalam layout akar). Lihat components/shared/LayarGalat.tsx. */
export default function Galat({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <LayarGalat error={error} reset={reset} penuh />;
}
