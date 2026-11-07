export const TIM_TERTUNDA = 'Pending Approval';

export const PESAN_TERTUNDA = 'Akun kamu masih menunggu persetujuan admin. Kamu akan dihubungi setelah akun diaktifkan.';

export function akunTertunda(user: { team_type?: string | null } | null | undefined): boolean {
  return (user?.team_type ?? '') === TIM_TERTUNDA;
}
