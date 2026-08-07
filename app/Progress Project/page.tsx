'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getSession, startSessionWatcher } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { PageHeader, Toast, LoadingScreen, EmptyState } from '@/components/shared';
import {
  User, Site, ChecklistItem, Issue, Severity,
  MODULE_COLOR, STATUS_META, SEV_BADGE, canEditBpkp,
} from './_components/shared';
import { DetailModal } from './_components/DetailModal';

export default function BpkpProgressPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [appReady, setAppReady] = useState(false);

  const [sites, setSites] = useState<Site[]>([]);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [notif, setNotif] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const notify = (type: 'success' | 'error', msg: string) => { setNotif({ type, msg }); setTimeout(() => setNotif(null), 3000); };

  const canEdit = canEditBpkp(currentUser);
  const isAdminRole = ['admin', 'superadmin'].includes((currentUser?.role ?? '').toLowerCase());

  // ── Session check (pola sama dengan modul lain) ──
  useEffect(() => {
    const u = getSession<User>();
    if (!u) {
      const target = window.top !== window ? window.top : window;
      if (target) target.location.href = '/dashboard';
      return;
    }
    setCurrentUser(u);
    setTimeout(() => setAppReady(true), 200);
    return startSessionWatcher();
  }, []);

  // ── Fetch + realtime ──
  useEffect(() => {
    if (!appReady) return;
    fetchAll();
    const ch = supabase.channel('bpkp-progress-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bpkp_sites' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bpkp_checklist_items' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bpkp_issues' }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appReady]);

  async function fetchAll() {
    setLoading(true);
    const [sitesRes, itemsRes, issuesRes] = await Promise.all([
      supabase.from('bpkp_sites').select('*').order('sort_order'),
      supabase.from('bpkp_checklist_items').select('*').order('sort_order'),
      supabase.from('bpkp_issues').select('*').order('sort_order'),
    ]);
    setSites((sitesRes.data ?? []) as Site[]);
    setItems((itemsRes.data ?? []) as ChecklistItem[]);
    setIssues((issuesRes.data ?? []) as Issue[]);
    setLoading(false);
  }

  const stats = useMemo(() => {
    const total = sites.length;
    const avg = total ? Math.round(sites.reduce((s, x) => s + (x.progress || 0), 0) / total) : 0;
    const attention = sites.filter(s => s.status === 'blocked').length;
    return { total, avg, openIssues: issues.length, attention };
  }, [sites, issues]);

  async function addSite() {
    const sort_order = sites.length ? Math.max(...sites.map(s => s.sort_order)) + 1 : 1;
    const { data } = await supabase.from('bpkp_sites')
      .insert({ name: 'BPKP Lokasi Baru', pic: '-', status: 'progress', progress: 0, sort_order, created_by: currentUser?.id })
      .select().single();
    if (data) {
      setSites(prev => [...prev, data as Site]);
      void logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'create', module: 'bpkp-progress', target_id: data.id, target_name: data.name });
      setSelectedSiteId(data.id);
    }
  }

  function copyShareLink(siteId: string) {
    const url = `${window.location.origin}/bpkp-progress/share/${siteId}`;
    navigator.clipboard.writeText(url);
    notify('success', 'Link view-only disalin ke clipboard');
  }

  if (!appReady || loading) {
    return <LoadingScreen message="Memuat progres BPKP..." accentColor={MODULE_COLOR} />;
  }

  const selectedSite = sites.find(s => s.id === selectedSiteId) || null;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader icon="📽️" title="Progres Instalasi AV — BPKP" subtitle="Tracking instalasi AV 5 lokasi BPKP" color={MODULE_COLOR}>
        {canEdit && (
          <button
            onClick={addSite}
            className="text-xs font-bold px-4 py-2 rounded-xl text-white shadow-sm"
            style={{ background: MODULE_COLOR }}
          >
            + Tambah Lokasi
          </button>
        )}
        {!canEdit && (
          <span className="text-[10px] font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
            Mode lihat saja
          </span>
        )}
      </PageHeader>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total Lokasi" value={`${stats.total}`} unit="site" />
          <StatCard label="Rata-rata Progres" value={`${stats.avg}`} unit="%" />
          <StatCard label="Isu Terbuka" value={`${stats.openIssues}`} unit="issue" />
          <StatCard label="Butuh Perhatian" value={`${stats.attention}`} unit="site" accent={stats.attention > 0 ? 'text-red-600' : undefined} />
        </div>

        {/* List Project */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">List Project</h2>
        </div>

        {sites.length === 0 ? (
          <EmptyState icon="📽️" title="Belum ada lokasi" description="Tambahkan lokasi BPKP pertama untuk mulai tracking progres." />
        ) : (
          <div className="space-y-2.5 mb-8">
            {sites.map(site => (
              <div
                key={site.id}
                onClick={() => setSelectedSiteId(site.id)}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-orange-200 transition p-4 flex flex-wrap items-center gap-4 cursor-pointer"
              >
                <div className="flex-1 min-w-[160px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-800 text-sm">{site.name}</h3>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_META[site.status].badge}`}>
                      {STATUS_META[site.status].label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">PIC: {site.pic}</p>
                </div>

                <div className="w-full sm:w-44">
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Progres</span><span>{site.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${site.progress}%`, background: MODULE_COLOR }} />
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); copyShareLink(site.id); }}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex-shrink-0"
                >
                  Kirim Link View Only
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Rekap Isu */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Rekap Isu Terbuka</h2>
        </div>
        {issues.length === 0 ? (
          <EmptyState icon="✅" title="Tidak ada isu terbuka" />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase text-gray-400 border-b border-gray-100">
                  <th className="text-left px-4 py-2.5">Lokasi</th>
                  <th className="text-left px-4 py-2.5">Isu</th>
                  <th className="text-left px-4 py-2.5">Severity</th>
                  <th className="text-left px-4 py-2.5">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {issues.map(issue => (
                  <tr key={issue.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2.5 font-semibold text-gray-700 whitespace-nowrap">{issue.site}</td>
                    <td className="px-4 py-2.5 text-gray-600">{issue.issue}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${SEV_BADGE[issue.severity as Severity]}`}>
                        {issue.severity}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{issue.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {selectedSite && (
        <DetailModal
          site={selectedSite}
          items={items.filter(i => i.site_id === selectedSite.id).sort((a, b) => a.sort_order - b.sort_order)}
          currentUser={currentUser}
          canEdit={canEdit}
          canDeleteSite={isAdminRole}
          onClose={() => setSelectedSiteId(null)}
          onShareLink={copyShareLink}
        />
      )}

      <Toast notif={notif} />
    </div>
  );
}

function StatCard({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5">
      <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">{label}</div>
      <div className={`text-xl font-bold ${accent ?? 'text-gray-800'}`}>{value} <span className="text-xs font-medium text-gray-400">{unit}</span></div>
    </div>
  );
}
