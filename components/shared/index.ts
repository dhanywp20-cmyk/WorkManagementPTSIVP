// ─── Shared UI Components ────────────────────────────────────────────────────
// Pattern standar dipakai di semua platform KECUALI piket-showroom.
// Basis: ticketing platform.

export { MiniPieChart } from './MiniPieChart';
// Grafik deret waktu — sebelumnya terkunci di dalam app/kpi-team/ dan MiniSpark
// disalin tiga kali (dua di antaranya di dalam fungsi komponen). Lihat Charts.tsx.
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
// Riwayat perubahan sebuah record. logAudit() dipanggil dari 14 berkas tapi
// sampai komponen ini ada hanya satu layar yang pernah membacanya kembali.
export { AuditTrailPanel } from './AuditTrailPanel';
// Diagram tahapan untuk alur bertahap. Alur Request Schedule sebelumnya hanya
// hidup di kolom routing_status — tidak pernah tergambar di layar mana pun.
export { FlowSteps, type FlowStep } from './FlowSteps';
export { MultiDatePicker } from './MultiDatePicker';
export { MobileListCard, MobileCardBadge, type MobileCardField } from './MobileListCard';
// Username kadang berupa nama pendek, kadang berupa email penuh. Awalan @ hanya
// dipasang pada yang pertama — lihat catatan di Username.tsx.
export { Username, formatUsername } from './Username';
