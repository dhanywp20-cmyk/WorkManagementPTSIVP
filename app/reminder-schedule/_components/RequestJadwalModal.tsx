'use client';
import { useState } from 'react';
import { CATEGORY_CONFIG, PRODUCT_TYPES } from './shared';
import { MultiDatePicker, ModalPortal, BatalButton, SubmitFormButton } from '@/components/shared';
import { SalesPicker, type SalesPickerUser } from '@/components/shared/SalesPicker';
import { BRAND_OPTIONS, type Brand } from '@/lib/brand-routing';

export interface JadwalRequest {
  project_name: string;
  description: string;
  address: string;
  category: string;
  product_type: string;   // tipe produk (LED / LCD·Middleware / LED & LCD) - utk routing
  due_date: string;
  /**
   * Usulan rentang pengerjaan untuk Project Progress. Hanya diisi bila
   * kategorinya Konfigurasi / Konfigurasi & Training. Sifatnya USULAN - admin
   * masih bisa mengubahnya saat approve, dan draft baru lahir setelah request
   * di-assign ke tim.
   */
  progress_start_date: string;
  progress_target_date: string;
  extra_dates: string[];   // hari tambahan - request sekali untuk beberapa hari sekaligus
  due_time: string;
  pic_name: string;
  pic_phone: string;
  product: string;
  notes: string;
  sales_division?: string; // dikirim dari modal agar tidak bergantung hanya pada localStorage
  brand?: Brand;           // Sales External pilih brand (MVI/IVP/BOTH)  routing ke Sales Internal
  // SBU - hanya diisi kalau creator = Sales Internal & membuat atas nama Sales
  // External tertentu. Kalau terisi  request diatasnamakan External tsb.
  sbu_name?: string;
  sbu_division?: string;
  /** uuid Sales External yang dipilih - dicatat berdampingan dengan sbu_name. */
  sbu_user_id?: string | null;
}

interface RequestJadwalModalProps {
  salesName: string;       // full_name dari currentUser (guest)
  salesUsername: string;   // username dari currentUser
  salesDivision?: string;  // sales_division dari currentUser (opsional, pre-fill)
  isInternalSales?: boolean;          // creator adalah Sales Internal  tampilkan SBU
  externalSalesUsers?: SalesPickerUser[]; // daftar Sales External utk dropdown SBU
  onClose: () => void;
  onSubmit: (data: JadwalRequest) => Promise<void>;
  /**
   * Diisi lewat pencarian "Project Lama Anda" SEBELUM modal ini dibuka -
   * lihat langkah 'cari' di reminder-schedule/page.tsx. Hanya field yang
   * masuk akal dibawa dari pekerjaan lama (alamat, PIC, produk, brand);
   * kategori dan tanggal SENGAJA tidak ikut, karena keduanya milik
   * pekerjaan BARU yang sedang diajukan.
   */
  initial?: Partial<JadwalRequest>;
}

const inputCls =
  'w-full rounded-lg px-3 py-2 text-xs outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/40';
const inputStyle = {
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.12)',
};

// Kategori yang diizinkan untuk Guest request
const ALLOWED_CATEGORIES = ['Demo Product', 'Meeting & Survey', 'Konfigurasi', 'Konfigurasi & Training', 'Training', 'Maintenance'];

