# magic-the-gathering

React + TypeScript app scaffolded with Vite, plus Playwright end-to-end testing and Playwright MCP configuration.

## Scripts

- npm run dev
- npm run typecheck
- npm run build
- npm run preview
- npm run lint
- npm run playwright:install
- npm run test:e2e
- npm run test:e2e:ui
- npm run mcp:playwright

## Playwright E2E

1. Install browser binaries:

	npm run playwright:install

2. Run tests:

	npm run test:e2e

## Professional Workflow

Run these checks before shipping:

1. npm run typecheck
2. npm run lint
3. npm run build
4. npm run test:e2e

## Playwright MCP

The workspace includes [VS Code MCP config](.vscode/mcp.json) that runs Playwright MCP via npx.

MCP server config:

- command: npx
- args: @playwright/mcp@latest

If your MCP client supports workspace configuration, point it to .vscode/mcp.json.

## Supabase setup

User accounts, listings, settings, and listing images are stored in [Supabase](https://supabase.com). Without Supabase env vars, the app falls back to browser localStorage (fine for local dev / tests only).

### 1. Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Pick a name, database password, and region → **Create**

### 2. Run the database schema

1. In your project, open **SQL Editor** → **New query**
2. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql)
3. Click **Run**

This creates `profiles`, `listings`, `user_settings`, row-level security policies, a signup trigger, and storage policies.

### 3. Create the image bucket

1. Open **Storage** → **New bucket**
2. Name: **`listing-images`**
3. Enable **Public bucket** (required so eBay can fetch image URLs)
4. Click **Create**

If the SQL already ran, the bucket may exist — just confirm it is **public**.

### 4. Configure auth (recommended)

In **Authentication** → **Providers** → **Email**:

- Turn **Confirm email** **off** for easier local testing, or leave it on and confirm via inbox after signup
- Set **Site URL** to your app URL (e.g. `http://localhost:5173` for dev, `https://your-app.vercel.app` for production)

### 5. Copy API keys to `.env`

In **Project Settings** → **API**, copy:

| Supabase field | `.env` variable |
|---|---|
| Project URL | `VITE_SUPABASE_URL` |
| anon public key | `VITE_SUPABASE_ANON_KEY` |

Create a `.env` file (see [.env.example](.env.example)):

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
EBAY_APP_ID=your-ebay-app-id
```

Restart `npm run dev` after changing `.env`.

### What gets stored where

| Data | Supabase location |
|---|---|
| Login / passwords | Supabase Auth (`auth.users`) |
| Display name | `profiles` table |
| Card listings | `listings` table (product JSON in `product` column) |
| User defaults (pricing, photo type, etc.) | `user_settings` table |
| Uploaded listing photos | `listing-images` storage bucket (`{user_id}/{uuid}.jpg`) |

## Deploy to Vercel

The frontend is a static Vite build. Product search still uses `/api/search` serverless functions. Auth, listings, settings, and images go through Supabase directly from the browser.

### 1. Connect the repo

Import the project in [Vercel](https://vercel.com). The included `vercel.json` sets the build command and SPA fallback.

### 2. Set environment variables

In **Project → Settings → Environment Variables**, add:

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key (safe with RLS) |
| `EBAY_APP_ID` | Recommended | eBay Finding API app ID for product search |

Also add the same Supabase vars to your local `.env` for dev.

### 3. Update Supabase auth URLs

In Supabase **Authentication** → **URL configuration**, set **Site URL** to your Vercel domain and add it under **Redirect URLs**.

### 4. Verify

1. Register / sign in on your deployed app
2. Add a listing and upload an image
3. In Supabase **Table Editor**, confirm rows appear in `listings`
4. In **Storage → listing-images**, confirm the uploaded file exists
