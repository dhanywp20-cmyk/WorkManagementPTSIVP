'use client';
import { ModalPortal } from '@/components/shared';
import type { User } from './shared';

/** Bentuk state form buat-akun/ganti-password di page.tsx - dioper ke sini apa adanya. */
export type NewUserForm = {
  username: string; password: string; full_name: string;
  team_member: string; role: string; team_type: string;
};
export type ChangePasswordForm = { current: string; new: string; confirm: string };

/**
 * Modal "Account Management" (buat akun, ganti password, daftar user) -
 * dipindah dari app/ticketing/page.tsx apa adanya (JSX identik). State &
 * handler tetap di page.tsx, komponen ini murni presentasional.
 */
export function AccountSettingsModal({
  newUser, setNewUser, createUser,
  selectedUserForPassword, setSelectedUserForPassword,
  changePassword, setChangePassword, updatePassword,
  users, onClose,
}: {
  newUser: NewUserForm;
  setNewUser: (v: NewUserForm) => void;
  createUser: () => void;
  selectedUserForPassword: string;
  setSelectedUserForPassword: (v: string) => void;
  changePassword: ChangePasswordForm;
  setChangePassword: (v: ChangePasswordForm) => void;
  updatePassword: () => void;
  users: User[];
  onClose: () => void;
}) {
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-5xl w-full max-h-full overflow-y-auto p-6" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(75,85,99,0.3)" }}>
          <div className="flex justify-between items-center mb-6 sticky top-0 z-10 bg-white/95 backdrop-blur-sm -mx-6 px-6 py-3 border-b border-gray-100"><h2 className="text-2xl font-bold text-gray-800">⚙️ Account Management</h2><button aria-label="Tutup" onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl font-bold">✕</button></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)" }}><h3 className="font-bold mb-4 text-blue-900">➕ Create New Account</h3><div className="space-y-3"><input aria-label="Username" type="text" placeholder="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /><input aria-label="Password" type="password" placeholder="Password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /><input aria-label="Full Name" type="text" placeholder="Full Name" value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /><select aria-label="Role" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }}><option value="admin">Administrator</option><option value="team">Team</option><option value="guest">Guest</option></select>{newUser.role === "team" && (<select aria-label="Team" value={newUser.team_type} onChange={(e) => setNewUser({ ...newUser, team_type: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }}><option value="Team PTS IVP">Team PTS IVP</option><option value="Team Services">Team Services</option></select>)}<button onClick={createUser} className="w-full bg-gradient-to-r from-blue-600 to-blue-800 text-white py-3 rounded-xl hover:from-blue-700 hover:to-blue-900 font-bold transition-all">➕ Create Account</button></div></div>
            <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)" }}><h3 className="font-bold mb-4 text-orange-900">🔒 Change Password</h3><div className="space-y-3"><select aria-label="Pilih akun" value={selectedUserForPassword} onChange={(e) => { setSelectedUserForPassword(e.target.value); setChangePassword({ current: "", new: "", confirm: "" }); }} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }}><option value="">Select User</option>{users.map((u) => (<option key={u.id} value={u.id}>{u.full_name} ({u.username})</option>))}</select>{selectedUserForPassword && (<><input aria-label="Password lama" type="password" placeholder="Old Password" value={changePassword.current} onChange={(e) => setChangePassword({ ...changePassword, current: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /><input aria-label="New Password" type="password" placeholder="New Password" value={changePassword.new} onChange={(e) => setChangePassword({ ...changePassword, new: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /><input aria-label="Confirm Password" type="password" placeholder="Confirm Password" value={changePassword.confirm} onChange={(e) => setChangePassword({ ...changePassword, confirm: e.target.value })} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /><button onClick={updatePassword} className="w-full bg-gradient-to-r from-orange-600 to-orange-800 text-white py-3 rounded-xl hover:from-orange-700 hover:to-orange-900 font-bold transition-all">🔒 Change Password</button></>)}</div></div>
          </div>
          <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)" }}><h3 className="font-bold mb-4 text-gray-800">👥 User List</h3><div className="max-h-[400px] overflow-y-auto"><div className="space-y-2">{users.map((u) => (<div key={u.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex justify-between items-center"><div><p className="font-bold text-sm">{u.full_name}</p><p className="text-xs text-gray-600">{u.username}</p></div><div className="flex gap-2"><span className={`text-xs px-2 py-1 rounded ${u.role === "admin" ? "bg-red-100 text-red-800" : u.role === "team" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}`}>{u.role === "admin" ? "Admin" : u.role === "team" ? "Team" : "Guest"}</span>{u.team_type && <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800">{u.team_type}</span>}</div></div>))}</div></div></div>
        </div>
      </div>
    </ModalPortal>
  );
}
