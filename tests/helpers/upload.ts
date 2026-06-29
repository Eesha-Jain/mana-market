import { expect, type Page } from '@playwright/test';

/** Wait for entry lookup, then confirm the review modal. */
export async function confirmEntryReview(page: Page, buttonName: RegExp | string = /Done|Add to queue/) {
  await expect(page.getByText(/Looking up/i)).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Review entry' })).toBeVisible({ timeout: 15_000 });
  const confirmButton = page.getByRole('button', { name: buttonName });
  await expect(confirmButton).toBeEnabled({ timeout: 15_000 });
  await confirmButton.click();
}

/** Pick the first product when lookup returns multiple matches. */
export async function selectFirstAmbiguousMatch(page: Page) {
  await expect(page.getByRole('heading', { name: 'Multiple matches found' })).toBeVisible({
    timeout: 15_000,
  });
  await page.locator('.ambiguous-card').first().click();
  await expect(page.getByRole('heading', { name: 'Review entry' })).toBeVisible({ timeout: 15_000 });
}
