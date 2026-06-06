'use client';
import { useState, useEffect } from 'react';
import { getSession } from './auth';

export interface CurrentUser {
  id?: string;
  username?: string;
  full_name?: string;
  role?: string;
  team_type?: string;
  jabatan?: string;
  sales_division?: string;
  phone_number?: string;
  allowed_menus?: string[];
  [key: string]: unknown;
}

/**
 * Membaca currentUser dari session (localStorage).
 * Pola yang dipakai di SEMUA platform.
 * Mengembalikan object user atau null jika belum login / expired.
 */
export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);
  useEffect(() => {
    const u = getSession<CurrentUser>();
    if (u) setUser(u);
  }, []);
  return user;
}

// Legacy helper — tetap ada agar import lama tidak rusak
export function isAdminRole(user: CurrentUser | null): boolean {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  return role === 'admin' || role === 'superadmin';
}
