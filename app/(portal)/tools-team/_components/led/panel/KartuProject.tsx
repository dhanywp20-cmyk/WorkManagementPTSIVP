'use client';
import { Kartu } from '../../bersama/ui';
import { Teks } from './komponen';
import { AksiFile } from './AksiFile';
import type { AlatLED } from './alat';

export function KartuProject({ a, polos }: { a: AlatLED; polos?: boolean }) {
  const { customer, pembuat, project, refHilang, setCustomer, setPembuat, setProject, setTanggal, tanggal } = a.K;
  return (
    <>
      <Kartu judul="Informasi project" polos={polos} aksi=<AksiFile a={a} />>
        {refHilang.length > 0 && (
          <p role="alert" className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
            <b>{refHilang.join(', ')}</b> tidak ada di referensi Anda, jadi hitungan memakai pengganti dan hasilnya bisa berbeda.
            Minta pembuat berkas membuka lalu menyimpan ulang berkas ini (spesifikasinya akan ikut tersimpan), atau tambahkan lewat Referensi.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Teks label="Nama project" nilai={project} onUbah={setProject} />
          <Teks label="Customer" nilai={customer} onUbah={setCustomer} />
          <Teks label="Tanggal" nilai={tanggal} onUbah={setTanggal} tipe="date" />
          <Teks label="Dibuat oleh" nilai={pembuat} onUbah={setPembuat} />
        </div>
      </Kartu>
    </>
  );
}
