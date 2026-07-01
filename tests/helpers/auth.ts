import { expect, type Page } from '@playwright/test';

export interface TestUser {
  name: string;
  email: string;
  password: string;
}

export function uniqueTestUser(prefix = 'test'): TestUser {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    name: `${prefix} User`,
    email: `${prefix}-${stamp}@example.com`,
    password: 'testpass123',
  };
}

/** Clear app state so each test starts from a clean slate. */
export async function clearAppStorage(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('mtg_lister_')) localStorage.removeItem(key);
    }
  });
}

export async function registerUser(page: Page, user: TestUser = uniqueTestUser()) {
  await page.goto('/register');
  await page.getByLabel('Display Name').fill(user.name);
  await page.getByLabel('Email').fill(user.email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(user.password);
  await page.getByLabel('Confirm Password').fill(user.password);
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page.getByText(`Welcome back, ${user.name}`)).toBeVisible();
  return user;
}

export async function signOutUser(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
}

export async function loginUser(page: Page, user: TestUser) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

export async function registerAndGoTo(page: Page, path: string, user?: TestUser) {
  const testUser = await registerUser(page, user);
  await page.goto(path);
  return testUser;
}
