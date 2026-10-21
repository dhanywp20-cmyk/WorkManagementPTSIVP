'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, TeamMember } from './shared';
import { SalesPicker, Modal, BatalButton, SubmitFormButton } from '@/components/shared';
import { BRAND_OPTIONS, type Brand } from '@/lib/brand-routing';
import { hasFullAccess } from '@/lib/constants';
import { hitungLingkupProject, filterLingkup } from '@/lib/project-scope';
import { cariReminderByNama, reminderTerbaru } from '@/lib/cari-reminder';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { KolomPenugasanTiket } from './tiket-baru/KolomPenugasanTiket';
import { KolomBarangKeluhan } from './tiket-baru/KolomBarangKeluhan';
import { KolomInfoTiket } from './tiket-baru/KolomInfoTiket';
import { LangkahCariProyek } from './tiket-baru/LangkahCariProyek';
import { LangkahPilihJenis } from './tiket-baru/LangkahPilihJenis';

export interface NewTicketForm {
  project_name: string;
  address: string;
  customer_phone: string;
  sales_name: string;
  sales_division: string;
  /** Id orang di balik sales_name. Kosong bila diketik manual, bukan dipilih. */
  sales_user_id?: string | null;
  sn_unit: string;
  product: string;
  issue_case: string;
  description: string;
  assign_name: string;
  date: string;
  status: string;
  current_team: string;
  photo: File | null;
  reminder_id: string | null;
  brand?: Brand;   // Sales External pilih brand (MVI/IVP/BOTH)  CC ke Sales Internal brand itu
}

export interface ReminderRef {
  id: string;
  /** Nama project bisa tersimpan di sini pada data lama - lihat pencarian di bawah. */
  title?: string;
  /**
   * Asal baris ini. Menentukan apakah ticket baru boleh ditautkan ke reminder:
   * hanya baris dari tabel reminders yang punya reminder_id yang sah. Baris
   * dari tabel tickets cuma dipakai untuk menyalin data project.
   */
  _sumber?: 'reminder' | 'ticket';
  project_name: string;
  address: string;
  sales_name: string;
  sales_division: string;
  product?: string;
  pic_name: string;
  pic_phone: string;
  category: string;
  assign_name: string;
}

interface Props {
  onClose: () => void;
  form: NewTicketForm;
  setForm: (f: NewTicketForm) => void;
  uploading: boolean;
  currentUser: User | null;
  users: User[];
  teamPTSMembers: TeamMember[];
  supervisorMembers?: TeamMember[];
  onSubmit: () => void;
}

