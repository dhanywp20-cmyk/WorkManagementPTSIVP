'use client';

/** FormEditAkunInline - dipecah dari app/(portal)/dashboard/_components/modal-akun.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { User, JABATAN_LIST, JABATAN_CONFIG, ALL_MENU_KEYS } from '../shared';
import { IkonTeks } from '@/components/shared/Ikon';
import { Ikon } from '@/components/shared/Ikon';
import React from 'react';

export interface FormEditAkunInlineProps {
  MenuPermissionSelector: ({ selected, target }: { selected: string[]; target: "new" | "edit"; }) => React.JSX.Element;
  daftarDivisi: string[];
  editAccessLevel: "full" | "guest";
  editBisaDitugaskan: boolean;
  editDivisi: string;
  editPtsDaerah: string;
  editPtsType: string;
  editingUser: User;
  kelompokPTSList: import("@/lib/kelompok").Kelompok[];
  setEditAccessLevel: React.Dispatch<React.SetStateAction<"full" | "guest">>;
  setEditBisaDitugaskan: React.Dispatch<React.SetStateAction<boolean>>;
  setEditDivisi: React.Dispatch<React.SetStateAction<string>>;
  setEditPtsDaerah: React.Dispatch<React.SetStateAction<string>>;
  setEditPtsType: React.Dispatch<React.SetStateAction<string>>;
  setEditingUser: React.Dispatch<React.SetStateAction<User | null>>;
}

export function FormEditAkunInline({ MenuPermissionSelector, daftarDivisi, editAccessLevel, editBisaDitugaskan, editDivisi, editPtsDaerah, editPtsType, editingUser, kelompokPTSList, setEditAccessLevel, setEditBisaDitugaskan, setEditDivisi, setEditPtsDaerah, setEditPtsType, setEditingUser }: FormEditAkunInlineProps) {
  return (
    <>
      <div className="grid grid-cols-1 formulir:grid-cols-3 gap-3">
        <div>
          <label htmlFor="f-dashboard-components-modal-akun-20" className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Full Name</label>
          <input id="f-dashboard-components-modal-akun-20" value={editingUser.full_name} onChange={e => setEditingUser({ ...editingUser, full_name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" />
        </div>
        <div>
          <label htmlFor="f-dashboard-components-modal-akun-21" className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Username</label>
          <input id="f-dashboard-components-modal-akun-21" value={editingUser.username} onChange={e => setEditingUser({ ...editingUser, username: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" />
        </div>
        <div>
          <label htmlFor="f-dashboard-components-modal-akun-22" className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Password</label>
          <input id="f-dashboard-components-modal-akun-22" value={editingUser.password} onChange={e => setEditingUser({ ...editingUser, password: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" />
        </div>
        <div>
          <label htmlFor="f-dashboard-components-modal-akun-23" className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Role</label>
          <select id="f-dashboard-components-modal-akun-23" value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
            <option value="superadmin">Superadmin</option><option value="admin">Admin</option><option value="team">Team</option><option value="guest">Guest</option>
          </select>
        </div>
        <div className="formulir:col-span-3">
          <label htmlFor="f-dashboard-components-modal-akun-24" className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Divisi</label>
          <select id="f-dashboard-components-modal-akun-24" value={editDivisi} onChange={e => { setEditDivisi(e.target.value); setEditPtsType(''); }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
            <option value="">-- Pilih Divisi --</option>
            <option value="PTS">PTS</option>
            <option value="Sales">Sales</option>
            <option value="Marketing">Marketing</option>
          </select>
        </div>
        {editDivisi === 'PTS' && (
          <div className="formulir:col-span-3">
            <label htmlFor="f-dashboard-components-modal-akun-25" className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Tipe PTS</label>
            <select id="f-dashboard-components-modal-akun-25" value={editPtsType} onChange={e => setEditPtsType(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
              <option value="">-- Pilih Tipe PTS --</option>
              {kelompokPTSList.map(k => <option key={k.nama} value={k.label}>{k.label} → {k.nama}</option>)}
            </select>
          </div>
        )}
        {editDivisi === 'PTS' && kelompokPTSList.find(k => k.label === editPtsType)?.cabang && (
          <div className="formulir:col-span-3">
            <label htmlFor="f-dashboard-components-modal-akun-26" className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Alamat Daerah *</label>
            <input id="f-dashboard-components-modal-akun-26" value={editPtsDaerah} onChange={e => setEditPtsDaerah(e.target.value)}
              placeholder="Contoh: Surabaya, Bandung, Medan..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" />
            <p className="text-[11px] text-slate-500 mt-1">Otomatis mengisi Daerah/Kota saat dipilih di dropdown PTS Cabang, Reminder Schedule.</p>
          </div>
        )}
        {(editDivisi === 'Sales' || editDivisi === 'Marketing') && (
          <div className="formulir:col-span-3">
            <label htmlFor="f-dashboard-components-modal-akun-27" className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Sales Division</label>
            <select id="f-dashboard-components-modal-akun-27" value={editingUser.sales_division || ''} onChange={e => setEditingUser({ ...editingUser, sales_division: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
              <option value="">-- Pilih Divisi Sales --</option>{daftarDivisi.map(div => <option key={div} value={div}>{div}</option>)}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="f-dashboard-components-modal-akun-28" className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest">Jabatan</label>
          <select id="f-dashboard-components-modal-akun-28" value={editingUser.jabatan || ''} onChange={e => setEditingUser({ ...editingUser, jabatan: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 bg-white">
            <option value="">— Pilih Jabatan —</option>{JABATAN_LIST.map(j => <option key={j} value={j}>{JABATAN_CONFIG[j].icon} {j}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-dashboard-components-modal-akun-29" className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest"><IkonTeks nama="📱" />No. Telepon / WA</label>
          <input id="f-dashboard-components-modal-akun-29" value={editingUser.phone_number || ''} onChange={e => setEditingUser({ ...editingUser, phone_number: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400" placeholder="Contoh: 08123456789" />
        </div>
        {/* AKSES — dulu tombol di kolom tabel tersendiri. Dipindah ke sini
            supaya perubahannya melewati "Simpan Perubahan" seperti field lain,
            bukan berubah seketika begitu tersenggol di daftar. */}
        {editingUser.role === 'team' && (
          <div className="formulir:col-span-3">
            <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest"><IkonTeks nama="🔑" />Akses Platform</label>
            <div className="flex gap-2">
              {([
                { v: 'guest' as const, icon: '🔒', label: 'Guest',       desc: 'Hanya data miliknya sendiri' },
                { v: 'full'  as const, icon: '🔓', label: 'Full Access', desc: 'Setara admin di modul data' },
              ]).map(o => (
                <button key={o.v} type="button" onClick={() => setEditAccessLevel(o.v)}
                  className={`flex-1 text-left px-3 py-2 rounded-lg border-2 transition-all ${
                    editAccessLevel === o.v
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}>
                  <span className="block text-sm font-bold"><Ikon nama={o.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {o.label}</span>
                  <span className="block text-[11px] mt-0.5 opacity-80">{o.desc}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Full Access memberi akses setara admin pada modul <strong>data</strong> (Ticketing,
              Request Schedule, Piket Showroom, KPI Team, dll) — termasuk edit detail &amp; re-route.
              Hak kelola akun tetap hanya admin/superadmin.
            </p>
          </div>
        )}
        {/* BISA DITUGASKAN — memisahkan "punya wewenang" dari "ikut
            mengerjakan". Sebelumnya Ticketing mengecualikan Manager
            lewat jabatan yang dipaku di kode, sementara Reminder
            Schedule & Design Project tidak mengecualikan siapa pun -
            sehingga Supervisor bisa (dan pernah) meng-assign
            pekerjaan ke Manager karena namanya memang ditawarkan. */}
        {editingUser.role === 'team' && (
          <div className="formulir:col-span-3">
            <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest"><IkonTeks nama="🎯" />Penerima Tugas</label>
            <div className="flex gap-2">
              {([
                { v: true,  icon: '🛠️', label: 'Bisa ditugaskan',   desc: 'Muncul di dropdown assign' },
                { v: false, icon: '🚫', label: 'Tidak ditugaskan',  desc: 'Menyetujui, bukan mengerjakan' },
              ]).map(o => (
                <button key={String(o.v)} type="button" onClick={() => setEditBisaDitugaskan(o.v)}
                  className={`flex-1 text-left px-3 py-2 rounded-lg border-2 transition-all ${
                    editBisaDitugaskan === o.v
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}>
                  <span className="block text-sm font-bold"><Ikon nama={o.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {o.label}</span>
                  <span className="block text-[11px] mt-0.5 opacity-80">{o.desc}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Menentukan apakah namanya ditawarkan saat assign pekerjaan di <strong>Ticketing,
              Reminder Schedule, dan Request Design</strong>. Matikan untuk akun yang perannya
              menyetujui &amp; mengarahkan — ia tetap bisa approve, re-route, dan melihat semuanya.
            </p>
          </div>
        )}
        {/* PIKET SHOWROOM — hanya untuk akun non-PTS. Tim PTS yang
            bertugas piket selalu melihat seluruh catatan dan boleh
            mengisinya, jadi kontrol ini tidak berarti apa-apa untuk
            mereka.

            DUA pengaturan terpisah: apa yang DILIHAT (bawaan semua
            catatan; "Sesuai divisi" untuk akun yang harus dibatasi)
            dan apa yang BOLEH DILAKUKAN (bawaan lihat & export saja).
            Keduanya dijaga di database (migrasi 032 & 033), bukan
            hanya disembunyikan tombolnya. */}
        {editingUser.role !== 'team' && (
          <div className="formulir:col-span-3 space-y-3">
            <div>
            <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest"><IkonTeks nama="🏪" />Piket Showroom — Yang Dilihat</label>
            <div className="flex gap-2">
              {([
                { v: 'semua'   as const, icon: '🏪', label: 'Semua catatan', desc: 'Bawaan — seluruh catatan tamu showroom' },
                { v: 'lingkup' as const, icon: '🔒', label: 'Sesuai divisi', desc: 'Dibatasi: hanya atas namanya / divisinya' },
              ]).map(o => {
                const aktif = (editingUser.piket_akses === 'lingkup' ? 'lingkup' : 'semua') === o.v;
                return (
                  <button key={o.v} type="button"
                    onClick={() => setEditingUser({ ...editingUser, piket_akses: o.v === 'semua' ? null : 'lingkup' })}
                    className={`flex-1 text-left px-3 py-2 rounded-lg border-2 transition-all ${
                      aktif ? 'bg-teal-50 border-teal-400 text-teal-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}>
                    <span className="block text-sm font-bold"><Ikon nama={o.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {o.label}</span>
                    <span className="block text-[11px] mt-0.5 opacity-80">{o.desc}</span>
                  </button>
                );
              })}
            </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest"><IkonTeks nama="✍" />Piket Showroom — Yang Boleh Dilakukan</label>
              <div className="flex gap-2">
                {([
                  { v: false, icon: '👁', label: 'Lihat & export saja', desc: 'Bawaan — tidak bisa mengisi, menyunting, atau menghapus' },
                  { v: true,  icon: '✍', label: 'Boleh mengisi & menyunting', desc: 'Bisa mengisi / menyunting kegiatan piket' },
                ]).map(o => {
                  const aktif = (editingUser.piket_ubah === true) === o.v;
                  return (
                    <button key={String(o.v)} type="button"
                      onClick={() => setEditingUser({ ...editingUser, piket_ubah: o.v })}
                      className={`flex-1 text-left px-3 py-2 rounded-lg border-2 transition-all ${
                        aktif ? 'bg-teal-50 border-teal-400 text-teal-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}>
                      <span className="block text-sm font-bold"><Ikon nama={o.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {o.label}</span>
                      <span className="block text-[11px] mt-0.5 opacity-80">{o.desc}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Export Excel selalu tersedia bagi yang bisa melihat. Mengatur jadwal &amp; hari libur tetap hanya Admin / Full Access.
                Pengaturan ini dijaga di database, bukan hanya menyembunyikan tombol.
              </p>
            </div>
          </div>
        )}
        {/* AKUN PIMPINAN (mis. Direktur) — hanya untuk akun non-PTS (dibuat sebagai Marketing). Melihat
            SEMUA data di setiap menu tanpa saringan "milik saya", tetapi hanya baca. Dijaga di database
            (migrasi 034), bukan hanya menyembunyikan tombol. */}
        {editingUser.role !== 'team' && (
          <div className="formulir:col-span-3">
            <label className="block text-xs font-bold mb-1 text-slate-600 uppercase tracking-widest"><IkonTeks nama="👔" />Pimpinan</label>
            <div className="flex gap-2">
              {([
                { v: false, icon: '👤', label: 'Akun biasa',   desc: 'Melihat sesuai peran & divisinya' },
                { v: true,  icon: '👔', label: 'Pimpinan — lihat semua', desc: 'Semua daftar terlihat, hanya baca (tanpa tambah/ubah/hapus)' },
              ]).map(o => {
                const aktif = (editingUser.pimpinan === true) === o.v;
                return (
                  <button key={String(o.v)} type="button"
                    onClick={() => setEditingUser({ ...editingUser, pimpinan: o.v })}
                    className={`flex-1 text-left px-3 py-2 rounded-lg border-2 transition-all ${
                      aktif ? 'bg-indigo-50 border-indigo-400 text-indigo-800' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}>
                    <span className="block text-sm font-bold"><Ikon nama={o.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {o.label}</span>
                    <span className="block text-[11px] mt-0.5 opacity-80">{o.desc}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Untuk Direktur / atasan tertinggi: buat sebagai <strong>Marketing</strong>, lalu aktifkan ini. Otomatis <strong>tidak di bawah atasan mana pun,
              tidak masuk KPI, dan tidak ditawarkan saat assign pekerjaan</strong>. Menu yang tampil tetap diatur lewat daftar menu di bawah.
            </p>
          </div>
        )}
        <div className="formulir:col-span-3">
          {MenuPermissionSelector({ selected: editingUser.allowed_menus ?? ALL_MENU_KEYS, target: "edit" })}
        </div>
      </div>
    </>
  );
}
