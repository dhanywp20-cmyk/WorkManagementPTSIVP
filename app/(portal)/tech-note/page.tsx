'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { bisaDiklik } from '@/components/shared/bisaDiklik';
import { useSearchParams } from 'next/navigation';
import { PageHeader, ListEmptyState, ModalPortal, ConfirmDialog, type ConfirmState, ErrorState, Toast, type Notif } from '@/components/shared';
import { supabase } from '@/lib/supabase';
import { User } from '@/app/(portal)/dashboard/_components/shared';
import { getSession, startSessionWatcher } from '@/lib/auth';
import {
  TechNoteFolder, TechNote, TechNoteHistory,
  STATUS_CONFIG, ACTION_CONFIG, KKM_REQUIRED,
  formatDate, formatDateShort, getInitials,
} from './_components/shared';
import { logAudit } from '@/lib/audit';
import { sendWANotif } from '@/lib/wa';
import { createNotification, createNotificationForAdmins } from '@/lib/notifications';
import { hasFullAccess } from '@/lib/constants';
import { appLink } from '@/lib/app-url';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { DOMAIN_ONEDRIVE, linkOneDriveSah, hrefAman, Spinner, Avatar, StatusBadge, TechNoteKPISummary, KATEGORI_FOLDER, KategoriFolder, FolderSidebar, HistoryTimeline, Modal, Field, inputCls, TechNotePageInner } from './_components/bagian-tech-note';

/*
  useSearchParams() (dipakai deep-link ?open= di dalam) WAJIB berada di dalam
  batas Suspense - tanpa itu Next.js menolak halaman ini saat prerender.
  Pola yang sama dipakai app/ticketing/page.tsx.
*/
export default function TechNotePage() {
  return (
    <Suspense>
      <TechNotePageInner />
    </Suspense>
  );
}
