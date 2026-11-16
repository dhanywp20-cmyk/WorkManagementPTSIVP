'use client';
import { Kartu } from '../../bersama/ui';
import { Teks } from './komponen';
import { AksiFile } from './AksiFile';
import type { AlatLED } from './alat';

export function KartuProject({ a }: { a: AlatLED }) {
  const { customer, pembuat, project, setCustomer, setPembuat, setProject, setTanggal, tanggal } = a.K;
  return (
    <>
      <Kartu judul="Informasi project" aksi=<AksiFile a={a} />>
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
