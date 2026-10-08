'use client';

/** SeksiTim - dipecah dari app/(portal)/dashboard/_components/modal-integrasi.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Cek } from '../modal-integrasi';

export interface SeksiTimProps {
  belumTG: number;
  seksi: "kanal" | "wa" | "tg" | "push" | "tim" | "ai";
  tim: { nama: string; tim: string; jabatan: string; wa: boolean; tg: boolean; }[];
}

export function SeksiTim({ belumTG, seksi, tim }: SeksiTimProps) {
  return (
    <>
      {seksi === 'tim' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-700">Jangkauan tim</h3>
              <p className="text-[11.5px] text-slate-500 mt-0.5">Siapa yang benar-benar bisa dikabarkan lewat kanal mana.</p>
            </div>
            {belumTG > 0 && (
              <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
                {belumTG} belum Telegram
              </span>
            )}
          </div>
          <div className="p-3">
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[520px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Anggota</th>
                    <th className="text-left px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Tim</th>
                    <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">In-App</th>
                    <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">WhatsApp</th>
                    <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">Telegram</th>
                  </tr>
                </thead>
                <tbody>
                  {tim.length === 0 ? (
                    <tr><td colSpan={5} className="px-3.5 py-6 text-center text-xs text-slate-500">Memuat daftar tim…</td></tr>
                  ) : tim.map(t => (
                    <tr key={t.nama} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-3.5 py-2.5">
                        <div className="text-[12.5px] text-slate-700">{t.nama}</div>
                        <div className="text-[11px] text-slate-500">{t.jabatan}</div>
                      </td>
                      <td className="px-3.5 py-2.5 text-[11.5px] text-slate-500">{t.tim}</td>
                      <td className="px-3 py-2.5 text-center"><Cek ya /></td>
                      <td className="px-3 py-2.5 text-center"><Cek ya={t.wa} /></td>
                      <td className="px-3 py-2.5 text-center"><Cek ya={t.tg} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2.5 rounded-lg px-3 py-2.5 text-[11.5px] leading-relaxed"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>
              <b>Kolom Telegram hanya bisa diisi oleh orangnya sendiri.</b> Admin tidak bisa mengisikannya —
              Telegram baru menerbitkan Chat ID setelah orang itu menekan Start di bot.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
