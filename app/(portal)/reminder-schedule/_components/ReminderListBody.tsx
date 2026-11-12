'use client';
import { useRouter } from 'next/navigation';
import { ErrorState, ListEmptyState, usePaginasi } from '@/components/shared';
import { hasFullAccess } from '@/lib/constants';
import { useKonteksJadwal } from './konteks-jadwal';
import { TabelJadwal } from './TabelJadwal';
import { DaftarJadwalHp } from './DaftarJadwalHp';

export function ReminderListBody() {
  const k = useKonteksJadwal();
  const { currentUser, isAdmin, isManager } = k.sesi;
  const { bolehEditReminder, canInternalApprove, canApproveAssign } = k.izin;
  const { fetchError, setFetchError, fetchReminders, listLoading, filteredReminders, reminders, groupedReminders, guestUsers } = k.data;
  const {
    filterStatus, filterYear, filterCategory, productFilter, setProductFilter, searchProject, searchSales, searchDivisionSales, searchTeamHandler, searchProduct,
    setFilterStatus, setFilterYear, setFilterCategory, setSearchProject, setSearchSales, setSearchDivisionSales, setSearchTeamHandler, setSearchProduct
  } = k.filter;
  const { selectMode, selectedIds, setSelectedIds, toggleSelectAll } = k.pilih;
  const {
    setDetailReminder, setRescheduleTarget, setInternalApproveTarget, handleInternalReject, setApproveTarget, setApproveBatchSiblings, setApproveAssignTo,
    setApproveDate, setApproveTime, handleAdminReject, openSupervisorAssign, syncKeIncentive, syncing, openDeleteModal
  } = k.aksi;
  const bolehLewatiReview = isAdmin || hasFullAccess(currentUser as never);
  const router = useRouter();

  const hal = usePaginasi(groupedReminders);

  return (
    <>
      {fetchError ? (
        <ErrorState message={fetchError} onRetry={() => { setFetchError(null); fetchReminders(); }} />
      ) : listLoading ? (
        <div className="space-y-2 p-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse flex gap-3 items-center bg-white/60 rounded-xl p-3 border border-gray-200">
              <div className="flex-1 space-y-2"><div className="h-3 bg-gray-200 rounded-sm w-2/5"></div><div className="h-2 bg-gray-100 rounded-sm w-1/4"></div></div>
              <div className="h-3 bg-gray-200 rounded-sm w-1/6"></div><div className="h-3 bg-gray-200 rounded-sm w-1/5"></div>
              <div className="h-5 bg-gray-200 rounded-full w-16"></div><div className="h-6 bg-gray-200 rounded-lg w-14"></div>
            </div>
          ))}
        </div>
      ) : filteredReminders.length === 0 ? (
        <ListEmptyState
          adaFilterAktif={
            filterStatus !== 'all' || filterYear !== 'all' || filterCategory !== 'all'
            || productFilter !== null
            || [searchProject, searchSales, searchDivisionSales, searchTeamHandler, searchProduct]
                 .some(v => v.trim() !== '')
          }
          onReset={() => {
            setFilterStatus('all'); setFilterYear('all'); setFilterCategory('all');
            setProductFilter(null);
            setSearchProject(''); setSearchSales(''); setSearchDivisionSales('');
            setSearchTeamHandler(''); setSearchProduct('');
          }}
          icon="🗓️"
          judulKosong="Belum ada reminder"
          deskripsiKosong="Jadwal yang dibuat atau di-request akan muncul di sini."
        />
      ) : (
        <>
        <DaftarJadwalHp
          hal={hal} setDetailReminder={setDetailReminder} bolehEditReminder={bolehEditReminder} setRescheduleTarget={setRescheduleTarget} canInternalApprove={canInternalApprove} setInternalApproveTarget={setInternalApproveTarget}
          handleInternalReject={handleInternalReject} canApproveAssign={canApproveAssign} bolehLewatiReview={bolehLewatiReview} setApproveTarget={setApproveTarget} setApproveBatchSiblings={setApproveBatchSiblings} setApproveAssignTo={setApproveAssignTo}
          setApproveDate={setApproveDate} setApproveTime={setApproveTime} handleAdminReject={handleAdminReject} currentUser={currentUser} openSupervisorAssign={openSupervisorAssign} isAdmin={isAdmin}
          isManager={isManager} syncKeIncentive={syncKeIncentive} syncing={syncing} openDeleteModal={openDeleteModal} groupedReminders={groupedReminders} filteredReminders={filteredReminders}
        />

        <TabelJadwal
          selectMode={selectMode} isAdmin={isAdmin} isManager={isManager} selectedIds={selectedIds} filteredReminders={filteredReminders} toggleSelectAll={toggleSelectAll}
          hal={hal} setSelectedIds={setSelectedIds} setProductFilter={setProductFilter} productFilter={productFilter} router={router} guestUsers={guestUsers}
          setDetailReminder={setDetailReminder} bolehEditReminder={bolehEditReminder} setRescheduleTarget={setRescheduleTarget} canInternalApprove={canInternalApprove} setInternalApproveTarget={setInternalApproveTarget} handleInternalReject={handleInternalReject}
          canApproveAssign={canApproveAssign} bolehLewatiReview={bolehLewatiReview} setApproveTarget={setApproveTarget} setApproveBatchSiblings={setApproveBatchSiblings} setApproveAssignTo={setApproveAssignTo} setApproveDate={setApproveDate}
          setApproveTime={setApproveTime} handleAdminReject={handleAdminReject} currentUser={currentUser} openSupervisorAssign={openSupervisorAssign} syncKeIncentive={syncKeIncentive} syncing={syncing}
          openDeleteModal={openDeleteModal} groupedReminders={groupedReminders} reminders={reminders}
        />
        </>
      )}
    </>
  );
}
