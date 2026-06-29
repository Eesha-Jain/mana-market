import { test, expect } from '@playwright/test';
import { clearAppStorage, registerAndGoTo } from './helpers/auth';
import { mockSearchApi } from './helpers/mockApi';
import { MOCK_BOOSTER_BOX } from './helpers/sampleData';
import { confirmEntryReview, selectFirstAmbiguousMatch } from './helpers/upload';

test.describe('dashboard and review workflow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await mockSearchApi(page);
    await registerAndGoTo(page, '/upload');
  });

  async function addItemAndWaitForSearch(page: import('@playwright/test').Page, query: string) {
    await page.getByPlaceholder(/Modern Horizons/i).fill(query);
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await confirmEntryReview(page, 'Add to queue');
    await expect(page.getByText('✅').first()).toBeVisible({ timeout: 15_000 });
  }

  test('dashboard stats update after product lookup', async ({ page }) => {
    await addItemAndWaitForSearch(page, MOCK_BOOSTER_BOX.title);
    await page.goto('/dashboard');

    await expect(page.getByText('Total Items').locator('..').getByText('1')).toBeVisible();
    await expect(page.getByText('Ready to List').locator('..').getByText('0')).toBeVisible();
    await expect(page.getByText('Set condition')).toBeVisible();
    await expect(page.locator('.item-name', { hasText: MOCK_BOOSTER_BOX.title })).toBeVisible();
  });

  test('setting condition marks item ready on dashboard', async ({ page }) => {
    await addItemAndWaitForSearch(page, MOCK_BOOSTER_BOX.title);
    await page.goto('/review');

    const row = page.locator('tr.row--clickable').first();
    await row.locator('select.inline-select').first().selectOption('Like New');

    await page.goto('/dashboard');
    await expect(page.getByText('Ready to List').locator('..').getByText('1')).toBeVisible();
    await expect(page.getByText('$289.99').first()).toBeVisible();
  });

  test('review page filter tabs narrow visible rows', async ({ page }) => {
    await addItemAndWaitForSearch(page, MOCK_BOOSTER_BOX.title);
    await page.goto('/review');

    await expect(page.getByRole('button', { name: /All \(1\)/ })).toBeVisible();
    await page.getByRole('button', { name: /Ready \(0\)/ }).click();
    await expect(page.getByText('No items match this filter.')).toBeVisible();

    await page.getByRole('button', { name: /Needs Action/i }).click();
    await expect(page.locator('.inline-input--title').first()).toHaveValue(MOCK_BOOSTER_BOX.title);
  });

  test('percent below pricing updates your price', async ({ page }) => {
    await addItemAndWaitForSearch(page, MOCK_BOOSTER_BOX.title);
    await page.goto('/review');

    const row = page.locator('tr.row--clickable').first();
    await row.locator('select.inline-select').first().selectOption('Like New');
    await row.locator('.pricing-controls select').selectOption('percent_below');
    await row.locator('.percent-input-row input').fill('20');

    await expect(row.locator('.price-cell--final')).toContainText('$231.99');
  });

  test('manual pricing overrides market price', async ({ page }) => {
    await addItemAndWaitForSearch(page, MOCK_BOOSTER_BOX.title);
    await page.goto('/review');

    const row = page.locator('tr.row--clickable').first();
    await row.locator('select.inline-select').first().selectOption('New');
    await row.locator('.pricing-controls select').selectOption('manual');
    await row.locator('.manual-input-row input').fill('175');

    await expect(row.locator('.price-cell--final')).toContainText('$175.00');
  });

  test('custom title persists in review table', async ({ page }) => {
    await addItemAndWaitForSearch(page, MOCK_BOOSTER_BOX.title);
    await page.goto('/review');

    const titleInput = page.locator('.inline-input--title').first();
    await titleInput.fill('MH3 Sealed Booster Box - Factory Fresh');
    await expect(titleInput).toHaveValue('MH3 Sealed Booster Box - Factory Fresh');
  });

  test('remove item from dashboard', async ({ page }) => {
    await addItemAndWaitForSearch(page, MOCK_BOOSTER_BOX.title);
    await page.goto('/dashboard');
    await page.getByTitle('Remove item').click();
    await expect(page.getByText('No items yet')).toBeVisible();
  });

  test('ambiguous lookup shows selection UI', async ({ page }) => {
    await page.getByPlaceholder(/Modern Horizons/i).fill('ambiguous commander deck');
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await selectFirstAmbiguousMatch(page);
    await confirmEntryReview(page, 'Add to queue');
    await page.goto('/review');

    await expect(page.locator('.inline-input--title').first()).toHaveValue(/Commander Deck/i);
    await expect(page.getByText(/matched 2 products/i)).toBeHidden();
  });

  test('not found item shows retry affordance', async ({ page }) => {
    await page.getByPlaceholder(/Modern Horizons/i).fill('Totally Unknown Sealed Product XYZ');
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await confirmEntryReview(page, 'Add to queue');
    await page.goto('/review');

    await expect(page.getByText('Not Found')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Edit / Retry →' })).toBeVisible();
  });

  test('export button enabled after condition set', async ({ page }) => {
    await addItemAndWaitForSearch(page, MOCK_BOOSTER_BOX.title);
    await page.goto('/review');

    await expect(page.getByRole('button', { name: /Export .* to eBay/i })).toBeHidden();

    const row = page.locator('tr.row--clickable').first();
    await row.locator('select.inline-select').first().selectOption('Like New');

    await expect(page.getByRole('button', { name: /Export 1 to eBay/i })).toBeEnabled();
  });

  test('preview JSON modal shows listing payloads', async ({ page }) => {
    await addItemAndWaitForSearch(page, MOCK_BOOSTER_BOX.title);
    await page.goto('/review');

    const row = page.locator('tr.row--clickable').first();
    await row.locator('select.inline-select').first().selectOption('Like New');

    await page.getByRole('button', { name: 'Preview All JSON' }).click();
    await expect(page.getByRole('heading', { name: 'eBay AddItem Payloads' })).toBeVisible();
    await expect(page.locator('.json-preview')).toContainText('"startPrice": 289.99');
  });

  test('clear all removes items after confirmation', async ({ page }) => {
    page.on('dialog', dialog => dialog.accept());
    await addItemAndWaitForSearch(page, MOCK_BOOSTER_BOX.title);
    await page.goto('/review');
    await page.getByRole('button', { name: 'Clear All' }).click();
    await expect(page.getByText('Nothing to review yet')).toBeVisible();
  });
});
