import { test, expect } from '@playwright/test';
import {
  clearAppStorage,
  loginUser,
  registerUser,
  uniqueTestUser,
} from './helpers/auth';

test.describe('authentication', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
  });

  test('redirects unauthenticated users from protected routes', async ({ page }) => {
    for (const path of ['/dashboard', '/upload', '/review', '/settings']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('registers a new account and lands on dashboard', async ({ page }) => {
    const user = uniqueTestUser('register');
    await registerUser(page, user);
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.locator('.navbar-user-name')).toHaveText(user.name);
  });

  test('shows error when passwords do not match', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Display Name').fill('Mismatch User');
    await page.getByLabel('Email').fill('mismatch@test.com');
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('password123');
    await page.getByLabel('Confirm Password').fill('different123');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText('Passwords do not match.')).toBeVisible();
  });

  test('shows error when password is too short', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Display Name').fill('Short Pass');
    await page.getByLabel('Email').fill('short@test.com');
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('12345');
    await page.getByLabel('Confirm Password').fill('12345');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText('Password must be at least 6 characters.')).toBeVisible();
  });

  test('prevents duplicate registration', async ({ page }) => {
    const user = uniqueTestUser('dup');
    await registerUser(page, user);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/register');
    await page.getByLabel('Display Name').fill('Another Name');
    await page.getByLabel('Email').fill(user.email);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(user.password);
    await page.getByLabel('Confirm Password').fill(user.password);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText('An account with this email already exists.')).toBeVisible();
  });

  test('logs in with valid credentials', async ({ page }) => {
    const user = uniqueTestUser('login');
    await registerUser(page, user);
    await page.getByRole('button', { name: 'Sign out' }).click();

    await loginUser(page, user);
    await expect(page.getByText(`Welcome back, ${user.name}`)).toBeVisible();
  });

  test('shows error for wrong password', async ({ page }) => {
    const user = uniqueTestUser('wrongpw');
    await registerUser(page, user);
    await page.getByRole('button', { name: 'Sign out' }).click();

    await page.goto('/login');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText('Incorrect password.')).toBeVisible();
  });

  test('shows error for unknown email', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('nobody@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText('No account found with this email.')).toBeVisible();
  });

  test('persists session across reload', async ({ page }) => {
    const user = uniqueTestUser('session');
    await registerUser(page, user);
    await page.reload();
    await expect(page.getByText(`Welcome back, ${user.name}`)).toBeVisible();
  });

  test('logout clears session and protects routes again', async ({ page }) => {
    await registerUser(page);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
