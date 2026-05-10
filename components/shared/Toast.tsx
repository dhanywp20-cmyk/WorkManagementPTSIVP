'use client';

/**
 * Shared Toast notification — pattern standar untuk semua platform.
 * Caller manages state: const [notif, setNotif] = useState<Notif|null>(null);
 *  → setNotif({type, msg}); setTimeout(()=>setNotif(null), 3500);
 */

export interface Notif {
  type: 'success' | 'error';
  msg: string;
}

export function Toast({ notif }: { notif: Notif | null }) {
  if (!notif) return null;
  return (
    <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl flex items-center gap-2"
      style={{
        background: notif.type === 'success' ? '#d1fae5' : '#fee2e2',
        color: notif.type === 'success' ? '#065f46' : '#991b1b',
        border: `1px solid ${notif.type === 'success' ? '#6ee7b7' : '#fca5a5'}`,
      }}>
      {notif.type === 'success' ? '✅' : '❌'} {notif.msg}
    </div>
  );
}

/**
 * Inline toast — untuk dipakai di dalam modal (bukan fixed top-right)
 */
export function InlineToast({ notif }: { notif: Notif | null }) {
  if (!notif) return null;
  return (
    <div className={`mx-5 mt-4 px-4 py-3 rounded-xl text-sm font-semibold flex gap-2 ${notif.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
      <span>{notif.type === 'success' ? '✅' : '❌'}</span>
      <span>{notif.msg}</span>
    </div>
  );
}
