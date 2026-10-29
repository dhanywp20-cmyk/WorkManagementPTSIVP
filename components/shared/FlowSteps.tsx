'use client';

/**
 * components/shared/FlowSteps.tsx - diagram tahapan untuk alur bertahap seperti
 * routing_status Request Schedule: Sales External mengajukan, Sales Internal
 * meneruskan, Admin assign, Team mengerjakan, selesai.
 *
 * Menjawab tiga pertanyaan sekaligus tanpa perlu dibaca: sudah sampai mana,
 * sedang menunggu siapa, dan masih ada berapa tahap lagi.
 */

export interface FlowStep {
  /** Nama tahap, sependek mungkin - ini label di bawah bulatan. */
  label: string;
  /** Siapa yang mengerjakan tahap ini. Ditampilkan lebih kecil. */
  pelaku?: string;
  /**
   * Kapan tahap ini terjadi. Kalau diisi, ditampilkan sebagai bukti bahwa
   * tahapnya benar-benar sudah lewat - bukan sekadar dianggap lewat.
   */
  waktu?: string | null;
}

export type FlowState = 'selesai' | 'sekarang' | 'menunggu' | 'batal';

const WARNA: Record<FlowState, { bulat: string; garis: string; teks: string }> = {
  selesai:  { bulat: '#10b981', garis: '#10b981', teks: '#065f46' },
  sekarang: { bulat: '#f59e0b', garis: '#e2e8f0', teks: '#b45309' },
  menunggu: { bulat: '#e2e8f0', garis: '#e2e8f0', teks: '#94a3b8' },
  batal:    { bulat: '#ef4444', garis: '#e2e8f0', teks: '#b91c1c' },
};

export function FlowSteps({
  steps, aktif, dibatalkan = false, judul,
}: {
  steps: FlowStep[];
  /**
   * Indeks tahap yang SEDANG berjalan. Semua sebelumnya dianggap selesai,
   * semua sesudahnya menunggu. Isi steps.length bila seluruh alur tuntas.
   */
  aktif: number;
  /** Alur berhenti di tengah - tahap aktif ditandai merah, sisanya diredupkan. */
  dibatalkan?: boolean;
  judul?: string;
}) {
  const keadaan = (i: number): FlowState => {
    if (dibatalkan && i === aktif) return 'batal';
    if (i < aktif)  return 'selesai';
    if (i === aktif) return 'sekarang';
    return 'menunggu';
  };

  const tahapSekarang = steps[aktif];

  return (
    <div className="rounded-xl p-4"
      style={{ background: 'rgba(8,145,178,0.05)', border: '1px solid rgba(8,145,178,0.18)' }}>

      {judul && (
        <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#0e7490' }}>
          {judul}
        </p>
      )}

      {/* Seluruh tahapan HARUS muat tanpa digeser: tiap tahap berbagi lebar
          sama rata dan labelnya boleh melipat. Lebar minimum per tahap memaksa
          scroll di panel sempit, dan tahap terakhir - yang paling ingin
          dilihat - justru yang tersembunyi di luar layar. */}
      {/* overflow-x-auto hanya jaring pengaman: dalam keadaan normal semua tahap muat. */}
      <div className="overflow-x-auto">
        <div className="flex items-start">
          {steps.map((s, i) => {
            const k = keadaan(i);
            const w = WARNA[k];
            return (
              /* Lebar dibagi rata, TETAPI tidak lebih sempit dari kata terpanjang label (tanpa
                 min-w-0): di HP huruf dinaikkan ke 11px dan label seperti "Diteruskan" dulu
                 terpotong di tengah kata ("Diteruska / n"). */
              <div key={i} className="flex-1 flex flex-col items-center relative">

                {/* Garis penghubung digambar per SISI (separuh kiri & kanan tiap tahap), bukan
                    satu garis selebar tahap: kolom kini boleh tidak sama lebar, dan garis tetap
                    menyambung dari pusat ke pusat. Warnanya mengikuti tahap KIRI. */}
                {i > 0 && (
                  <span className="absolute h-0.5" aria-hidden="true"
                    style={{ top: '0.6875rem', left: 0, right: '50%', background: WARNA[keadaan(i - 1)].garis }} />
                )}
                {i < steps.length - 1 && (
                  <span className="absolute h-0.5" aria-hidden="true"
                    style={{ top: '0.6875rem', left: '50%', right: 0, background: w.garis }} />
                )}

                <span className="relative flex items-center justify-center rounded-full shrink-0"
                  style={{
                    width: '1.375rem', height: '1.375rem',
                    background: k === 'menunggu' ? '#fff' : w.bulat,
                    border: `2px solid ${w.bulat}`,
                    boxShadow: k === 'sekarang' ? `0 0 0 3px ${w.bulat}33` : undefined,
                  }}>
                  {k === 'selesai' && <span className="text-white text-[10px] font-black">✓</span>}
                  {k === 'batal'   && <span className="text-white text-[10px] font-black">✕</span>}
                  {k === 'sekarang' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>

                <p className="text-[10px] font-bold text-center mt-1.5 leading-tight px-1 w-full"
                  style={{ color: w.teks }}>
                  {s.label}
                </p>
                {s.pelaku && (
                  <p className="text-[10px] text-center leading-tight text-slate-500 px-1 w-full wrap-anywhere">
                    {s.pelaku}
                  </p>
                )}
                {s.waktu && (
                  <p className="text-[10px] text-center leading-tight text-slate-500 tabular-nums">
                    {s.waktu}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Kalimat penutup: menyebut siapa yang sedang ditunggu. Ini yang paling
          sering ingin diketahui orang saat membuka layar detail. */}
      {tahapSekarang && !dibatalkan && (
        <p className="text-[11px] mt-3 pt-2.5" style={{ borderTop: '1px solid rgba(8,145,178,0.15)', color: '#0e7490' }}>
          Menunggu <strong>{tahapSekarang.pelaku || tahapSekarang.label}</strong>
          {tahapSekarang.pelaku ? ` — ${tahapSekarang.label}` : ''}
        </p>
      )}
      {dibatalkan && (
        <p className="text-[11px] mt-3 pt-2.5 font-semibold"
          style={{ borderTop: '1px solid rgba(239,68,68,0.2)', color: '#b91c1c' }}>
          Alur berhenti di tahap ini.
        </p>
      )}
      {!tahapSekarang && !dibatalkan && (
        <p className="text-[11px] mt-3 pt-2.5 font-semibold"
          style={{ borderTop: '1px solid rgba(16,185,129,0.2)', color: '#065f46' }}>
          Seluruh tahap selesai.
        </p>
      )}
    </div>
  );
}
