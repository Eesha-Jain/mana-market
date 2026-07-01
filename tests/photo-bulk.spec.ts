import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { clearAppStorage, registerAndGoTo } from './helpers/auth';
import { mockSearchApi, mockOcrApi } from './helpers/mockApi';

const pngBuffer = fs.readFileSync(path.resolve('tests/fixtures/photo-a.png'));

test.describe('photo bulk scan', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await mockSearchApi(page);
    await mockOcrApi(page);
    await registerAndGoTo(page, '/upload');
    await page.getByRole('button', { name: 'Photo Scan' }).click();
    await page.getByRole('button', { name: '🖼️ Bulk' }).click();
  });

  test('library multi-select shows thumbnails and starts review on Done', async ({ page }) => {
    await page.getByTestId('bulk-library-input').setInputFiles([
      { name: 'label-a.png', mimeType: 'image/png', buffer: pngBuffer },
      { name: 'label-b.png', mimeType: 'image/png', buffer: pngBuffer },
    ]);

    await expect(page.locator('.photo-bulk-thumb')).toHaveCount(2);
    await expect(page.getByRole('button', { name: /Done — review 2 photos/i })).toBeVisible();

    await page.getByRole('radio', { name: /Product label \(front\)/i }).click();
    await page.getByRole('button', { name: 'No' }).click();
    await page.getByRole('button', { name: /Done — review 2 photos/i }).click();

    await expect(page.getByRole('status')).toContainText('Photo 1 of 2', { timeout: 15_000 });

    await expect(page.getByRole('heading', { name: 'Review photo scan' })).toBeVisible({
      timeout: 120_000,
    });
    await expect(page.getByRole('status')).toContainText('Photo 1 of 2');
  });
});
