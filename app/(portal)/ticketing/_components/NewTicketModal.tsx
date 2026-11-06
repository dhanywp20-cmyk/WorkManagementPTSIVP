'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { User, TeamMember } from './shared';
import { SalesPicker, Modal, BatalButton, SubmitFormButton } from '@/components/shared';
import { BRAND_OPTIONS, type Brand } from '@/lib/brand-routing';
import { hasFullAccess } from '@/lib/constants';
import { hitungLingkupProject, filterLingkup } from '@/lib/project-scope';
import { cariReminderByNama, reminderTerbaru } from '@/lib/jadwal/cari-reminder';
import { gabungHasilProyek } from '@/lib/gabung-hasil-proyek';
import { kategoriInsentif } from '@/lib/incentive/scheme-kategori';
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
  brand?: Brand;
}

export interface ReminderRef {
  id: string;
  title?: string;
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
  due_date?: string | null;
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

  const canAssignDirect = currentUser?.role === 'admin' || currentUser?.role === 'superadmin'
    || hasFullAccess(currentUser);

  const isInternalSalesGuest = currentUser?.role === 'guest' && !!users.find(u => u.id === currentUser.id)?.is_internal_sales;
  const isExternalGuest = currentUser?.role === 'guest' && !isInternalSalesGuest;
  const externalSalesUsers = users.filter(u => u.role === 'guest' && !u.is_internal_sales && u.id !== currentUser?.id)
    .map(u => ({ id: u.id, full_name: u.full_name, sales_division: u.sales_division ?? null }));

  const [projectType, setProjectType] = useState<'new' | 'existing'>('new');
  const [langkah, setLangkah] = useState<'pilih' | 'cari' | 'form'>('pilih');
  const [praPilih, setPraPilih] = useState<ReminderRef | null>(null);
  const [reminderQuery, setReminderQuery] = useState('');
  const [reminderResults, setReminderResults] = useState<ReminderRef[]>([]);
  const [reminderSearching, setReminderSearching] = useState(false);
  const [pencarianDibatasi, setPencarianDibatasi] = useState(false);
  const [galatCari, setGalatCari] = useState<string | null>(null);
  const [selectedReminder, setSelectedReminder] = useState<ReminderRef | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchReminders = useCallback(async (q: string) => {
    const kosong = !q.trim();
    setReminderSearching(true);
    const lingkup = await hitungLingkupProject(currentUser as never);

    const filter = filterLingkup(lingkup);
    setPencarianDibatasi(!!filter);

    const kolomReminder = 'id, project_name, address, sales_name, sales_division, product, pic_name, pic_phone, category, assign_name, due_date';
    const kategori = kategoriInsentif();
    type Kueri = { in(k: string, v: string[]): Kueri; or(f: string): Kueri };
    const batasi = <Q,>(kueri: Q): Q => {
      const k = (kueri as unknown as Kueri).in('category', kategori);
      return (filter ? k.or(filter) : k) as unknown as Q;
    };
    const rRes = kosong
      ? await reminderTerbaru<ReminderRef>(kolomReminder, 20, batasi)
      : await cariReminderByNama<ReminderRef>(q, kolomReminder, 15, batasi);

    setGalatCari(rRes.error?.message ?? null);

    const jadwal = ((rRes.data ?? []) as ReminderRef[]).map(r => ({ ...r, _sumber: 'reminder' as const }));
    setReminderResults(gabungHasilProyek(jadwal, [], 15));
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

  const sorotPilihan = (r: ReminderRef) => setPraPilih(r);

  const konfirmasiPilihan = () => {
    if (!praPilih) return;
    selectReminder(praPilih);
    setLangkah('form');
  };

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
          <div className="grid grid-cols-1 satulayar:grid-cols-3 gap-5">

          <KolomInfoTiket
            form={form} galatCari={galatCari} handleQueryChange={handleQueryChange} isExternalGuest={isExternalGuest} pencarianDibatasi={pencarianDibatasi} projectType={projectType} reminderQuery={reminderQuery} reminderResults={reminderResults} reminderSearching={reminderSearching} selectReminder={selectReminder} selectedReminder={selectedReminder} set={set} setSelectedReminder={setSelectedReminder} switchProjectType={switchProjectType}
          />

          <KolomBarangKeluhan
            form={form} set={set}
          />

          <KolomPenugasanTiket
            canAssignDirect={canAssignDirect} currentUser={currentUser} externalSalesUsers={externalSalesUsers} form={form} isInternalSalesGuest={isInternalSalesGuest} set={set} supervisorMembers={supervisorMembers} teamPTSMembers={teamPTSMembers} users={users}
          />
          </div>
  </Modal>
  );
}
