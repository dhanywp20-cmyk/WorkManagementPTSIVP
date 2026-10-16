/**
 * Masuk dengan akun uji (Viewer), buka setiap menu, pastikan tidak ada layar galat / galat skrip.
 * Hanya membuka halaman - tidak menekan tombol apa pun di dalamnya.
 */
import { test, expect, type Page } from '@playwright/test';

const USER = process.env.E2E_USERNAME;
const PASS = process.env.E2E_PASSWORD;

const MENU = [
  '/learning-center', '/tech-note', '/summary-project', '/tools-team', '/reminder-schedule',
  '/form-require-project', '/form-review', '/ticketing', '/picket-showroom', '/daily-report',
  '/unit-movement', '/incentive-pts', '/project-progress', '/kpi-team',
];

const TEKS_GALAT = /Halaman ini mengalami kendala/;

test.describe('menu (perlu akun uji)', () => {
  test.skip(!USER || !PASS, 'E2E_USERNAME / E2E_PASSWORD belum diisi');
  test.describe.configure({ mode: 'serial' });

  let page: Page;
  const galat: string[] = [];

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    page.on('pageerror', e => galat.push(`${page.url()} :: ${e.message}`));
    await page.goto('/dashboard');
    await page.locator('#f-dashboard-page-1').fill(USER!);
    await page.locator('#f-dashboard-login-pwd').fill(PASS!);
    await page.getByRole('button', { name: /Masuk ke Portal/ }).click();
    // Akun uji ber-2FA tidak didukung (kode berubah tiap 30 detik).
    await expect(page.getByText('Kode authenticator')).toHaveCount(0, { timeout: 5_000 }).catch(() => {});
    await expect(page.locator('#f-dashboard-page-1')).toHaveCount(0, { timeout: 30_000 });
  });

  test.afterAll(async () => {
    if (!page) return;
    await page.request.post('/api/auth/logout').catch(() => {});
    await page.close();
  });

  test('halaman tak dikenal -> 404 rapi', async () => {
    const r = await page.goto('/halaman-yang-tidak-ada-e2e');
    expect(r?.status()).toBe(404);
  });

  for (const jalur of MENU) {
    test(`buka ${jalur}`, async () => {
      const awal = galat.length;
      const r = await page.goto(jalur, { waitUntil: 'domcontentloaded' });
      expect(r?.status() ?? 200).toBeLessThan(500);
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await expect(page.getByText(TEKS_GALAT)).toHaveCount(0);
      expect(galat.slice(awal)).toEqual([]);
    });
  }
});
