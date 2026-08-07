'use client';

import { useState, useEffect } from 'react';
import { ProjectDetailView } from '../../_components/ProjectDetailView';
import { ProjectDetail, THEME, STATUS_CONFIG, formatDatetime } from '../../_components/shared';

/**
 * Halaman share View-Only — PUBLIK, tanpa login.
 * Data diambil dari /api/project-progress/share/<token> (service_role di server),
 * jadi halaman ini tidak pernah menyentuh supabase anon key maupun session.
 * Murni baca: tidak ada satu pun kontrol edit di sini.
 */
export default function SharedProjectPage({ params }: { params: { token: string } }) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // no-store: progres berubah terus, salinan lama bikin proyek terlihat
        // masih kosong padahal lokasinya sudah ditambahkan.
        const res = await fetch(`/api/project-progress/share/${params.token}`, { cache: 'no-store' });
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) {
          setErr([json.error, json.detail].filter(Boolean).join(' — ') || 'Link tidak ditemukan.');
          return;
        }
        setDetail(json as ProjectDetail);
      } catch {
        if (alive) setErr('Gagal memuat data. Periksa koneksi internet.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [params.token]);

  return (
    <div className="min-h-screen relative" style={{
      backgroundImage: `url('/IVP_Background.png')`,
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
    }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(255,255,255,0.08)' }} />

      <div className="relative z-10">
        {/* Header — versi statis (tanpa aksi) */}
        <header className="sticky top-0 z-50" style={{
          background: 'rgba(255,255,255,0.95)',
          borderBottom: `3px solid ${THEME.color}`,
          backdropFilter: 'blur(16px)',
        }}>
          <div className="max-w-[1600px] mx-auto px-6 py-3.5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: THEME.gradient, boxShadow: `0 3px 12px ${THEME.shadow}` }}>
                <span className="text-lg">📊</span>
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight leading-tight" style={{ color: THEME.color }}>
                  {detail?.project.name ?? 'Project Progress'}
                </h1>
                <p className="text-[10px] text-slate-500 font-medium">
                  {detail?.project.client ? `${detail.project.client} · ` : ''}Tampilan hanya-baca
                </p>
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5"
              style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
              👁️ View Only
            </span>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
          {loading && (
            <div className="rounded-2xl p-12 text-center" style={{ background: 'rgba(255,255,255,0.95)' }}>
              <div className="inline-block w-8 h-8 rounded-full border-[3px] border-gray-200 animate-spin"
                style={{ borderTopColor: THEME.color }} />
              <p className="mt-3 text-sm font-bold text-gray-500">Memuat progres proyek…</p>
            </div>
          )}

          {!loading && err && (
            <div className="rounded-2xl p-12 text-center" style={{ background: 'rgba(255,255,255,0.95)' }}>
              <p className="text-4xl mb-3">🔒</p>
              <p className="text-base font-black text-gray-700">{err}</p>
              <p className="mt-1.5 text-xs text-gray-500 font-medium">
                Hubungi admin untuk mendapatkan link yang masih aktif.
              </p>
            </div>
          )}

          {!loading && !err && detail && (
            <div className="flex flex-col gap-5">
              <div className="rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3"
                style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.8)' }}>
                <div>
                  <p className="text-lg font-black text-gray-800">{detail.project.name}</p>
                  {detail.project.client && (
                    <p className="text-xs text-gray-500 font-semibold">{detail.project.client}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1.5 rounded-full text-[11px] font-bold"
                    style={{
                      background: (STATUS_CONFIG[detail.project.status] ?? STATUS_CONFIG.in_progress).bg,
                      color: (STATUS_CONFIG[detail.project.status] ?? STATUS_CONFIG.in_progress).color,
                      border: `1px solid ${(STATUS_CONFIG[detail.project.status] ?? STATUS_CONFIG.in_progress).border}`,
                    }}>
                    {(STATUS_CONFIG[detail.project.status] ?? STATUS_CONFIG.in_progress).label}
                  </span>
                  <span className="text-[10px] text-gray-400 font-semibold">
                    Diperbarui {formatDatetime(detail.project.updated_at)}
                  </span>
                </div>
              </div>

              <ProjectDetailView detail={detail} />

              <p className="self-center rounded-full px-4 py-2 text-[10px] text-gray-500 font-semibold my-2"
                style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.8)' }}>
                Work Management PTS IVP · Halaman ini hanya menampilkan data, tidak dapat diubah.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
