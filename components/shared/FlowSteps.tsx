'use client';

/**
 * components/shared/FlowSteps.tsx — diagram tahapan untuk alur bertahap.
 *
 * Request Schedule punya alur paling bercabang di seluruh platform: Sales
 * External mengajukan, Sales Internal meneruskan, Admin assign, Team
 * mengerjakan, lalu selesai. Alur itu tidak pernah tergambar di mana pun — ia
 * hanya hidup di kolom routing_status yang punya tiga nilai, dan di kepala
 * orang yang membangunnya.
 *
 * Akibat nyatanya sudah terbukti: tahap Sales Internal sempat terlewat saat
 * menambahkan Timeline, justru karena tidak ada satu layar pun yang
 * menampilkan bahwa tahap itu ada.
 *
 * Komponen ini menjawab tiga pertanyaan sekaligus, tanpa perlu dibaca:
 *   sudah sampai mana · sedang menunggu siapa · masih ada berapa tahap lagi
 */

export interface FlowStep {
  /** Nama tahap, sependek mungkin — ini label di bawah bulatan. */
  label: string;
  /** Siapa yang mengerjakan tahap ini. Ditampilkan lebih kecil. */
  pelaku?: string;
  /**
   * Kapan tahap ini terjadi. Kalau diisi, ditampilkan sebagai bukti bahwa
   * tahapnya benar-benar sudah lewat — bukan sekadar dianggap lewat.
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
  /** Alur berhenti di tengah — tahap aktif ditandai merah, sisanya diredupkan. */
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

      {/* Baris tahapan — bisa digeser di layar sempit tanpa membuat
          seluruh halaman ikut bergeser. */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex items-start" style={{ minWidth: `${steps.length * 5.5}rem` }}>
          {steps.map((s, i) => {
            const k = keadaan(i);
            const w = WARNA[k];
            return (
              <div key={i} className="flex-1 flex flex-col items-center relative">

                {/* Garis penghubung ke tahap sebelumnya. Digambar di belakang
                    bulatan, dan warnanya mengikuti tahap KIRI supaya jalur yang
                    sudah dilalui terbaca menyambung. */}
                {i > 0 && (
                  <span className="absolute h-0.5" aria-hidden="true"
                    style={{
                      top: '0.6875rem', right: '50%', width: '100%',
                      background: WARNA[keadaan(i - 1)].garis,
                    }} />
                )}

                <span className="relative flex items-center justify-center rounded-full flex-shrink-0"
                  style={{
                    width: '1.375rem', height: '1.375rem',
                    background: k === 'menunggu' ? '#fff' : w.bulat,
                    border: `2px solid ${w.bulat}`,
                    boxShadow: k === 'sekarang' ? `0 0 0 3px ${w.bulat}33` : undefined,
                  }}>
                  {k === 'selesai' && <span className="text-white text-[9px] font-black">✓</span>}
                  {k === 'batal'   && <span className="text-white text-[9px] font-black">✕</span>}
                  {k === 'sekarang' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>

                <p className="text-[10px] font-bold text-center mt-1.5 leading-tight px-0.5"
                  style={{ color: w.teks }}>
                  {s.label}
                </p>
                {s.pelaku && (
                  <p className="text-[9px] text-center leading-tight text-slate-400 px-0.5">
                    {s.pelaku}
                  </p>
                )}
                {s.waktu && (
                  <p className="text-[9px] text-center leading-tight text-slate-400 tabular-nums">
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
