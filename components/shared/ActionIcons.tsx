'use client';

/**
 * Shared action icons untuk table action column.
 * Style emoji konsisten — sama persis seperti di reminder-schedule, ticketing, unit-movement.
 */

export function ViewIconBtn({ onClick, title = 'Lihat Detail' }: { onClick: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title} className="text-blue-500 hover:text-blue-700 transition-colors">
      <span className="text-sm">👁</span>
    </button>
  );
}

export function EditIconBtn({ onClick, title = 'Edit' }: { onClick: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title} className="text-amber-500 hover:text-amber-700 transition-colors">
      <span className="text-sm">✏️</span>
    </button>
  );
}

export function DeleteIconBtn({ onClick, title = 'Hapus' }: { onClick: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title} className="text-red-400 hover:text-red-600 transition-colors">
      <span className="text-sm">🗑️</span>
    </button>
  );
}

export function RescheduleIconBtn({ onClick, title = 'Reschedule' }: { onClick: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title} className="text-amber-500 hover:text-amber-700 transition-colors">
      <span className="text-sm">📅</span>
    </button>
  );
}

export function DuplicateIconBtn({ onClick, title = 'Duplikat' }: { onClick: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title} className="text-purple-500 hover:text-purple-700 transition-colors">
      <span className="text-sm">📋</span>
    </button>
  );
}

export function CompleteIconBtn({ onClick, title = 'Tandai Selesai' }: { onClick: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title} className="text-emerald-500 hover:text-emerald-700 transition-colors">
      <span className="text-sm">✅</span>
    </button>
  );
}

/**
 * Wrapper untuk action column — flex container standar
 */
export function ActionGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1">{children}</div>;
}
