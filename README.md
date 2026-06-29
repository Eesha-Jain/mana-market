# Mana Market

**List Magic: The Gathering sealed products on eBay — faster.**

Mana Market is a web app for MTG sellers who need to turn a pile of booster boxes, bundles, commander decks, and other sealed product into priced, export-ready eBay listings. Instead of researching each item by hand, you add inventory in bulk, let the app match products and market prices, review the details once, and export when you're ready to list.

---

## Who it's for

Mana Market is built for sellers who work with **sealed MTG product** — not individual card inventory. If you buy collections, run a small shop, or list from a spreadsheet of UPCs and product names, the app is meant to cut the repetitive lookup and data-entry work between "I have this stuff" and "I can upload it to eBay."

---

## What it does

### Add inventory your way

You can bring items in through several paths, all leading into the same review queue:

- **Single entry** — type a product name, SKU, or UPC (or combine name + identifier in one line).
- **Bulk paste** — one product per line, same parsing rules as single entry.
- **CSV / spreadsheet** — upload or paste from Excel or Google Sheets; common column names are recognized automatically, and unrecognized columns can be mapped before import.
- **Photo scan** — photograph a UPC barcode or the front product label; OCR reads the packaging and prefills title and details for review.

Each row or photo goes through a **review step** before it joins your queue, so nothing is added blindly.

### Smart product lookup

When you add an item, Mana Market tries to identify it using:

- **UPC / barcode lookup** (catalog title, images, offer prices)
- **eBay sold listings** (recent completed sales for pricing and title hints)
- **SKU and product name** as secondary hints when a barcode alone isn't enough

If multiple products match, you pick the right one in a disambiguation dialog. If nothing matches online, you can still edit title, description, condition, and price manually and add the listing to your batch.

### Review, condition, and pricing

The **Review & Price** workspace is where you finalize listings before export:

- Set **eBay condition** (New, Like New, Very Good, etc.) and quantity per item.
- Choose **pricing mode**: match market price, list a percentage below market, or set a manual price.
- When both eBay sold data and UPC catalog prices exist, pick which source to trust (or compare options per item).
- Edit listing title and description, choose catalog vs. your own photo, and add seller notes.
- Filter by **ready**, **needs action**, or **all** to focus on what's blocking export.

Your defaults (pricing rules, text casing, photo scan preferences, market price source) can be saved so repeat batches stay consistent.

### Export for eBay

When a listing has a matched product, condition, and valid price, it's **export-ready**. Mana Market generates:

- **eBay JSON** — structured listing payloads (title, description, category, condition ID, price, pictures, item specifics) for bulk listing tools or custom workflows.
- **CSV** — a configurable spreadsheet of listing fields for manual upload or downstream tools.

Exported items are marked in the app so you don't double-export the same batch.

### Dashboard and queue

A **dashboard** summarizes your current batch: how many items are ready, need a condition, are still searching, or couldn't be matched. The upload queue shows recent additions and status at a glance so you can jump into review without losing track of a large import.

---

## How a typical batch works

1. **Add** — Import a spreadsheet, paste a list, or scan photos of product labels.
2. **Review each entry** — Confirm or edit matched product details, condition, and pricing as items enter the queue.
3. **Triage on Review** — Fix ambiguous matches, set missing conditions, adjust prices across the batch.
4. **Export** — Download eBay-ready JSON or CSV and list on your seller account.

The app is designed around **batches**: you don't have to finish one item completely before moving on, and you can apply settings like condition to remaining items during a multi-row import.

---

## Product data and images

- **Market prices** come from eBay completed sales and UPC catalog data when available; the app shows ranges and sold counts where the APIs provide them.
- **Images** can come from catalog lookup, eBay sold listings, or photos you upload or capture during a scan. You choose which image represents the listing.
- **Listing IDs** — each item gets a short reference ID (e.g. `MTG-X7K2P9`) for spreadsheets and inventory tracking.

Mana Market prepares listing *data* for eBay; it does not post listings to eBay on your behalf. You export and upload through your normal seller workflow.

---

## Accounts and data

Sign in to keep **listings**, **settings**, and **uploaded photos** synced across sessions. Listings retain import metadata (original UPC/SKU, source, notes) even when you override the display title for eBay.

---

## Scope and limitations

Mana Market is optimized for **sealed MTG product** (booster boxes, bundles, commander decks, promo packs, etc.). It is not a full card-by-card inventory system or a live eBay integration.

Lookup quality depends on barcodes, product names, and what's available in UPC and eBay data — obscure or mislabeled product may need manual review. Photo OCR works best on clear label or barcode shots.

---

*Mana Market — from inventory to export-ready eBay listings in one place.*
