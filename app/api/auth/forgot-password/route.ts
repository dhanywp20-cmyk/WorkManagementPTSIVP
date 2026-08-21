import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase-admin';
import { sendWA } from '@/lib/wa';

export const dynamic = 'force-dynamic';

const OTP_EXPIRY_MINUTES = 10;

/**
 * Math.random() TIDAK dipakai di sini, dan itu disengaja.
 *
 * V8 membangkitkannya dengan xorshift128+ - cepat, tapi keadaan internalnya
 * bisa dipulihkan dari beberapa keluaran berurutan, dan setelah itu keluaran
 * berikutnya bisa diramalkan. Untuk kode yang menjaga pintu reset password,
 * "acak yang terlihat acak" tidak cukup.
 *
 * crypto.randomInt mengambil dari sumber acak sistem operasi, dan batas
 * atasnya eksklusif - jadi 100000..999999, tepat enam digit.
 */
function generateOTP(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return '****';
  return phone.slice(0, 4) + '****' + phone.slice(-3);
}

export async function POST(request: NextRequest) {
  const supabase = getAdminClient();

  try {
    const { username } = await request.json();
    if (!username) {
      return NextResponse.json({ error: 'Username wajib diisi.' }, { status: 400 });
    }

    //  Satu bentuk penulisan untuk seluruh jalur ini: huruf kecil.
    //  Sebelumnya OTP disimpan memakai ejaan persis dari tabel users sementara
    //  verify-otp mencarinya dengan .toLowerCase() - akun yang username-nya
    //  memuat huruf kapital tidak akan pernah bisa menyelesaikan reset, karena
    //  kode yang benar pun tidak ketemu barisnya.
    const kunci = String(username).trim().toLowerCase();

    // Rate limiting: max 3 request OTP per jam per username
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from('password_reset_otps')
      .select('*', { count: 'exact', head: true })
      .ilike('username', kunci)
      .gte('created_at', oneHourAgo);

    if ((recentCount ?? 0) >= 3) {
      return NextResponse.json({
        error: 'Terlalu banyak permintaan OTP. Coba lagi dalam 1 jam.',
      }, { status: 429 });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, username, full_name, phone_number')
      .ilike('username', kunci)
      .maybeSingle();

    //  Jawaban yang SAMA untuk tiga keadaan: username tidak ada, username ada
    //  tapi tanpa nomor WA, dan username ada beserta nomornya. Sebelumnya
    //  keadaan kedua dijawab 400 dengan pesan khusus, dan perbedaan itu cukup
    //  untuk memilah username mana yang terdaftar - satu per satu, tanpa
    //  perlu menebak password apa pun.
    const jawabanNetral = NextResponse.json({
      success: true,
      maskedPhone: '****',
      message: 'Jika username terdaftar dan memiliki nomor WA, OTP akan dikirim.',
    });
    if (!user || !user.phone_number) return jawabanNetral;

    //  OTP lama DILUMPUHKAN, bukan dihapus - dan itu yang membuat pembatas
    //  laju di atas berfungsi. Versi sebelumnya menghapusnya, sehingga
    //  hitungan "berapa OTP dalam sejam terakhir" tidak pernah lebih dari
    //  satu: batas 3 per jam tertulis rapi di kode tapi tidak pernah sekali
    //  pun tercapai. Menandainya terpakai melumpuhkan kode lamanya sama
    //  efektifnya, sekaligus meninggalkan jejak untuk dihitung.
    await supabase
      .from('password_reset_otps')
      .update({ used: true })
      .eq('username', kunci)
      .eq('used', false);

    const otp      = generateOTP();
    const otpHash  = hashOTP(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    const { error: insertErr } = await supabase.from('password_reset_otps').insert({
      username:   kunci,
      otp_hash:   otpHash,
      expires_at: expiresAt,
    });

    if (insertErr) {
      console.error('[forgot-password] insert error:', insertErr);
      return NextResponse.json({
        error: `Gagal insert OTP: ${insertErr.message} [code: ${insertErr.code}]`,
      }, { status: 500 });
    }

    const waMsg = [
      `🔐 *Reset Password IVP Portal*`,
      '━━━━━━━━━━━━━━━━━━',
      `Halo *${user.full_name}*,`,
      ``,
      `Kode OTP reset password kamu:`,
      ``,
      `*${otp}*`,
      ``,
      `Berlaku *${OTP_EXPIRY_MINUTES} menit*. Jangan berikan ke siapapun.`,
      '━━━━━━━━━━━━━━━━━━',
      'Abaikan pesan ini jika kamu tidak meminta reset password.',
    ].join('\n');

    const waResult = await sendWA(user.phone_number, waMsg, 'forgot_password_otp');

    return NextResponse.json({
      success: true,
      maskedPhone: maskPhone(user.phone_number),
      message: waResult.ok
        ? `OTP dikirim ke WA ${maskPhone(user.phone_number)}`
        : `OTP dibuat tapi WA gagal dikirim. Coba kirim ulang.`,
    });

  } catch (e) {
    console.error('[forgot-password] error:', e);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
