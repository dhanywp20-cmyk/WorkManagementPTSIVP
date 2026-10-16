/**
 * Uji ujung-ke-ujung (Playwright) - dijalankan MANUAL lewat GitHub Actions (workflow "E2E",
 * tombol Run workflow) atau lokal:
 *
 *   cd e2e && npm install && npx playwright install chromium
 *   E2E_BASE_URL=https://work-management-ptsivp.vercel.app npx playwright test
 *
 * Paket sendiri (e2e/package.json): build Vercel & CI harian tidak ikut mengunduh Playwright.
 *
 * HANYA BACA. Preview & produksi memakai basis data yang SAMA, jadi uji tidak pernah menekan tombol
 * simpan/kirim/hapus. Satu-satunya tulisan: baris login (login_attempts & user_sessions) milik akun
 * uji, dan sesinya dihapus lagi lewat /api/auth/logout di akhir.
 *
 * Akun uji: E2E_USERNAME / E2E_PASSWORD (GitHub Secrets) - sebaiknya akun peran **Viewer**
 * (lihat semua, hanya baca; dijaga RLS) dan TANPA 2FA. Bila kosong, uji yang butuh login dilewati.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,                       // satu per satu - hemat kuota & tidak menumpuk sesi
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'hp', use: { ...devices['Pixel 7'] } },
  ],
});
