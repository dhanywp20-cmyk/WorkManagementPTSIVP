'use client';

import './globals.css';
import { LayarGalat } from '@/components/shared/LayarGalat';

export default function GalatGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body className="antialiased">
        <LayarGalat error={error} reset={reset} penuh />
      </body>
    </html>
  );
}
