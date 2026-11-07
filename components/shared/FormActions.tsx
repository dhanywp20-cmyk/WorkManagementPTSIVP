'use client';

const IKON_KIRIM = 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8';
const IKON_SIMPAN = 'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4';

export function BatalButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="px-4 py-2 rounded-lg font-semibold text-xs transition-all hover:bg-slate-50 disabled:opacity-50"
      style={{ background: 'rgba(255,255,255,0.95)', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)' }}>
      Batal
    </button>
  );
}

export function SubmitFormButton({
  onClick, loading, disabled, editing, suffix, blockedLabel,
}: {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  editing?: boolean;
  suffix?: string;
  blockedLabel?: string;
  gradient?: string;
  shadow?: string;
}) {
  const terkunci = !!blockedLabel;
  const label = editing ? 'Simpan Perubahan' : 'Submit Form';
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading}
      className="text-white px-5 py-2 rounded-kontrol font-bold text-xs flex items-center justify-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-50"
      style={{ background: 'linear-gradient(135deg, var(--merek-utama), var(--merek-utama-2))' }}>
      {loading
        ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{editing ? 'Menyimpan...' : 'Mengirim...'}</>
        : terkunci
          ? <>⚠️ {blockedLabel}</>
          : (
            <>
              <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={editing ? IKON_SIMPAN : IKON_KIRIM} />
              </svg>
              {label}
              {suffix && <span className="font-semibold opacity-80">· {suffix}</span>}
            </>
          )}
    </button>
  );
}
