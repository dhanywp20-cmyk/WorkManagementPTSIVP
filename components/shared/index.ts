// Shared UI Components
// Pattern standar dipakai di semua platform KECUALI piket-showroom.
// Basis: ticketing platform.

export { MiniPieChart } from './MiniPieChart';
// Grafik deret waktu. Lihat Charts.tsx.
export { MiniSpark, MonthBarChart, DonutChart, TrendBadge, hitungDelta } from './Charts';
export {
  ViewIconBtn, EditIconBtn, DeleteIconBtn, RescheduleIconBtn,
  DuplicateIconBtn, CompleteIconBtn, ActionGroup,
  FlowchartIconBtn, PrintIconBtn, ApproveIconBtn, ReopenIconBtn, OverdueIconBtn,
} from './ActionIcons';
export { Toast, InlineToast, type Notif } from './Toast';
export { LoadingScreen, InlineSpinner } from './LoadingScreen';
export { FormField, SectionHeader, SectionHeaderSmall, InfoRow, InfoLine } from './FormParts';
export { StarRating } from './StarRating';
export { PageHeader } from './PageHeader';
export { SalesPicker, type SalesPickerUser } from './SalesPicker';
export { ConfirmDialog, type ConfirmState } from './ConfirmDialog';
export { LoadingSpinner, EmptyState, ListEmptyState, ErrorState } from './EmptyState';
// Riwayat perubahan sebuah record, dari yang dicatat logAudit().
export { AuditTrailPanel, type AuditEntry } from './AuditTrailPanel';
// Diagram tahapan untuk alur bertahap, mis. routing_status Request Schedule.
export { FlowSteps, type FlowStep } from './FlowSteps';
export { MultiDatePicker } from './MultiDatePicker';
export { MobileListCard, MobileCardBadge, type MobileCardField } from './MobileListCard';
// Username kadang berupa nama pendek, kadang berupa email penuh. Awalan @ hanya
// dipasang pada yang pertama - lihat catatan di Username.tsx.
export { Username, formatUsername } from './Username';
// Kartu ringkasan angka - satu implementasi untuk semua modul, supaya gayanya
// tidak menyimpang lagi seperti saat markup-nya disalin per halaman.
export { StatCard, StatCardGrid, type StatCardItem } from './StatCard';
export { ModalPortal } from './ModalPortal';
export { AdminEditFields } from './AdminEditFields';
// Tombol penutup form. Satu tempat supaya label "Submit Form" tidak menyimpang
// lagi jadi "Save Ticket"/"Tambah Reminder" di modul yang berbeda.
export { BatalButton, SubmitFormButton } from './FormActions';
// Logo & identitas merek (bisa diubah dari Admin Panel - lihat lib/merek.ts).
export { LogoMerek } from './LogoMerek';
// Kerangka modal baku - lihat komentar di Modal.tsx sebelum membuat popup baru.
export { Modal, TombolModal, type ModalProps } from './Modal';
// Paginasi daftar - satu mekanisme & satu angka baris/halaman untuk semua
// modul. Lihat catatan di Paginasi.tsx.
export { Paginasi, usePaginasi, BARIS_PER_HALAMAN, type HasilPaginasi } from './Paginasi';
// Bootstrap PWA - daftar service worker + banner "Pasang aplikasi ke HP".
// Dipasang sekali di root layout, bukan per-modul.
export { PwaBootstrap } from './PwaBootstrap';
// Keping identitas build (versi · commit · waktu bangun) - lihat ChipVersi.tsx.
export { ChipVersi } from './ChipVersi';
// Bilah kaki platform (hak cipta - kontak bantuan - identitas build).
export { FooterPlatform } from './FooterPlatform';
export { Ikon, IkonTeks, ikonUntuk } from './Ikon';
