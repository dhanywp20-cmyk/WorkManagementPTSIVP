'use client';

import './globals.css';
import { LayarGalat } from '@/components/shared/LayarGalat';

/**
 * Batas galat PALING luar: dipakai bila layout akar sendiri gagal. Menggantikan seluruh dokumen,
 * jadi harus membawa <html> dan <body> sendiri.
 */
export default function GalatGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body className="antialiased">
        <LayarGalat error={error} reset={reset} penuh />
      </body>
    </html>
  );
}
