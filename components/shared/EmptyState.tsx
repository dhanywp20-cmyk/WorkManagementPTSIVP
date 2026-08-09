'use client';

interface LoadingSpinnerProps {
  message?: string;
  color?: string;
}

export function LoadingSpinner({ message = 'Memuat data...', color = '#6366f1' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-8 h-8 rounded-full animate-spin"
        style={{ border: '3px solid #e2e8f0', borderTopColor: color }} />
      <span className="text-gray-400 text-sm">{message}</span>
    </div>
  );
}

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <span className="text-5xl">{icon}</span>
      <p className="font-semibold text-gray-600 text-sm mt-1">{title}</p>
      {description && (
        <p className="text-xs text-gray-400 text-center max-w-xs leading-relaxed">{description}</p>
      )}
      {action && (
        <button onClick={action.onClick}
          className="mt-2 px-4 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-all">
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * Layar kosong yang MEMBEDAKAN dua keadaan yang tampak sama tapi berbeda
 * artinya bagi pengguna:
 *
 *   belum ada data sama sekali  → ajakan membuat yang pertama
 *   filter menyaring habis      → tawaran mengembalikan filter
 *
 * Sebelum komponen ini, keduanya ditulis dengan kalimat yang sama di tiap
 * modul, dan tidak satu pun menawarkan jalan keluar. Pengguna yang menyaring
 * terlalu sempit hanya melihat "tidak ditemukan" lalu harus menebak sendiri
 * filter mana yang harus dikembalikan.
 */
export function ListEmptyState({
  adaFilterAktif, onReset, icon, judulKosong, deskripsiKosong, aksiKosong,
}: {
  /** True bila pencarian/filter sedang menyempitkan daftar. */
  adaFilterAktif: boolean;
  /** Mengembalikan seluruh filter ke keadaan awal. */
  onReset: () => void;
  icon?: string;
  /** Dipakai saat memang belum ada data — bukan karena filter. */
  judulKosong: string;
  deskripsiKosong?: string;
  aksiKosong?: { label: string; onClick: () => void };
}) {
  if (adaFilterAktif) {
    return (
      <EmptyState
        icon="🔍"
        title="Tidak ada yang cocok dengan filter"
        description="Kata kunci atau filter yang dipilih menyaring semua data. Kembalikan filter untuk melihat seluruh daftar."
        action={{ label: '← Kembalikan filter', onClick: onReset }}
      />
    );
  }
  return (
    <EmptyState
      icon={icon}
      title={judulKosong}
      description={deskripsiKosong}
      action={aksiKosong}
    />
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Gagal memuat data', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <span className="text-5xl">⚠️</span>
      <p className="font-semibold text-gray-700 text-sm mt-1">{message}</p>
      <p className="text-xs text-gray-400">Periksa koneksi internet dan coba lagi</p>
      {onRetry && (
        <button onClick={onRetry}
          className="mt-3 px-5 py-2 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl border border-rose-200 transition-all">
          ↻ Coba Lagi
        </button>
      )}
    </div>
  );
}
