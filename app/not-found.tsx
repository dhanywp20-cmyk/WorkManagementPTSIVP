import Link from 'next/link';

export default function TidakDitemukan() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-slate-200 p-6 text-center">
        <p className="text-4xl font-black text-slate-300">404</p>
        <h1 className="text-base font-bold text-slate-800 mt-2">Halaman tidak ditemukan</h1>
        <Link href="/dashboard"
          className="mt-5 inline-flex px-4 py-2 rounded-lg text-sm font-bold text-white bg-rose-600 hover:bg-rose-700">
          Ke Dashboard
        </Link>
      </div>
    </div>
  );
}