export function RequestJadwalModal({
  salesName,
  salesDivision = '',
  isInternalSales = false,
  externalSalesUsers = [],
  onClose,
  onSubmit,
  initial,
}: RequestJadwalModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [form, setForm] = useState<JadwalRequest>({
    project_name: '',
    description: '',
    address: '',
    category: 'Demo Product',
    product_type: '',
    due_date: new Date().toISOString().split('T')[0],
    progress_start_date: '',
    progress_target_date: '',
    extra_dates: [],
    due_time: '09:00',
    pic_name: '',
    pic_phone: '',
    product: '',
    notes: '',
    sales_division: salesDivision,
    brand: undefined,
    sbu_name: '',
    sbu_division: '',
    sbu_user_id: null,
    ...initial,
  });

  const f = (patch: Partial<JadwalRequest>) => setForm(prev => ({ ...prev, ...patch }));

  const handleSubmit = async () => {
    if (!form.project_name.trim()) { setFormErr('Nama project wajib diisi!'); return; }
    if (!form.address.trim()) { setFormErr('Lokasi project wajib diisi!'); return; }
    // Sales External wajib pilih Brand (menentukan Sales Internal mana yg handle/approve).
    if (!isInternalSales && !form.brand) { setFormErr('Pilih Brand dulu (MVI / IVP / Kedua Brand)!'); return; }
    if (!form.product_type) { setFormErr('Pilih tipe produk dulu (LED / LCD·Middleware / LED & LCD)!'); return; }
    if (!form.due_date) { setFormErr('Tanggal wajib diisi!'); return; }
    setFormErr('');
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
    <div role="dialog" aria-modal="true"
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-3 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[1500px] h-full max-h-full flex flex-col overflow-hidden"
        style={{ animation: 'scale-in 0.25s ease-out', border: '2px solid rgba(59,130,246,0.35)' }}
      >
        {/* Header */}
        <div
          className="px-8 py-6 rounded-t-2xl flex items-center justify-between flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div>
            <h2 className="text-xl font-bold text-white">📩 Request Jadwal</h2>
            <p className="text-blue-200/80 text-xs mt-1">
              Permintaan akan dikirim ke Admin untuk disetujui &amp; di-assign ke Team PTS
            </p>
          </div>
          <button aria-label="Tutup"
            onClick={onClose}
            className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg transition-all"
          >
            <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tiga kolom menyamping — pola yang sama dengan form Reminder & Ticket. */}
        <div className="flex-1 min-h-0 overflow-y-auto satulayar:overflow-hidden">
          <div className="p-4 grid grid-cols-1 satulayar:grid-cols-3 gap-4 satulayar:h-full satulayar:overflow-hidden">

          {/* ── Kolom 1: siapa & project apa ── */}
          <div className="space-y-3 satulayar:overflow-y-auto satulayar:pr-2 satulayar:min-h-0">

          {/* Info requester */}
          <div
            className="rounded-xl p-3 flex items-center gap-3"
            style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}
            >
              {salesName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">Requested by</p>
              <p className="text-sm font-bold text-slate-800">{salesName}</p>
              {salesDivision && <p className="text-xs text-blue-500">{salesDivision}</p>}
            </div>
            <div className="ml-auto text-right">
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
                style={{ background: 'rgba(59,130,246,0.6)' }}
              >
                ⏳ Menunggu Approval
              </span>
            </div>
          </div>

          {/* SBU — hanya Sales Internal. Opsional: buat schedule ATAS NAMA Sales
             External tertentu (mis. bantu request untuk SBU-nya). Kalau dipilih,
             schedule diatasnamakan Sales External tsb (nama & divisi). */}
          {isInternalSales && (
            <div>
              <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                SBU <span className="normal-case text-slate-400 font-medium tracking-normal">(opsional — buat atas nama Sales External)</span>
              </label>
              <SalesPicker
                value={form.sbu_name ?? ''}
                users={externalSalesUsers}
                onChange={(name, division, userId) => f({ sbu_name: name, sbu_division: division, sbu_user_id: userId })}
                placeholder="— Pilih Sales External (opsional) —"
                triggerClassName="rounded-xl px-4 py-3"
                triggerStyle={inputStyle}
                dropdownZIndex={130}
              />
              {form.sbu_name && (
                <p className="text-[11px] text-blue-500 mt-1">
                  Schedule ini akan diatasnamakan <strong>{form.sbu_name}</strong>{form.sbu_division ? ` · ${form.sbu_division}` : ''}.
                </p>
              )}
            </div>
          )}

          {/* Brand — WAJIB utk Sales External. Menentukan Sales Internal (House/Global)
             yang meng-handle & meng-approve request ini. */}
          {!isInternalSales && (
            <div>
              <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                Brand * <span className="normal-case text-slate-400 font-medium tracking-normal">(Sales Internal yang handle)</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {BRAND_OPTIONS.map(opt => {
                  const sel = form.brand === opt.value;
                  return (
                    <button key={opt.value} type="button" onClick={() => { f({ brand: opt.value }); setFormErr(''); }}
                      className="px-3 py-3 rounded-xl border-2 text-center text-sm font-bold transition-all leading-tight"
                      style={sel
                        ? { borderColor: '#2563eb', background: 'rgba(37,99,235,0.1)', color: '#1d4ed8' }
                        : { borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', color: '#64748b' }}>
                      {opt.value === 'MVI' ? '🏠 ' : opt.value === 'IVP' ? '🌐 ' : '🏠🌐 '}{opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/*
            Ringkasan "sudah terisi dari project lama" - hanya muncul lewat
            jalur pencarian "Project Lama Anda". Tanpa ini, isian yang
            tiba-tiba penuh saat modal terbuka terlihat seperti keajaiban.
          */}
          {!!initial?.project_name && (
            <div className="rounded-xl px-3.5 py-2.5" style={{ background: 'rgba(8,145,178,0.08)', border: '1px solid rgba(8,145,178,0.25)' }}>
              <p className="text-[12px] font-bold" style={{ color: '#0e7490' }}>
                ✓ Detail diisi dari project Anda sebelumnya
              </p>
              <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: '#155e75' }}>
                Serah-terima (BAST) request ini akan digabung dengan yang lama saat disetujui admin -
                tidak terhitung sebagai project baru. Tinggal tentukan kategori dan tanggal di bawah.
              </p>
            </div>
          )}

          {/* Nama Project */}
          <div>
            <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
              Nama Project *
            </label>
            <input
              value={form.project_name}
              onChange={e => f({ project_name: e.target.value })}
              className={inputCls} style={inputStyle}
              placeholder="Contoh: PT. Maju Bersama — Instalasi LED Wall"
            />
          </div>

          {/* Lokasi */}
          <div>
            <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
              Lokasi Project *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2">📍</span>
              <input
                value={form.address}
                onChange={e => f({ address: e.target.value })}
                className={`${inputCls} pl-9`} style={inputStyle}
                placeholder="Gedung / Alamat lengkap..."
              />
            </div>
          </div>

          {/* Deskripsi */}
          <div>
            <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
              Deskripsi Kebutuhan
            </label>
            <textarea
              value={form.description}
              onChange={e => f({ description: e.target.value })}
              rows={2}
              className={`${inputCls} resize-none`} style={inputStyle}
              placeholder="Jelaskan kebutuhan / tujuan kegiatan..."
            />
          </div>

          </div>

          {/* ── Kolom 2: jenis pekerjaan & waktu ── */}
          <div className="space-y-3 satulayar:overflow-y-auto satulayar:pr-2 satulayar:min-h-0">
          {/* Kategori */}
          <div>
            <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
              Kategori *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALLOWED_CATEGORIES.map(cat => {
                const c = CATEGORY_CONFIG[cat] ?? {
                  icon: '📁', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)',
                  border: 'rgba(148,163,184,0.3)', accent: '#64748b',
                };
                const sel = form.category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => f({ category: cat })}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all"
                    style={
                      sel
                        ? { borderColor: c.accent, background: c.bg, color: c.color }
                        : { borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', color: '#64748b' }
                    }
                  >
                    <span className="text-xl">{c.icon}</span>
                    <span className="text-sm font-bold leading-tight flex-1">{cat}</span>
                    {sel && (
                      <svg aria-hidden="true" focusable="false" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tipe Produk — WAJIB, untuk auto-routing ke supervisor */}
          <div>
            <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
              Tipe Produk *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {PRODUCT_TYPES.map(pt => {
                const sel = form.product_type === pt;
                return (
                  <button key={pt} type="button" onClick={() => { f({ product_type: pt }); setFormErr(''); }}
                    className="px-3 py-3 rounded-xl border-2 text-center text-sm font-bold transition-all"
                    style={sel
                      ? { borderColor: '#e11d48', background: 'rgba(225,29,72,0.1)', color: '#e11d48' }
                      : { borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', color: '#64748b' }}>
                    {pt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product */}
          <div>
            <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
              Product / Unit (Opsional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2">📦</span>
              <input
                value={form.product}
                onChange={e => f({ product: e.target.value })}
                className={`${inputCls} pl-9`} style={inputStyle}
                placeholder="Contoh: Sony VPL-FHZ85, Samsung IF Series..."
              />
            </div>
          </div>

          {/* Tanggal & Waktu */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                Tanggal Usulan *
              </label>
              <input aria-label="Tanggal Usulan"
                type="date"
                value={form.due_date}
                onChange={e => f({ due_date: e.target.value })}
                className={inputCls} style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                Waktu Usulan
              </label>
              <input aria-label="Waktu Usulan"
                type="time"
                value={form.due_time}
                onChange={e => f({ due_time: e.target.value })}
                className={inputCls} style={inputStyle}
              />
            </div>
          </div>

          {/* ── Usulan Timeline Project Progress ──
              Muncul hanya untuk kategori yang otomatis membuat draft di Project
              Progress. Tanggal Usulan di atas adalah jadwal KUNJUNGAN; yang ini
              rentang PENGERJAAN — dua hal berbeda, jadi ditanyakan terpisah. */}
          {(form.category === 'Konfigurasi' || form.category === 'Konfigurasi & Training') && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(8,145,178,0.07)', border: '1.5px solid rgba(8,145,178,0.3)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📊</span>
                <p className="text-sm font-bold" style={{ color: '#0e7490' }}>Usulan Timeline Pengerjaan</p>
              </div>
              <p className="text-xs mb-3" style={{ color: '#0891b2' }}>
                Perkiraan rentang pengerjaan di lokasi, untuk dipantau di Project Progress.
                Boleh dikosongkan — Admin dapat menetapkannya saat menyetujui request.
              </p>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                    Mulai Pengerjaan
                  </label>
                  <input aria-label="Mulai Pengerjaan" type="date" value={form.progress_start_date}
                    onChange={e => f({ progress_start_date: e.target.value })}
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                    Target Selesai
                  </label>
                  <input aria-label="Target Selesai" type="date" value={form.progress_target_date}
                    min={form.progress_start_date || undefined}
                    onChange={e => f({ progress_target_date: e.target.value })}
                    className={inputCls} style={inputStyle} />
                </div>
              </div>
            </div>
          )}

          {/* Tambah Hari Lain — mini calendar multi-select. Disembunyikan di HP
             (layar sempit → tampilan bertumpuk); hanya muncul di layar sm: ke atas.
             Di HP user cukup submit 1 tanggal (Tanggal Usulan di atas). */}
          <div className="hidden satulayar:block">
            <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
              Tambah Hari Lain (Opsional)
            </label>
            <MultiDatePicker dates={form.extra_dates} onChange={dates => f({ extra_dates: dates })} accentColor="#2563eb" />
          </div>

          </div>

          {/* ── Kolom 3: PIC, catatan & alur ── */}
          <div className="space-y-3 satulayar:overflow-y-auto satulayar:pr-2 satulayar:min-h-0">
          {/* PIC */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                Nama PIC Project
              </label>
              <input
                value={form.pic_name}
                onChange={e => f({ pic_name: e.target.value })}
                className={inputCls} style={inputStyle}
                placeholder="Nama PIC di lokasi..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
                No. Telepon PIC
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2">📱</span>
                <input
                  value={form.pic_phone}
                  onChange={e => f({ pic_phone: e.target.value })}
                  className={`${inputCls} pl-9`} style={inputStyle}
                  placeholder="08xxxxxxxxxx"
                />
              </div>
            </div>
          </div>

          {/* Catatan */}
          <div>
            <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#94a3b8' }}>
              Catatan Tambahan
            </label>
            <textarea
              value={form.notes}
              onChange={e => f({ notes: e.target.value })}
              rows={2}
              className={`${inputCls} resize-none`} style={inputStyle}
              placeholder="Informasi tambahan untuk tim PTS..."
            />
          </div>

          {/* Info approval flow */}
          <div
            className="rounded-xl p-3 flex items-start gap-3"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
          >
            <span className="text-lg flex-shrink-0">ℹ️</span>
            <div>
              <p className="text-xs font-bold text-amber-700">Alur Approval</p>
              <p className="text-[11px] text-amber-600 leading-relaxed mt-0.5">
                Request akan masuk sebagai <strong>Pending</strong> ke Admin.
                Admin akan mereview, menyetujui, dan mengassign ke anggota Team PTS IVP.
                Kamu akan mendapat notifikasi setelah disetujui (WhatsApp/Telegram, sesuai kanal yang aktif).
              </p>
            </div>
          </div>

          </div>
          </div>
        </div>

        {/* Footer tetap — tombol kirim tidak boleh ikut tergulir bersama kolom. */}
        <div className="px-6 py-4 flex-shrink-0 border-t border-slate-200 bg-white/70">
          {formErr && (
            <div className="px-3 py-2 rounded-lg text-xs font-medium text-red-700 bg-red-50 border border-red-200 mb-2">{formErr}</div>
          )}
          {/* Satu baris, rata kanan, seukuran isinya — bukan dua baris tombol
              selebar frame yang membuat Batal terasa sepenting Kirim. */}
          <div className="flex gap-2 justify-end">
            <BatalButton onClick={onClose} />
            <SubmitFormButton
              onClick={handleSubmit}
              loading={submitting}
              disabled={!form.project_name.trim() || !form.address.trim() || (!isInternalSales && !form.brand) || !form.product_type || !form.due_date}
              suffix={(() => {
                const dateCount = new Set([form.due_date, ...form.extra_dates].filter(Boolean)).size || 1;
                return dateCount > 1 ? `${dateCount} Hari` : undefined;
              })()}
              gradient="linear-gradient(135deg,#2563eb,#1d4ed8)"
              shadow="0 4px 14px rgba(37,99,235,0.35)"
            />
          </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
