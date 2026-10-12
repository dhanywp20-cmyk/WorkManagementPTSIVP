'use client';

/** useAkunTicketing - dipecah dari app/(portal)/ticketing/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { adminCreateUser } from '@/lib/admin-users';
import { User } from './shared';

export interface AkunTicketingKonteks {
  changePassword: { current: string; new: string; confirm: string; };
  fetchData: (userOverride?: User | null, silent?: boolean) => Promise<void>;
  newUser: { username: string; password: string; full_name: string; team_member: string; role: string; team_type: string; };
  notify: (type: "success" | "error", msg: string) => void;
  selectedUserForPassword: string;
  setChangePassword: import("react").Dispatch<import("react").SetStateAction<{ current: string; new: string; confirm: string; }>>;
  setNewUser: import("react").Dispatch<import("react").SetStateAction<{ username: string; password: string; full_name: string; team_member: string; role: string; team_type: string; }>>;
  setSelectedUserForPassword: import("react").Dispatch<import("react").SetStateAction<string>>;
  users: User[];
}

export function useAkunTicketing(k: AkunTicketingKonteks) {
  const { changePassword, fetchData, newUser, notify, selectedUserForPassword, setChangePassword, setNewUser, setSelectedUserForPassword, users } = k;
  const createUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.full_name) { notify("error", "All fields must be filled!"); return; }
    const lowerUsername = newUser.username.toLowerCase();
    let finalTeamType = newUser.team_type;
    if (newUser.role === "guest") finalTeamType = "Guest";
    else if (newUser.role === "admin") finalTeamType = "Team PTS IVP";
    try {
      const { id: newId, error: userError } = await adminCreateUser({ username: lowerUsername, full_name: newUser.full_name, role: newUser.role, team_type: finalTeamType });
      if (userError) throw userError;
      // Password ke user_credentials via server route (dibaca login), bukan kolom legacy.
      if (newId && newUser.password) {
        const credRes = await fetch('/api/auth/set-credential', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: newId, password: newUser.password }),
        });
        if (!credRes.ok) { const j = await credRes.json().catch(() => ({})); throw new Error(j.error || 'Gagal set password'); }
      }
      // team_members table tidak digunakan - data handler dari tabel users langsung
      setNewUser({ username: "", password: "", full_name: "", team_member: "", role: "team", team_type: "Team PTS IVP" });
      await fetchData();
      notify("success", "User created successfully!");
    } catch (err: any) { notify("error", "Error: " + err.message); }
  };

  const updatePassword = async () => {
    if (!selectedUserForPassword) { notify("error", "Select user first!"); return; }
    if (!changePassword.current || !changePassword.new || !changePassword.confirm) { notify("error", "All fields must be filled!"); return; }
    if (changePassword.new !== changePassword.confirm) { notify("error", "New password does not match!"); return; }
    try {
      const selectedUser = users.find((u) => u.id === selectedUserForPassword);
      if (!selectedUser) { notify("error", "User not found!"); return; }
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserForPassword, currentPassword: changePassword.current, newPassword: changePassword.new }),
      });
      const result = await res.json();
      if (!res.ok) { notify("error", result.error || "Gagal mengubah password."); return; }
      notify("success", "Password changed successfully!");
      setChangePassword({ current: "", new: "", confirm: "" });
      setSelectedUserForPassword("");
    } catch (err: any) { notify("error", "Error: " + err.message); }
  };
  return { createUser, updatePassword };
}
