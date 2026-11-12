'use client';
import { useState, useEffect } from 'react';
import { getSession } from './auth/sesi';

export interface CurrentUser {
  id?: string;
  username?: string;
  full_name?: string;
  role?: string | null;
  team_type?: string | null;
  jabatan?: string | null;
  sales_division?: string | null;
  phone_number?: string | null;
  allowed_menus?: string[] | null;
  access_level?: string | null;
  [key: string]: unknown;
}

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);
  useEffect(() => {
    const u = getSession<CurrentUser>();
    if (u) setUser(u);
  }, []);
  return user;
}

export function isAdminRole(user: CurrentUser | null): boolean {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  return role === 'admin' || role === 'superadmin';
}