export function NewTicketModal({ onClose, form, setForm, uploading, currentUser, users, teamPTSMembers, supervisorMembers = [], onSubmit }: Props) {
  const set = (patch: Partial<NewTicketForm>) => setForm({ ...form, ...patch });

  // Admin/superadmin ATAU Manager PTS boleh tentukan penanganan langsung saat create.
  const canAssignDirect = currentUser?.role === 'admin' || currentUser?.role === 'superadmin'
    || hasFullAccess(currentUser);

  // Creator = Sales Internal (guest)  boleh isi SBU (buat ticket atas nama Sales External).
  const isInternalSalesGuest = currentUser?.role === 'guest' && !!users.find(u => u.id === currentUser.id)?.is_internal_sales;
  // Sales External (guest bukan internal)  WAJIB pilih Brand (menentukan Sales Internal yg di-CC).
  const isExternalGuest = currentUser?.role === 'guest' && !isInternalSalesGuest;
  const externalSalesUsers = users.filter(u => u.role === 'guest' && !u.is_internal_sales && u.id !== currentUser?.id)
    .map(u => ({ id: u.id, full_name: u.full_name, sales_division: u.sales_division ?? null }));

  const [projectType, setProjectType] = useState<'new' | 'existing'>('new');
  /*
    Pemilihan tipe project didahulukan, sebelum form terlihat - dan sekarang
    tiga langkah, bukan dua: pilih tipe -> CARI -> form.

    Sebelumnya memilih "Project yang sudah ada" langsung membuka form penuh
    dengan kotak pencarian sebagai salah satu isiannya - dan form itu berat,
    banyak kolom, sebagian besar kosong sampai project-nya dipilih. Yang
    terlihat pertama kali adalah formulir panjang yang tampak belum diisi,
    bukan alat pencarian. Orang mengira harus mengetik dulu ke kolom-kolom itu.

    Langkah 'cari' memisahkan pencariannya jadi tahap sendiri, ringan, cuma
    berisi kotak cari dan hasilnya. Form penuh baru muncul SETELAH satu project
    dipilih dan dikonfirmasi - jadi begitu formnya terlihat, ia sudah terisi.
  */
  const [langkah, setLangkah] = useState<'pilih' | 'cari' | 'form'>('pilih');
  /** Pilihan yang disorot di langkah 'cari', belum dikonfirmasi ke form. */
  const [praPilih, setPraPilih] = useState<ReminderRef | null>(null);
  const [reminderQuery, setReminderQuery] = useState('');
  const [reminderResults, setReminderResults] = useState<ReminderRef[]>([]);
  const [reminderSearching, setReminderSearching] = useState(false);
  /** Apakah pencarian terakhir benar-benar dipersempit ke divisi si pencari. */
  const [pencarianDibatasi, setPencarianDibatasi] = useState(false);
  /** Pesan galat kueri pencarian, bila basis data menolaknya. */
  const [galatCari, setGalatCari] = useState<string | null>(null);
  const [selectedReminder, setSelectedReminder] = useState<ReminderRef | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Cari project yang sudah ada - WAJIB dibatasi lingkup si pencari. Memilih
   * satu hasil menyalin alamat, PIC, dan nomor teleponnya ke form, jadi
   * pencarian tanpa batas divisi sama saja dengan membuka daftar pelanggan
   * divisi lain. Lingkupnya dihitung di lib/project-scope.ts supaya aturannya
   * satu, bukan diturunkan ulang di tiap tempat yang punya pencarian.
   */
  const searchReminders = useCallback(async (q: string) => {
    // Kueri kosong BUKAN "tidak ada yang dicari" - dipakai untuk menampilkan
    // daftar project terbaru begitu langkah 'cari' dibuka, sebelum siapa pun
    // mengetik apa pun. Tanpa ini, langkah 'cari' membuka kotak kosong yang
    // menyuruh orang mengetik dulu baru terlihat sesuatu, padahal daftar
    // project terbaru sudah cukup untuk kebanyakan kasus.
    const kosong = !q.trim();
    setReminderSearching(true);
    const lingkup = await hitungLingkupProject(currentUser as never);

    // Tickets: project yang pernah punya ticket
    // Tabel ini sebelumnya tidak ikut dicari sama sekali. Padahal project yang
    // sudah pernah bermasalah justru yang paling mungkin dibuatkan ticket lagi,
    // dan datanya cuma ada di sini kalau ia tidak pernah lewat Request Schedule.
    let qt = supabase
      .from('tickets')
      .select('id, project_name, address, sales_name, sales_division, product, customer_phone, assign_name');
    if (!kosong) {
      qt = qt.ilike('project_name', `%${q.trim().replace(/([%_\\])/g, '\\$1')}%`);
    }

    const filter = filterLingkup(lingkup);
    setPencarianDibatasi(!!filter);
    if (filter) { qt = qt.or(filter); }

    // Reminders: SEMUA kategori, lewat lib/cari-reminder.ts.
    //
    // Daftar kolom di bawah sengaja TIDAK memuat `title`. Kolom itu tidak ada
    // di basis data ini - menyebutnya, walau cuma di daftar select, membuat
    // PostgREST menolak seluruh kueri dengan "column reminders.title does not
    // exist", dan penolakan itu tampil sebagai "project tidak ditemukan".
    const kolomReminder = 'id, project_name, address, sales_name, sales_division, product, pic_name, pic_phone, category, assign_name';
    const [rRes, tRes] = await Promise.all([
      kosong
        ? reminderTerbaru<ReminderRef>(
            kolomReminder,
            20,
            kueri => (filter ? (kueri as { or(f: string): typeof kueri }).or(filter) : kueri),
          )
        : cariReminderByNama<ReminderRef>(
            q,
            kolomReminder,
            15,
            kueri => (filter ? (kueri as { or(f: string): typeof kueri }).or(filter) : kueri),
          ),
      qt.order('created_at', { ascending: false }).limit(kosong ? 20 : 15),
    ]);

    // Galat TIDAK ditelan. Pencarian yang ditolak basis data dan pencarian yang
    // memang nihil terlihat sama persis dari luar, dan yang pertama menyesatkan.
    setGalatCari(rRes.error?.message ?? (tRes.error ? tRes.error.message : null));

    const hasil: ReminderRef[] = [];
    const sudah = new Set<string>();
    const tambah = (r: ReminderRef) => {
      // Satu project bisa muncul di kedua tabel - disatukan berdasarkan nama +
      // alamat supaya daftarnya tidak memuat baris kembar yang membingungkan.
      // Spasinya ikut diratakan: "Jl.Parangtritis" dan "Jl. Parangtritis"
      // adalah alamat yang sama, dan tanpa perataan ini keduanya lolos sebagai
      // dua pilihan identik - lalu orang memilih salah satunya secara acak,
      // yang berarti nama project pada ticket ikut jadi acak.
      const rapikan = (v: string) => v.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
      const kunci = `${rapikan(r.project_name || r.title || '')}|${rapikan(r.address || '')}`;
      if (sudah.has(kunci)) return;
      sudah.add(kunci);
      hasil.push(r);
    };
    for (const r of (rRes.data ?? []) as ReminderRef[]) tambah({ ...r, _sumber: 'reminder' });
    for (const t of (tRes.data ?? []) as Record<string, unknown>[]) {
      tambah({
        id: String(t.id), project_name: String(t.project_name ?? ''), title: undefined,
        address: String(t.address ?? ''), sales_name: String(t.sales_name ?? ''),
        sales_division: String(t.sales_division ?? ''), product: String(t.product ?? ''),
        pic_name: '', pic_phone: String(t.customer_phone ?? ''),
        category: 'Ticket', assign_name: String(t.assign_name ?? ''),
        _sumber: 'ticket',
      });
    }
    setReminderResults(hasil.slice(0, 12));
    setReminderSearching(false);
  }, [currentUser]);

  const handleQueryChange = (q: string) => {
    setReminderQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchReminders(q), 300);
  };

  const selectReminder = (r: ReminderRef) => {
    setSelectedReminder(r);
    setReminderResults([]);
    setReminderQuery('');
    setForm({
      ...form,
      project_name: r.project_name || (r as { title?: string }).title || '',
      address: r.address || '',
      sales_name: r.sales_name || '',
      sales_division: r.sales_division || '',
      product: r.product || '',
      customer_phone: r.pic_phone || '',
      assign_name: r.assign_name || form.assign_name,
      // Hanya baris dari tabel reminders yang boleh menautkan reminder_id.
      // Memakai id ticket di sini akan menunjuk ke baris yang tidak ada di
      // tabel reminders - tautannya rusak, dan sinkronisasi progress ikut salah.
      reminder_id: r._sumber === 'ticket' ? null : r.id,
    });
  };

  const switchProjectType = (type: 'new' | 'existing') => {
    setProjectType(type);
    setSelectedReminder(null);
    setPraPilih(null);
    setReminderQuery('');
    setReminderResults([]);
    if (type === 'new') {
      setForm({ ...form, project_name: '', address: '', sales_name: '', sales_division: '', product: '', customer_phone: '', assign_name: '', reminder_id: null });
    }
  };

  /** Sorot pilihan di langkah 'cari' - BELUM mengisi form. Itu baru terjadi saat "OK, Isi Form". */
  const sorotPilihan = (r: ReminderRef) => setPraPilih(r);

  /** Konfirmasi: baru di sinilah form terisi dan langkahnya berpindah. */
  const konfirmasiPilihan = () => {
    if (!praPilih) return;
    selectReminder(praPilih);
    setLangkah('form');
  };

  // Begitu langkah 'cari' dibuka, langsung tampilkan project terbaru - senada
  // dengan Reminder Schedule, yang menampilkan daftar tanpa menunggu ketikan.
  useEffect(() => {
    if (langkah === 'cari') searchReminders('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langkah]);

  if (langkah === 'pilih') return (
    <LangkahPilihJenis
      onClose={onClose} setLangkah={setLangkah} switchProjectType={switchProjectType}
    />
  );

  if (langkah === 'cari') return (
    <>
      <LangkahCariProyek
        galatCari={galatCari} handleQueryChange={handleQueryChange} konfirmasiPilihan={konfirmasiPilihan} onClose={onClose} pencarianDibatasi={pencarianDibatasi} praPilih={praPilih} reminderQuery={reminderQuery} reminderResults={reminderResults} reminderSearching={reminderSearching} setLangkah={setLangkah} setPraPilih={setPraPilih} setReminderQuery={setReminderQuery} setReminderResults={setReminderResults} sorotPilihan={sorotPilihan}
      />
    </>
  );

  return (
  //  Kerangka Modal bersama (judul, tombol tutup, Esc, lapisan) - dulu kepala bergradasi merah sendiri.
  //  Footer milik Modal: tombol Buat Ticket tidak ikut tergulir bersama kolom.
  <Modal buka onTutup={onClose} judul="Buat Ticket Baru" keterangan="Isi detail ticket & informasi troubleshooting" ukuran="penuh" tutupDiLuar={false}
    footer={<>
      <BatalButton onClick={onClose} />
      <SubmitFormButton
        onClick={() => { if (isExternalGuest && !form.brand) return; onSubmit(); }}
        loading={uploading}
        disabled={isExternalGuest && !form.brand}
        blockedLabel={isExternalGuest && !form.brand ? "Pilih Brand dulu" : undefined}
      />
    </>}>
          {/* Tiga kolom menyamping — pola yang sama dengan form Request Schedule. Di bawah xl satu kolom. */}
          <div className="grid grid-cols-1 satulayar:grid-cols-3 gap-5">

          {/* ── Kolom 1: ticket ini tentang apa ── */}
          <KolomInfoTiket
            form={form} galatCari={galatCari} handleQueryChange={handleQueryChange} isExternalGuest={isExternalGuest} pencarianDibatasi={pencarianDibatasi} projectType={projectType} reminderQuery={reminderQuery} reminderResults={reminderResults} reminderSearching={reminderSearching} selectReminder={selectReminder} selectedReminder={selectedReminder} set={set} setSelectedReminder={setSelectedReminder} switchProjectType={switchProjectType}
          />

          {/* ── Kolom 2: barang & keluhannya ── */}
          <KolomBarangKeluhan
            form={form} set={set}
          />

          {/* ── Kolom 3: penugasan & lampiran ── */}
          <KolomPenugasanTiket
            canAssignDirect={canAssignDirect} currentUser={currentUser} externalSalesUsers={externalSalesUsers} form={form} isInternalSalesGuest={isInternalSalesGuest} set={set} supervisorMembers={supervisorMembers} teamPTSMembers={teamPTSMembers} users={users}
          />
          </div>
  </Modal>
  );
}
