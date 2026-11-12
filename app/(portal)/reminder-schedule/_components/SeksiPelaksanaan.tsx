'use client';
import { triggersProjectProgress } from '@/lib/checklist/sinkron-progress';
import { Reminder, INCENTIVE_TRIGGER_CATEGORIES, formatDate } from './shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { useKonteksJadwal } from './konteks-jadwal';

export function SeksiPelaksanaan({ detailReminder }: { detailReminder: Reminder }) {
  const k = useKonteksJadwal();
  const { isAdmin, currentUser } = k.sesi;
  const { bukaEditDetailPelaksanaan } = k.detail;
  return (
    <>
      {triggersProjectProgress(detailReminder.category) && (() => {
        const t = detailReminder as { progress_start_date?: string | null; progress_target_date?: string | null };
        const ada = t.progress_start_date || t.progress_target_date;
        return (
          <div className="rounded-xl p-4 flex items-center gap-3"
            style={ada
              ? { background: 'rgba(8,145,178,0.07)', border: '1px solid rgba(8,145,178,0.25)' }
              : { background: 'rgba(100,116,139,0.07)', border: '1px solid rgba(100,116,139,0.2)' }}>
            <span className="text-xl"><Ikon nama="📊" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: ada ? '#0e7490' : '#64748b' }}>
                Timeline Project Progress
              </p>
              {ada ? (
                <p className="text-sm font-semibold text-slate-700">
                  {t.progress_start_date ? formatDate(t.progress_start_date) : '—'}
                  <span className="mx-1.5 text-slate-400">→</span>
                  {t.progress_target_date ? formatDate(t.progress_target_date) : '—'}
                </p>
              ) : (
                <p className="text-sm text-slate-500 italic">Belum ditetapkan</p>
              )}
            </div>
          </div>
        );
      })()}

      {(detailReminder.category === 'Konfigurasi' || detailReminder.category === 'Konfigurasi & Training') && (() => {
        const wy = (detailReminder).warranty_years as 1 | 2 | 3 | null | undefined;
        const bastDate = detailReminder.due_date;
        if (!wy || !bastDate) return (
          <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(100,116,139,0.07)', border: '1px solid rgba(100,116,139,0.2)' }}>
            <span className="text-xl"><Ikon nama="🛡" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Masa Garansi</p>
              <p className="text-sm text-slate-500 italic">Tidak dikonfigurasi</p>
            </div>
          </div>
        );
        const bast = new Date(bastDate + 'T00:00:00');
        const expiry = new Date(bastDate + 'T00:00:00');
        expiry.setFullYear(expiry.getFullYear() + wy);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isInWarranty = today <= expiry;
        const diffMs = expiry.getTime() - today.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const expiryStr = expiry.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const bastStr = bast.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        return (
          <div className="rounded-xl p-4" style={isInWarranty
            ? { background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.35)' }
            : { background: 'rgba(239,68,68,0.07)', border: '1.5px solid rgba(239,68,68,0.35)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{isInWarranty ? '🛡️' : '⚠️'}</span>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: isInWarranty ? '#0369a1' : '#dc2626' }}>
                Status Garansi
              </p>
              <span className="ml-auto px-2.5 py-1 rounded-full text-[11px] font-bold" style={isInWarranty
                ? { background: 'rgba(14,165,233,0.18)', color: '#0369a1' }
                : { background: 'rgba(239,68,68,0.15)', color: '#dc2626' }}>
                {isInWarranty ? '✅ In Warranty' : '❌ Out of Warranty'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2 text-xs">
              <div>
                <p className="text-slate-500 mb-0.5">BAST / Mulai</p>
                <p className="font-semibold text-slate-700">{bastStr}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">Garansi Berakhir</p>
                <p className="font-semibold" style={{ color: isInWarranty ? '#0369a1' : '#dc2626' }}>{expiryStr}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">Durasi</p>
                <p className="font-semibold text-slate-700">{wy} Tahun</p>
              </div>
              <div>
                <p className="text-slate-500 mb-0.5">{isInWarranty ? 'Sisa Hari' : 'Sudah Lewat'}</p>
                <p className="font-bold" style={{ color: isInWarranty ? '#0369a1' : '#dc2626' }}>
                  {isInWarranty ? `${diffDays} hari` : `${Math.abs(diffDays)} hari`}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {(INCENTIVE_TRIGGER_CATEGORIES as readonly string[]).includes(detailReminder.category) && detailReminder.mode_penyelesaian && (() => {
        const brandLabel: Record<string, string> = { cue: 'Cue System', extron: 'Extron', wyrestorm: 'Wyrestorm' };
        const displayLabel: Record<string, string> = { led: 'LED', lcd: 'LCD', mix: 'Mix (LED + LCD)' };
        const isOnsite = detailReminder.mode_penyelesaian === 'onsite';
        return (
          <div className="rounded-xl p-4" style={isOnsite
            ? { background: 'rgba(16,185,129,0.07)', border: '1.5px solid rgba(16,185,129,0.3)' }
            : { background: 'rgba(59,130,246,0.07)', border: '1.5px solid rgba(59,130,246,0.3)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{isOnsite ? '🏠' : '📡'}</span>
              <p className="text-xs font-bold uppercase tracking-wide flex-1" style={{ color: isOnsite ? '#047857' : '#1d4ed8' }}>
                Detail Pelaksanaan · {isOnsite ? 'ONSITE' : 'REMOTE'}
              </p>
              {(isAdmin || currentUser?.role === 'team') && (
                <button onClick={() => bukaEditDetailPelaksanaan(detailReminder)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all hover:scale-105"
                  style={{ background: 'rgba(255,255,255,0.9)', color: isOnsite ? '#047857' : '#1d4ed8', border: `1px solid ${isOnsite ? 'rgba(16,185,129,0.4)' : 'rgba(59,130,246,0.4)'}` }}>
                  <IkonTeks nama="✏" />Ubah
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {detailReminder.bast_date && (
                <div>
                  <p className="text-slate-500 mb-0.5"><IkonTeks nama="📅" />Tanggal BAST</p>
                  <p className="font-semibold text-slate-700">{formatDate(detailReminder.bast_date)}</p>
                </div>
              )}
              {detailReminder.display_type && (
                <div>
                  <p className="text-slate-500 mb-0.5"><IkonTeks nama="🖥" />Tipe Display</p>
                  <p className="font-semibold text-slate-700">{displayLabel[detailReminder.display_type] ?? detailReminder.display_type}</p>
                </div>
              )}
              <div>
                <p className="text-slate-500 mb-0.5"><IkonTeks nama="🎛" />Controller Automation</p>
                <p className="font-semibold text-slate-700">
                  {detailReminder.requires_controller_automation
                    ? (brandLabel[detailReminder.controller_automation_brand ?? ''] ?? 'Ya')
                    : 'Tidak'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 mb-0.5"><IkonTeks nama="🔌" />Middleware / System / Matrix</p>
                <p className="font-semibold text-slate-700">{detailReminder.requires_middleware ? 'Ya' : 'Tidak'}</p>
              </div>
              {!isOnsite && detailReminder.installer_name && (
                <div>
                  <p className="text-slate-500 mb-0.5"><IkonTeks nama="🔧" />PTS Daerah</p>
                  <p className="font-semibold text-slate-700">{detailReminder.installer_name}</p>
                </div>
              )}
              {!isOnsite && detailReminder.installer_daerah && (
                <div>
                  <p className="text-slate-500 mb-0.5"><IkonTeks nama="📍" />Daerah</p>
                  <p className="font-semibold text-slate-700">{detailReminder.installer_daerah}</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}
