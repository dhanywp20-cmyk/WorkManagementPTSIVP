'use client';

import { createContext, useContext } from 'react';
import { ReviewForm } from './shared';

export interface NilaiKonteksDaftarReview {
  nilai: {
    fetchError: string | null;
    filterCategory: "Demo Product" | "BAST" | "all";
    filterReviewCat: "Demo Product" | "BAST" | "all";
    filteredReviews: ReviewForm[];
    hal: import("@/components/shared/Paginasi").HasilPaginasi<ReviewForm>;
    isAdmin: boolean;
    listLoading: boolean;
    reviews: ReviewForm[];
    searchHandler: string;
    searchProject: string;
    searchSalesName: string;
    selectMode: boolean;
    selectedIds: Set<string>;
    switchTab: "Demo Product" | "BAST";
    tableReviews: ReviewForm[];
  };
  ubah: {
    setDetailReview: import("react").Dispatch<import("react").SetStateAction<ReviewForm | null>>;
    setFetchError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
    setFilterCategory: import("react").Dispatch<import("react").SetStateAction<"Demo Product" | "BAST" | "all">>;
    setFilterReviewCat: import("react").Dispatch<import("react").SetStateAction<"Demo Product" | "BAST" | "all">>;
    setSearchHandler: import("react").Dispatch<import("react").SetStateAction<string>>;
    setSearchProject: import("react").Dispatch<import("react").SetStateAction<string>>;
    setSearchSalesName: import("react").Dispatch<import("react").SetStateAction<string>>;
  };
  aksi: {
    bolehEditReview: (r: ReviewForm) => boolean;
    fetchReviews: () => Promise<void>;
    openDeleteModal: (r: ReviewForm) => void;
    openEdit: (r: ReviewForm) => void;
    toggleSelectAll: () => void;
    toggleSelectId: (id: string) => void;
  };
}

export const KonteksDaftarReview = createContext<NilaiKonteksDaftarReview | null>(null);

export function useKonteksDaftarReview(): NilaiKonteksDaftarReview {
  const k = useContext(KonteksDaftarReview);
  if (!k) throw new Error('useKonteksDaftarReview harus di dalam <KonteksDaftarReview.Provider>');
  return k;
}
