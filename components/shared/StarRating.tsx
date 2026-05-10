'use client';
import { useState } from 'react';

/**
 * Shared 5-star rating widget — dari form-review.
 */
export function StarRating({ value, onChange, disabled }: { value: number; onChange?: (v: number) => void; disabled?: boolean }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(star => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange && onChange(star)}
          onMouseEnter={() => !disabled && setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="transition-all"
          style={{ fontSize: '1.6rem', cursor: disabled ? 'default' : 'pointer' }}
        >
          <span style={{ color: star <= (hovered || value) ? '#f59e0b' : '#d1d5db' }}>★</span>
        </button>
      ))}
      {value > 0 && <span className="ml-1 text-sm font-bold text-amber-600">{value}/5</span>}
    </div>
  );
}
