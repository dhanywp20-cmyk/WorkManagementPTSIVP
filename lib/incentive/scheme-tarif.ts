export interface ItemTarif { kode: string; label: string; min: number; max: number }
export interface KategoriTarif { kode: string; label: string; item: ItemTarif[] }
export interface ItemCue { kode: string; label: string; nominal: number }
export interface TarifInsentif {
  persenNetProfitA: number;
  kategori: KategoriTarif[];
  cue: { dasar: number; item: ItemCue[] };
}

const tetap = (kode: string, label: string, n: number): ItemTarif => ({ kode, label, min: n, max: n });
const rentang = (kode: string, label: string, min: number, max: number): ItemTarif => ({ kode, label, min, max });
const jt = (n: number) => n * 1_000_000;

export const TARIF_BAWAAN: TarifInsentif = {
  persenNetProfitA: 1,
  kategori: [
    { kode: 'led', label: 'LED', item: [tetap('vx', 'VX / TU sederhana', 500_000), tetap('h', 'H series / advanced', jt(1.5))] },
    { kode: 'videowall', label: 'Videowall', item: [
      tetap('4-9', '4–9 panel', jt(1)), tetap('10-16', '10–16 panel', jt(2)),
      tetap('17-30', '17–30 panel', jt(3)), tetap('>30', '>30 panel', jt(5)),
    ] },
    { kode: 'projector', label: 'Projector', item: [
      tetap('1', '1 unit', 500_000), tetap('2-3', '2–3 unit', jt(1)), tetap('4-6', '4–6 unit', jt(2)),
      rentang('blending', 'Projection Blending', jt(2), jt(3)), rentang('immersive', 'Immersive Projection', jt(3), jt(5)),
    ] },
    { kode: 'avoip', label: 'AV over IP', item: [rentang('avoip', 'AV over IP', jt(2), jt(5))] },
    { kode: 'matrix', label: 'Matrix', item: [
      tetap('standalone', 'Standalone', 500_000), tetap('endpoint', '+ Endpoint', jt(1)),
      rentang('controller', '+ Controller & programming', jt(1.5), jt(2)),
    ] },
    { kode: 'vp', label: 'Video Processor', item: [
      tetap('standalone', 'Standalone', 750_000), tetap('display', '+ Display', jt(1)),
      tetap('videowall', '+ Videowall', jt(2)), tetap('led', '+ LED', jt(2)),
    ] },
    { kode: 'ifp', label: 'IFP / Signage', item: [
      tetap('1-5', '1–5 unit', 500_000), tetap('6-10', '6–10 unit', jt(1)), tetap('11-20', '11–20 unit', jt(1.5)),
      tetap('21-50', '21–50 unit', jt(2.5)), tetap('>50', '>50 unit', jt(4)),
    ] },
    { kode: 'smr', label: 'Smart Meeting Room', item: [rentang('tunggal', 'Perangkat tunggal', 250_000, 500_000)] },
    { kode: 'hospitality', label: 'Hospitality TV', item: [
      tetap('1-50', '1–50 unit', jt(1)), tetap('51-100', '51–100 unit', jt(2)), tetap('101-250', '101–250 unit', jt(3)),
      tetap('251-500', '251–500 unit', jt(5)), tetap('501-800', '501–800 unit', jt(7.5)), tetap('>800', '>800 unit', jt(10)),
    ] },
  ],
  cue: {
    dasar: jt(1),
    item: [
      { kode: 'single', label: 'Display / Projector / Sensor / Camera single', nominal: 250_000 },
      { kode: 'multi', label: 'Matrix / VP / Lighting / DSP / Camera multi', nominal: 500_000 },
      { kode: 'tracking', label: 'Camera tracking', nominal: 750_000 },
      { kode: 'otomasi', label: 'Automation kompleks / API cloud', nominal: jt(1) },
    ],
  },
};

export function rapikanTarif(raw: unknown): TarifInsentif {
  const r = (raw ?? {}) as Partial<TarifInsentif>;
  return {
    persenNetProfitA: typeof r.persenNetProfitA === 'number' ? r.persenNetProfitA : TARIF_BAWAAN.persenNetProfitA,
    kategori: Array.isArray(r.kategori) && r.kategori.length ? r.kategori : TARIF_BAWAAN.kategori,
    cue: r.cue && Array.isArray(r.cue.item) ? r.cue : TARIF_BAWAAN.cue,
  };
}

