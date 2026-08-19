'use client';
import { useState } from 'react';

/**
 * Shared 5-star rating widget - dari form-review.
 */
export function StarRating({ value, onChange, disabled }: { value: number; onChange?: (v: number) => void; disabled?: boolean }) {
  const [hovered, setHovered] = useState(0);
  return (
    // Kumpulan tombol yang saling meniadakan = radiogroup. Tanpa ini kelimanya
    // terbaca sebagai lima tombol lepas dan tidak terdengar bahwa memilih satu
    // membatalkan yang lain, apalagi nilai mana yang sedang terpilih.
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Penilaian bintang">
      {[1,2,3,4,5].map(star => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} dari 5 bintang`}
          disabled={disabled}
          onClick={() => onChange && onChange(star)}
          onMouseEnter={() => !disabled && setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="transition-all"
          style={{ fontSize: '1.6rem', cursor: disabled ? 'default' : 'pointer' }}
        >
          <span aria-hidden="true" style={{ color: star <= (hovered || value) ? '#f59e0b' : '#d1d5db' }}>★</span>
        </button>
      ))}
      {value > 0 && <span className="ml-1 text-sm font-bold text-amber-600">{value}/5</span>}
    </div>
  );
}
