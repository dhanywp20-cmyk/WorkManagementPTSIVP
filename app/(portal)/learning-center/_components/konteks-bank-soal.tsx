'use client';

import { createContext, useContext } from 'react';
import { Material, Question, FolderNode, DialogState } from './shared';

export interface NilaiKonteksBankSoal {
  nilai: {
    currentFolderNode: FolderNode | null;
    editQ: Question | null;
    expandedBatches: Set<string>;
    filteredQuestions: Question[];
    generatePanelJSX: import("react").JSX.Element;
    kolomUrutanAda: boolean;
    menyimpanUrutan: string | null;
    questions: Question[];
    search: string;
    selectedMat: string;
    selectedSubFolder: string | null;
    showGenerate: boolean;
    subFolders: string[];
    urutanDraf: Record<string, string[]>;
    viewMaterials: Material[];
  };
  ubah: {
    setDialog: import("react").Dispatch<import("react").SetStateAction<DialogState>>;
    setEditQ: import("react").Dispatch<import("react").SetStateAction<Question | null>>;
    setExpandedBatches: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
    setRenameFolder: import("react").Dispatch<import("react").SetStateAction<{ oldName: string; newName: string; } | null>>;
    setSelectedMat: import("react").Dispatch<import("react").SetStateAction<string>>;
    setSelectedSubFolder: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  };
  aksi: {
    buangDraf: (kunci: string) => void;
    bukaTambahDiGrup: (materialId: string, batchKey: string) => void;
    geserSoal: (kunci: string, grup: Question[], idx: number, arah: -1 | 1) => void;
    handleDelete: (id: string) => void;
    handleDeleteMatGroup: (matId: string, matName: string) => void;
    handleSaveEdit: () => Promise<void>;
    load: () => Promise<void>;
    simpanUrutan: (kunci: string, susunan: Question[]) => Promise<void>;
    susunanTampil: (kunci: string, grup: Question[]) => Question[];
  };
}

export const KonteksBankSoal = createContext<NilaiKonteksBankSoal | null>(null);

export function useKonteksBankSoal(): NilaiKonteksBankSoal {
  const k = useContext(KonteksBankSoal);
  if (!k) throw new Error('useKonteksBankSoal harus di dalam <KonteksBankSoal.Provider>');
  return k;
}
