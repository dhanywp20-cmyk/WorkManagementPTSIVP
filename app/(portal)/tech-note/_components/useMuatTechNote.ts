'use client';

/** useMuatTechNote - dipecah dari app/(portal)/tech-note/_components/bagian-tech-note.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import React, { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { TechNoteFolder, TechNote } from './shared';
import { User } from '@/app/(portal)/dashboard/_components/shared';

export interface MuatTechNoteKonteks {
  canManage: boolean;
  currentUser: User | null;
  setFetchError: React.Dispatch<React.SetStateAction<string | null>>;
  setFolders: React.Dispatch<React.SetStateAction<TechNoteFolder[]>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setTechnotes: React.Dispatch<React.SetStateAction<TechNote[]>>;
  year: number;
}

export function useMuatTechNote(k: MuatTechNoteKonteks) {
  const { canManage, currentUser, setFetchError, setFolders, setLoading, setTechnotes, year } = k;
  const fetchFolders = useCallback(async () => {
    const { data } = await supabase.from('tech_note_folders').select('*').order('name');
    setFolders((data ?? []) as TechNoteFolder[]);
  }, []);

  const fetchNotes = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setFetchError(null);

    // Aturan visibilitas Tech Note
    // Admin/supervisor: semua tech note (untuk bisa melakukan approval)
    // Team/user biasa:
    //   - Semua tech note yang sudah APPROVED (visible ke semua)
    //   - Tech note milik sendiri dengan status apapun (pending, revision, rejected)

    if (canManage) {
      // Admin: ambil semua tech note tahun ini
      const { data, error } = await supabase
        .from('tech_notes')
        .select('*')
        .gte('submitted_at', `${year}-01-01`)
        .lte('submitted_at', `${year}-12-31T23:59:59`)
        .order('submitted_at', { ascending: false });
      // Tanpa ini, gagal fetch (RLS, jaringan putus, dst) tampil identik
      // dengan "memang belum ada tech note" - tidak ada tanda apa pun ke user
      // bahwa datanya sebenarnya gagal dimuat, bukan kosong.
      if (error) setFetchError(error.message);
      setTechnotes((data ?? []) as TechNote[]);
    } else {
      // Team user: ambil (approved semua orang) UNION (milik sendiri apapun statusnya)
      const [approvedRes, mineRes] = await Promise.all([
        supabase
          .from('tech_notes')
          .select('*')
          .eq('status', 'approved')
          .gte('submitted_at', `${year}-01-01`)
          .lte('submitted_at', `${year}-12-31T23:59:59`),
        supabase
          .from('tech_notes')
          .select('*')
          .eq('author_id', currentUser.id)
          .neq('status', 'approved')          // approved sudah diambil di atas
          .gte('submitted_at', `${year}-01-01`)
          .lte('submitted_at', `${year}-12-31T23:59:59`),
      ]);
      if (approvedRes.error || mineRes.error) {
        setFetchError((approvedRes.error ?? mineRes.error)!.message);
      }

      const approved = (approvedRes.data ?? []) as TechNote[];
      const mine     = (mineRes.data ?? []) as TechNote[];

      // Gabungkan, hilangkan duplikat berdasarkan id
      const seen = new Set<string>();
      const merged: TechNote[] = [];
      for (const n of [...approved, ...mine]) {
        if (!seen.has(n.id)) { seen.add(n.id); merged.push(n); }
      }
      // Urutkan: terbaru dulu
      merged.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
      setTechnotes(merged);
    }

    setLoading(false);
  }, [year, currentUser, canManage]);
  return { fetchFolders, fetchNotes };
}
