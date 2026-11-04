'use client';

import { LayarGalat } from '@/components/shared/LayarGalat';

export default function Galat({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <LayarGalat error={error} reset={reset} penuh />;
}
