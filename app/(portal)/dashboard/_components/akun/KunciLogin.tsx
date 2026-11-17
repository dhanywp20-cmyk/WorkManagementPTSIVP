'use client';

export function LencanaKunci({ sampai }: { sampai: string | null }) {
  if (!sampai) return null;
  const jam = new Date(sampai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return (
    <span className="inline-block mt-1 px-1.5 py-0.5 rounded-full whitespace-nowrap text-[10px] font-bold bg-amber-100 text-amber-800" title="Terlalu banyak salah password">
      🔒 Terkunci s/d {jam}
    </span>
  );
}

export function TombolBukaKunci({ tampil, sibuk, onClick }: { tampil: boolean; sibuk: boolean; onClick: () => void }) {
  if (!tampil) return null;
  return (
    <button onClick={onClick} disabled={sibuk}
      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-all disabled:opacity-60 whitespace-nowrap">
      {sibuk ? 'Membuka…' : 'Buka Kunci'}
    </button>
  );
}
