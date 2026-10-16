/** Halaman & route yang terbuka tanpa login - tanpa akun, tanpa menulis apa pun. */
import { test, expect } from '@playwright/test';

test('/api/health hidup', async ({ request }) => {
  const r = await request.get('/api/health');
  expect(r.ok()).toBeTruthy();
});

test('/ dialihkan ke layar masuk', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator('#f-dashboard-page-1')).toBeVisible();
  await expect(page.locator('#f-dashboard-login-pwd')).toBeVisible();
});

test('halaman terlindung tanpa login -> layar masuk', async ({ page }) => {
  await page.goto('/ticketing');
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator('#f-dashboard-page-1')).toBeVisible();
});

test('route admin menolak tanpa sesi', async ({ request }) => {
  for (const jalur of ['/api/admin/kesehatan', '/api/auth/2fa']) {
    const r = await request.get(jalur);
    expect([401, 403, 302, 307]).toContain(r.status());
  }
});

test('layar masuk tanpa galat skrip', async ({ page }) => {
  const galat: string[] = [];
  page.on('pageerror', e => galat.push(e.message));
  await page.goto('/dashboard');
  await expect(page.locator('#f-dashboard-page-1')).toBeVisible();
  expect(galat).toEqual([]);
});
