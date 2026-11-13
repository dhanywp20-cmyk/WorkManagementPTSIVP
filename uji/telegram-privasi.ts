import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean) => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}`); } };
const baca = (f: string) => readFileSync(f, 'utf8');

function semua(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? semua(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

const SERVER = /^(app[\\/]api[\\/]|lib[\\/](notifikasi[\\/]telegram-server|checklist[\\/]server|kesehatan[\\/]server))/;
const klien = [...semua('app'), ...semua('lib'), ...semua('components')].filter(f => !SERVER.test(f));
const bocor = klien.filter(f => baca(f).includes('telegram_chat_id'));
cek(`kode klien tidak membaca telegram_chat_id (${bocor.join(', ') || 'bersih'})`, bocor.length === 0);

const rute = baca('app/api/notifikasi/telegram/route.ts');
cek('kirim ke nomor: chat ID dicari di server', /body\.nomor[\s\S]*kirimTelegramKeNomorServer/.test(rute));
cek('chat ID bebas hanya untuk admin / chat grup pengaturan', /!admin && chatId !== \(await bacaPengaturan\(true\)\)\.telegramChatId/.test(rute));

const mig = baca('supabase/migrations/074_sembunyikan_chat_telegram_dan_sesi_30_hari.sql');
cek('migrasi mencabut SELECT telegram_chat_id dari anon/authenticated', /revoke select on public\.users from anon, authenticated/.test(mig) && /column_name <> 'telegram_chat_id'/.test(mig));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
