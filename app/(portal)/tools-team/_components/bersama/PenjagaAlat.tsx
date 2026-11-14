'use client';
import { Component, type ReactNode } from 'react';

type Props = { nama: string; children: ReactNode };
type State = { galat: Error | null };

const chunkHilang = (e: Error) => /ChunkLoadError|Loading chunk|dynamically imported module|Failed to fetch/i.test(`${e.name} ${e.message}`);

export class PenjagaAlat extends Component<Props, State> {
  state: State = { galat: null };

  static getDerivedStateFromError(galat: Error): State {
    return { galat };
  }

  render() {
    const { galat } = this.state;
    if (!galat) return this.props.children;
    const versiBaru = chunkHilang(galat);
    return (
      <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 space-y-3">
        <p className="text-[14px] font-bold text-rose-800">{this.props.nama} gagal dimuat</p>
        <p className="text-[13px] text-rose-700">
          {versiBaru ? 'Aplikasi baru saja diperbarui. Muat ulang halaman untuk memakai versi terbaru.' : 'Terjadi kesalahan di alat ini. Alat lain tetap bisa dipakai; isian yang tersimpan otomatis tidak hilang.'}
        </p>
        <p className="text-[11.5px] font-mono text-rose-600 break-all">{galat.message.slice(0, 200)}</p>
        <div className="flex flex-wrap gap-2">
          {!versiBaru && (
            <button type="button" onClick={() => this.setState({ galat: null })}
              className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-[13px] font-bold text-rose-700 hover:bg-rose-100">
              Coba lagi
            </button>
          )}
          <button type="button" onClick={() => window.location.reload()}
            className="rounded-lg bg-rose-700 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-rose-800">
            Muat ulang halaman
          </button>
        </div>
      </div>
    );
  }
}
