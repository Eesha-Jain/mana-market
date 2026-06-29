import { test, expect } from '@playwright/test';
import path from 'node:path';
import { clearAppStorage, registerAndGoTo } from './helpers/auth';
import { mockSearchApi } from './helpers/mockApi';
import { SAMPLE_CSV_TSV } from './helpers/sampleData';

import { confirmEntryReview, selectFirstAmbiguousMatch } from './helpers/upload';

test.describe('upload page', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await mockSearchApi(page);
    await registerAndGoTo(page, '/upload');
  });

  test('single entry adds item to queue', async ({ page }) => {
    await page.getByPlaceholder(/Modern Horizons/i).fill('Modern Horizons 3 Booster Box');
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await confirmEntryReview(page, 'Add to queue');

    await expect(page.getByText('Current Queue (1)')).toBeVisible();
    await expect(page.locator('.queue-item-query', { hasText: 'Modern Horizons 3 Booster Box' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Review 1 item/i })).toBeVisible();
  });

  test('single entry submit via Enter key', async ({ page }) => {
    const input = page.getByPlaceholder(/Modern Horizons/i);
    await input.fill('Commander Masters Bundle');
    await input.press('Enter');
    await confirmEntryReview(page, 'Add to queue');
    await expect(page.getByText('Current Queue (1)')).toBeVisible();
  });

  test('single entry with UPC barcode triggers UPC lookup', async ({ page }) => {
    let capturedUpc: string | undefined;
    await mockSearchApi(page, (_query, upc) => {
      capturedUpc = upc;
      return {
        type: 'found',
        source: 'test',
        product: {
          title: 'Found via UPC',
          description: 'Sealed product from barcode lookup.',
          imageUrls: ['https://example.com/upc-product.jpg'],
          upc: upc ?? '',
        },
      };
    });

    await page.getByPlaceholder(/Modern Horizons/i).fill('5356982362');
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await expect(page.getByText(/Looking up/i)).toBeHidden({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Review entry' })).toBeVisible();
    await expect(page.locator('.photo-review-hero-image')).toHaveAttribute(
      'src',
      'https://example.com/upc-product.jpg',
    );
    await expect(page.getByText('Found via UPC')).toBeVisible();
    await expect(page.locator('textarea').filter({ hasText: 'UPC: 5356982362' })).toBeVisible();
    await confirmEntryReview(page, 'Add to queue');

    expect(capturedUpc).toBe('5356982362');
    await expect(page.getByText('Current Queue (1)')).toBeVisible();
  });

  test('ambiguous lookup prompts product selection before review', async ({ page }) => {
    await page.getByPlaceholder(/Modern Horizons/i).fill('ambiguous commander deck');
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await selectFirstAmbiguousMatch(page);
    await confirmEntryReview(page, 'Add to queue');
    await expect(page.getByText('Current Queue (1)')).toBeVisible();
  });

  test('bulk entry adds multiple items', async ({ page }) => {
    await page.getByRole('button', { name: 'Bulk Names' }).click();
    await page.getByPlaceholder(/Modern Horizons 3 Booster Box/i).fill(
      'Modern Horizons 3 Booster Box\nCommander Masters Bundle\nBloomburrow Booster Box',
    );
    await page.getByRole('button', { name: /Review 3 items/i }).click();

    await confirmEntryReview(page, 'Done → next');
    await confirmEntryReview(page, 'Done → next');
    await confirmEntryReview(page, 'Done');

    await expect(page.getByText('Current Queue (3)')).toBeVisible();
    await expect(page.getByText('Bloomburrow Booster Box')).toBeVisible();
  });

  test('bulk entry cancel upload keeps confirmed items only', async ({ page }) => {
    await page.getByRole('button', { name: 'Bulk Names' }).click();
    await page.getByPlaceholder(/Modern Horizons 3 Booster Box/i).fill(
      'Modern Horizons 3 Booster Box\nCommander Masters Bundle\nBloomburrow Booster Box',
    );
    await page.getByRole('button', { name: /Review 3 items/i }).click();

    await confirmEntryReview(page, 'Done → next');
    await page.getByRole('button', { name: 'Cancel upload' }).click();

    await expect(page.getByText('Current Queue (1)')).toBeVisible();
    await expect(page.getByPlaceholder(/Modern Horizons 3 Booster Box/i)).toBeVisible();
  });

  test('single entry review all exits to review page', async ({ page }) => {
    await page.getByPlaceholder(/Modern Horizons/i).fill('Modern Horizons 3 Booster Box');
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await confirmEntryReview(page, 'Add to queue');

    await page.getByPlaceholder(/Modern Horizons/i).fill('Commander Masters Bundle');
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Review entry' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Review all 1 item/i }).click();

    await expect(page).toHaveURL(/\/review/);
    await expect(page.getByRole('textbox', { name: 'Edit listing title' })).toHaveValue('Modern Horizons 3 Booster Box');
  });

  test('csv paste shows preview and imports rows', async ({ page }) => {
    await page.getByRole('button', { name: 'CSV / Spreadsheet' }).click();
    await page.getByPlaceholder(/Name\tSKU/i).fill(SAMPLE_CSV_TSV);

    await expect(page.getByText('2 rows ready to review')).toBeVisible();
    await expect(page.locator('.items-table').getByText('Modern Horizons 3 Booster Box')).toBeVisible();
    await expect(page.locator('.items-table').getByText('630509777771')).toBeVisible();

    await page.getByRole('button', { name: /Review 2 items/i }).click();
    await confirmEntryReview(page, 'Done → next');
    await confirmEntryReview(page, 'Done');

    await expect(page.getByText('Items added to queue!')).toBeVisible();
    await expect(page.getByText('Current Queue (2)')).toBeVisible();
  });

  test('csv file upload parses and previews rows', async ({ page }) => {
    await page.getByRole('button', { name: 'CSV / Spreadsheet' }).click();
    const fixture = path.join('tests', 'fixtures', 'sample-import.tsv');
    await page.locator('input[type="file"]').first().setInputFiles(fixture);

    await expect(page.getByText('2 rows ready to review')).toBeVisible();
    await expect(page.getByText('Commander Masters Bundle')).toBeVisible();
  });

  test('csv paste with only header shows helpful error', async ({ page }) => {
    await page.getByRole('button', { name: 'CSV / Spreadsheet' }).click();
    await page.getByPlaceholder(/Name\tSKU/i).fill('Name\tSKU\tQuantity');
    await expect(page.getByText(/No valid rows found/i)).toBeHidden();
  });

  test('csv clear preview resets paste area', async ({ page }) => {
    await page.getByRole('button', { name: 'CSV / Spreadsheet' }).click();
    await page.getByPlaceholder(/Name\tSKU/i).fill(SAMPLE_CSV_TSV);
    await expect(page.getByText('2 rows ready to review')).toBeVisible();
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByText('2 rows ready to review')).toBeHidden();
  });

  test('review button navigates to review page', async ({ page }) => {
    await page.getByPlaceholder(/Modern Horizons/i).fill('Modern Horizons 3 Booster Box');
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await confirmEntryReview(page, 'Add to queue');
    await page.getByRole('button', { name: /Review 1 item/i }).click();
    await expect(page).toHaveURL(/\/review/);
  });

  test('tab bar switches between upload modes', async ({ page }) => {
    await page.getByRole('button', { name: 'Bulk Names' }).click();
    await expect(page.locator('.bulk-textarea')).toBeVisible();

    await page.getByRole('button', { name: 'Photo Scan' }).click();
    await expect(page.getByText(/Photograph product labels/i)).toBeVisible();

    await page.getByRole('button', { name: 'Single Entry' }).click();
    await expect(page.getByPlaceholder(/Modern Horizons/i)).toBeVisible();
  });
});
