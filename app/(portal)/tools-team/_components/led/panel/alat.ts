/** Yang dibutuhkan panel Kalkulator LED: keadaan + ekspor. */
import type { KeadaanLED } from '../useKeadaanLED';
import type { useEksporLED } from '../useEksporLED';

export interface AlatLED { K: KeadaanLED; E: ReturnType<typeof useEksporLED> }
