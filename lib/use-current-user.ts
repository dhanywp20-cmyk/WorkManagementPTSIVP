'use client';
import { useState, useEffect } from 'react';
import { getSession } from './auth/sesi';

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
  access_level?: string;
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
