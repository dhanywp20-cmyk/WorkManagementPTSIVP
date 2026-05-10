'use client';
import { useState, useEffect } from 'react';

export interface CurrentUser {
  id?: string;
  username?: string;
  full_name?: string;
  role?: string;
  team_type?: string;
  [key: string]: any;
}

/**
 * Membaca currentUser dari localStorage. Pola yang dipakai di SEMUA platform.
 * Mengembalikan object user atau null jika belum login.
 */
export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);
  useEffect(() => {
    try {
      const s = localStorage.getItem('currentUser');
      if (s) setUser(JSON.parse(s));
    } catch {}
  }, []);
  return user;
}

export function isAdminRole(user: CurrentUser | null): boolean {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  return role === 'admin' || role === 'superadmin';
}
