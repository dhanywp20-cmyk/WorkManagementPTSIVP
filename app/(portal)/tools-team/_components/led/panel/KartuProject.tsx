'use client';
/** Kartu informasi project & file aktif. */
import { Kartu } from '../../bersama/ui';
import { Teks } from './komponen';
import { AksiFile } from './AksiFile';
import type { AlatLED } from './alat';

export function KartuProject({ a }: { a: AlatLED }) {
  const { customer, fileAktif, pembuat, project, setCustomer, setPembuat, setProject, setTanggal, tanggal } = a.K;
  return (
    <>
      <Kartu judul="Informasi project" aksi=<AksiFile a={a} />>
        {fileAktif && (
          <p className="-mt-1 mb-2 text-[11.5px] text-slate-600 truncate">File: <b className="text-slate-800">{fileAktif.nama}</b>{!fileAktif.bolehUbah && ' · milik anggota lain (simpan = salinan)'}</p>
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
