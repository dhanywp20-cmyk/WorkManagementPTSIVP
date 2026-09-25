/**
 * lib/wa-server.ts - di-import route server yang mengirim WA lewat lib/wa.ts.
 * Memasang kirimWA() (token dari Admin Panel) sebagai pengirim sisi server.
 */
import { pasangPengirimServer } from '@/lib/wa';
import { kirimWA } from '@/lib/wa-kirim-server';

pasangPengirimServer(kirimWA);