export function periksaTarif(t: TarifInsentif): string[] {
  const masalah: string[] = [];
  if (!(t.persenNetProfitA > 0 && t.persenNetProfitA <= 100)) masalah.push('Persen Net Profit Level A harus di antara 0 dan 100.');
  for (const k of t.kategori) {
    for (const i of k.item) {
      if (!(i.min > 0) || !(i.max >= i.min)) masalah.push(`Tarif ${k.label} · ${i.label}: minimal harus > 0 dan maksimal ≥ minimal.`);
    }
  }
  if (!(t.cue.dasar >= 0)) masalah.push('Base Cue System tidak boleh negatif.');
  for (const i of t.cue.item) if (!(i.nominal > 0)) masalah.push(`Tarif Cue · ${i.label} harus > 0.`);
  return masalah;
}

export type LevelProyek = 'A' | 'B' | 'C' | 'D';
export const DAFTAR_LEVEL: LevelProyek[] = ['A', 'B', 'C', 'D'];

export interface CakupanKategori { kategori: string; item: string; nominal?: number | null }
export interface CakupanCue { item: string; jumlah: number }

export interface PenetapanLevel {
  level: LevelProyek;
  cakupan: CakupanKategori[];
  cue?: CakupanCue[];
  netProfit?: number | null;
}

export interface HasilLevel {
  nominal: number | null;
  persenNetProfit: number | null;
  flatTertinggi: number;
  dipakai: 'net_profit' | 'flat' | 'cue';
  menungguNetProfit: boolean;
  masalah: string[];
}

export function cariItem(t: TarifInsentif, kategori: string, item: string): { k: KategoriTarif; i: ItemTarif } | null {
  const k = t.kategori.find(x => x.kode === kategori);
  const i = k?.item.find(x => x.kode === item);
  return k && i ? { k, i } : null;
}

export function nilaiItem(t: TarifInsentif, c: CakupanKategori): { nilai: number; masalah: string | null } {
  const ada = cariItem(t, c.kategori, c.item);
  if (!ada) return { nilai: 0, masalah: `Item tarif ${c.kategori}/${c.item} tidak dikenal.` };
  const { k, i } = ada;
  if (i.min === i.max) return { nilai: i.min, masalah: null };
  const n = Number(c.nominal);
  if (!Number.isFinite(n) || n < i.min || n > i.max) {
    return { nilai: 0, masalah: `${k.label} · ${i.label}: pilih nominal pasti antara Rp ${i.min.toLocaleString('id-ID')} dan Rp ${i.max.toLocaleString('id-ID')}.` };
  }
  return { nilai: Math.round(n), masalah: null };
}

export function hitungNominalLevel(t: TarifInsentif, p: PenetapanLevel): HasilLevel {
  const masalah: string[] = [];
  if (p.level === 'D') {
    let total = t.cue.dasar;
    for (const c of p.cue ?? []) {
      const item = t.cue.item.find(x => x.kode === c.item);
      const jumlah = Math.floor(Number(c.jumlah));
      if (!item) { masalah.push(`Item Cue "${c.item}" tidak dikenal.`); continue; }
      if (!(jumlah >= 0)) { masalah.push(`Jumlah ${item.label} tidak sah.`); continue; }
      total += item.nominal * jumlah;
    }
    return { nominal: masalah.length ? null : total, persenNetProfit: null, flatTertinggi: 0, dipakai: 'cue', menungguNetProfit: false, masalah };
  }

  const kategoriDipakai = new Set<string>();
  let flatTertinggi = 0;
  for (const c of p.cakupan) {
    if (kategoriDipakai.has(c.kategori)) {
      masalah.push(`Kategori ${c.kategori} dipilih lebih dari sekali — satu kategori cukup satu item (tidak dijumlahkan).`);
      continue;
    }
    kategoriDipakai.add(c.kategori);
    const { nilai, masalah: m } = nilaiItem(t, c);
    if (m) masalah.push(m);
    flatTertinggi = Math.max(flatTertinggi, nilai);
  }
  if (p.cakupan.length === 0) masalah.push('Pilih minimal satu kategori yang tercakup.');
  if (p.level !== 'A') {
    return { nominal: masalah.length ? null : flatTertinggi, persenNetProfit: null, flatTertinggi, dipakai: 'flat', menungguNetProfit: false, masalah };
  }

  const np = p.netProfit;
  if (np == null || !Number.isFinite(Number(np))) {
    return { nominal: null, persenNetProfit: null, flatTertinggi, dipakai: 'flat', menungguNetProfit: true, masalah };
  }
  if (Number(np) < 0) masalah.push('Net Profit tidak boleh negatif.');
  const persenNetProfit = Math.round((Number(np) * t.persenNetProfitA) / 100);
  const dipakai = persenNetProfit >= flatTertinggi ? 'net_profit' : 'flat';
  return {
    nominal: masalah.length ? null : Math.max(persenNetProfit, flatTertinggi),
    persenNetProfit, flatTertinggi, dipakai, menungguNetProfit: false, masalah,
  };
}
