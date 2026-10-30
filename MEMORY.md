# Book Mart — project memory

Read this first in any new session. It records what the app is, how it is built, every decision made with the
client, and how to work on it safely. Keep it up to date at the end of every change (see "Updating this file").

---

## 1. The project

- **What:** point-of-sale + stock + money app for **Book Mart**, a stationery & books shop in **Okara, Pakistan**.
- **Client contact / developer / Admin:** Saqib Khalil (GitHub `justusok007-glitch`, commits as `Saqib Khalil <justusok007@gmail.com>`).
- **Admin login:** `saadmalikok@gmail.com` (hard-coded developer admin; all permissions; cannot be locked out).
- **Repo:** https://github.com/justusok007-glitch/book-mart (public). Default branch `main`.
- **Web preview (auto-deploys on every push to main):** https://justusok007-glitch.github.io/book-mart/
- **Client demo of Sell (no login, sample data):** https://justusok007-glitch.github.io/book-mart/#/demo/sell
- **Android APK (built only on request):** https://github.com/justusok007-glitch/book-mart/releases/download/apk-latest/book-mart.apk
- **Firebase project:** `book-mart-22cf5` (Spark/free plan — no Cloud Functions, so no server code / Admin SDK).

## 2. How the client wants to work (important)

1. **Preview first, APK later.** Every change goes to `main` → web preview updates. The client checks it there.
   Only when the client says **"build APK"** do we run the APK workflow (see §9).
2. **Never change existing features** unless asked. Design changes must keep behaviour identical.
3. **Restore points:** before a big visual change, push the current commit to a branch (`design-v1` = old flat
   design at commit `c9fb7ee`). If the client says "reset design", restore the UI files from that branch
   (keep all features added since).
4. After any change to `firestore.rules`, **remind the client to publish the rules** (Firebase Console →
   Firestore → Rules → paste whole file → Publish). Forgetting this = "permission-denied" errors.
5. Explain things simply (client is not a programmer); English replies; app UI is English + Urdu.
6. Ask before building when a request is ambiguous and costly; otherwise just build and report.

## 3. Product decisions (from the client)

- One shop. Roles: **Admin** (developer, everything), **Owner**, **Salesman**, **Inventory Manager**; Admin can give any
  permission to any role (Roles & Permissions screen). Admin-only perms: `manage_roles`, `backup_restore`, `bulk_inventory`.
- Languages: English + Urdu (Noto Nastaliq). Light theme only.
- Sell flow: search box → **Scan** or **Select** → main categories (rectangular tabs) → sub-categories → item →
  same-price variants (colours/types). Shows "N left"; cannot add more than available stock.
- Credit (udhaar) with customers, returns, discounts — all yes. **Weighted average cost** for profit.
- Expenses separate from owner **cash-out** (recorded with name/date/time) + cash-out summary. Investment tracked.
- Supplier payables yes. Receipt printing yes (58mm Bluetooth thermal; client has no printer yet).
- Sales screens must **not show profit** (profit only in Profit & Loss / Reports for `view_profit_loss`).
- Receipt numbers: **each user has a fixed letter** → `A00001, A00002…` (per user series, works offline).
  Returns can search `A00125`, `a125`, or just `125`; old-style `261030-7K3F` found by full number or last 4 chars.
- Home menu: **rectangular tiles** (2 columns) grouped by section — client prefers tiles over list rows.
- Design (Oct 2026 redesign, client approved): Rubik font, **charcoal app bar** on every screen, Home has a
  charcoal "counter" with today's figures and the lime Sell button overlapping it.

## 4. Tech stack

- React 19 + Vite 6 + Tailwind CSS v4 (`@tailwindcss/vite`, tokens in `@theme` in `src/index.css`). Plain JSX, no TS.
- HashRouter, `base: './'` (same build works on GitHub Pages and inside the APK).
- Firebase Auth (email/password) + Cloud Firestore with `persistentLocalCache` (works offline, syncs later).
- Capacitor 7 (`pk.bookmart.app`, name "Book Mart") for the Android APK; `@capacitor/app` for the Back button.
- Barcode: native `BarcodeDetector` first, ZXing (`@zxing/browser`) fallback, 3 decode passes, torch.
- Fonts: `@fontsource/rubik` (latin 400/500/600/700) + `@fontsource/noto-nastaliq-urdu`. In CSS, Tailwind
  `font-bold` = 600 and `font-semibold` = 500 (Rubik runs heavy).
- No local `npm install` in the Claude sandbox (registry blocked) — **CI builds everything**. For quick checks use
  `/opt/npm-tools/node_modules/esbuild/bin/esbuild` (syntax) and `/opt/node-tools/node_modules/.bin/eslint`.

## 5. Design tokens (src/index.css)

- charcoal `#373435` (app bar, primary buttons), charcoal-700 `#262425`, charcoal-500 `#4a4949`
- lime `#9fcc47` (Sell, selected chips, fills — **always charcoal text on lime, never white**), lime-600 `#8ab83a`,
  lime-100 `#e4f1c8`, lime-50 `#f3f9e7`, leaf `#4d7a12` (green text on white)
- paper `#f5f6f1` (background), line `#e2e5db`, ink `#262425`, muted `#656b62`
- danger `#c0392b` / `#fbeae7`, warn `#e8a317` / `#fdf4e1`
- `.app-bar` class: controls inside switch to on-dark look (primary → lime, secondary → translucent, `.icon-btn` → white).
- Touch targets ≥ 48px. Urdu: `html[lang=ur]` loosens line-height; numbers/prices use `.latin`.

## 6. Code map

```
src/
  App.jsx               routes (RequirePerm / RequireAny), Shell
  main.jsx              entry (+ setupNative for APK)
  index.css             tokens + global styles
  context/AuthContext   auth, profile, role, can(perm); bootstrapAdmin (seeds roles, assigns receipt letters)
  context/LangContext   t(key), pick({en,ur}), lang switch (localStorage bm-lang)
  components/ui.jsx     Button(data-variant), IconButton(.icon-btn), Field, Toggle, Card, Notice(error|ok|info|warn),
                        Badge, SectionTitle, Sheet, PageHeader(charcoal app bar), Page, Spinner, EmptyState, Rs,
                        Segmented, MoneyInput, useOnline, OfflineBanner
  components/           Icon (inline SVG set), ProductSearch, BarcodeScanner, ItemBits, Receipt (view/print/share),
                        MoneyBits (DayPicker, MonthPicker, PersonPicker, EntryGroups+Undo), ReportBits (PeriodPicker,
                        BarChart, Row)
  lib/firebase.js       config, ADMIN_EMAIL, STAFF_DOMAIN (username@bookmart.app), secondary auth for creating users
  lib/permissions.js    PERMISSION_GROUPS, ADMIN_ONLY, DEFAULT_ROLES, FEATURE_GROUPS, FEATURES (Home tiles)
  lib/i18n.js           STRINGS { key: {en, ur} } — add every new UI string here (check for duplicate keys)
  lib/catalog.jsx       CatalogProvider/buildCatalog, saveItem (transaction), categories, barcodes (EAN-13 200…)
  lib/purchasing.jsx    suppliers, recordPurchase (transaction, weighted avg), paySupplier, adjustStock
  lib/selling.jsx       recordSale (offline batch), receipt counters, customers, useDayStats, useShopSettings
  lib/customers.jsx     receivePayment, recordReturn, findSalesByReceipt
  lib/money.jsx         expenses, cashOuts, investments, closings, expectedCash, removeEntry (undo within 24h)
  lib/reports.js        periodRange, fetchStats/Sales/Expenses, sumStats, profitAndLoss, seriesByDay, bySeller,
                        topItems, stockByCategory
  lib/backup.js         full JSON backup/restore (Timestamps as {__ts}), COLLECTIONS list
  lib/inventoryCsv.js   CSV parse/plan/apply upload, inventory CSV export, resetData(scope)
  lib/escpos.js         58mm ESC/POS receipt bytes, RawBT intent (rawbt:base64,… in APK / intent: in Chrome)
  lib/saleMath.js       saleTotals, dayKey, formatReceipt, nextLetter, makeReceiptNo (old style), returnValue
  lib/native.js         Capacitor Back button
  lib/beep.js           scan sounds (Web Audio): beepOk (high beep + vibrate), beepError (two low beeps)
  pages/                one file per screen (Home, Login, SellPreview=Sell, Items, ItemDetail, ItemForm, Categories,
                        LowStock, Buy, Suppliers, SupplierDetail, Purchases, Sales, Returns, Customers, Expenses,
                        CashOut(+Summary), Investment, Closing, ProfitLoss, Reports, Users, Roles, Settings,
                        Backup, BulkInventory, ComingSoon)
  dev/harness.jsx       DESIGN-CHECK HARNESS (fake admin + sample catalog, never deployed); #/__login shows Login
```

## 7. Firestore data model

| Collection | Contents |
|---|---|
| users/{uid} | name, username, email, phone, roleId, active, receiptLetter |
| roles/{id} | name, nameUr, order, system, permissions{perm:true} |
| settings/shop | name, phone, address, footer |
| meta/setup, meta/backup | roles seeded flag; last backup info |
| categories/{id} | en, ur, parentId (null = main), order |
| items/{id} | en, ur, catId, subId, price, unit, lowStock, active |
| variants/{id} | itemId, en, ur, dot, barcode, order, active, stock |
| barcodes/{code} | variantId, itemId (keeps barcodes unique) |
| itemCosts/{itemId} | avgCost, lastCost |
| stockMoves/{id} | type opening/purchase/adjust/sale/return, qty, unitCost, by… |
| counters/barcode | next |
| receiptCounters/{uid} | last, letter (per-user receipt series) |
| suppliers, supplierLedger, purchases | payables (balance = shop owes) |
| customers, customerLedger | udhaar (balance = customer owes) |
| sales/{id} | receiptNo, receiptSeries, receiptSeq (or receiptShort for old style), day, lines[], subtotal, discount, total, paid, due, cost, profit, payType, customer, by, byName, clientAt, returned, returnedTotal |
| returns/{id} | saleId, receiptNo, day, lines, amount, cost, refund cash/account, restock |
| dailyStats/{YYYY-MM-DD} | running totals: salesCount, salesTotal, discountTotal, costTotal, profit, cashIn, creditGiven, creditReceived, bankIn, itemsSold, bySeller{uid:{name,count,total}}, returnsCount/Total/Cost, cashRefunds, expensesTotal, expenseCash, cashOutTotal/Count, investTotal, investCash, supplierCash |
| expenses, cashOuts, investments | day, amount, …, by, byName, at, clientAt |
| closings/{day} | opening, cashIn, investCash, expenseCash, cashOut, supplierCash, expected, counted, diff, notes, coins |

Key formulas:
- Weighted average cost: `(held×oldAvg + Σqty×cost) / (held + qty)`; negative held → 0; unknown old cost → purchase avg.
- Net sales = salesTotal − returnsTotal. Profit for a return: restocked → −(amount − cost); damaged → −amount.
- Expected cash in galla = opening + cashIn + investCash − expenseCash − cashOutTotal − supplierCash.
  Opening = counted cash of the most recent earlier closing (editable).
- Net profit (P&L) = Σprofit − expensesTotal. Cash-out and investment are not profit.

## 8. Security rules (firestore.rules)

`can(p)` = admin email OR active user whose role has `p`. Notable rules: variants stock-only updates for buy/sell;
sales create checks discount/credit perms; customers/suppliers balance-only updates for non-managers; money entries
`newEntry()` (by == uid, amount > 0) and `undoable()` (creator within 1 day, or admin); `receiptCounters/{uid}` only
that user; **catch-all `match /{document=**}` allows the Admin everything** (backup/restore/bulk/reset).
Always tell the client to publish after changing this file.

## 9. Build, deploy, APK

- `.github/workflows/deploy.yml` (on push to main): `npm install`, `npm run build`, harness build
  (`vite build --mode harness` → dist-harness), pushes `dist` + `harness/` to branch **build-output**, deploys Pages.
- `.github/workflows/apk.yml` (**workflow_dispatch only**): build web → `npx cap add android` → copy icons from
  `resources/android/res` → add CAMERA permission + versionCode = run number → `cap sync` → gradle assembleRelease →
  zipalign + apksigner with the **permanent key** from secrets `ANDROID_KEYSTORE_B64` + `ANDROID_KEYSTORE_PASS`
  (fails if missing) → uploads to release tag `apk-latest`.
  Start it: `gh api -X POST repos/justusok007-glitch/book-mart/actions/workflows/apk.yml/dispatches -f ref=main`
- Signing key SHA-256: `43:72:06:BE:BB:44:36:05:99:79:FC:F3:0F:18:86:6E:FC:26:80:CD:AB:6F:E6:D6:68:4E:5E:6F:A0:5A:CD:53`
  (client keeps `release.jks` + password privately; never commit it).
- `.gitignore` uses `/android/` (root only) — `resources/android/` must stay committed.
- Bump `package.json` version for releases (APK versionName = version + run number).

## 10. Testing in the sandbox

- github.io / Firebase are blocked from the sandbox. Test with the harness:
  `git fetch origin +build-output:refs/remotes/origin/build-output`, `git archive origin/build-output | tar -x -C site`,
  serve `site/` on 127.0.0.1:5179, open `http://127.0.0.1:5179/harness/harness.html#/<route>` with Playwright
  (`require('/opt/node-tools/node_modules/playwright-core')`), 390×844 @2x screenshots.
- Offline Firestore in the harness: writes go to local cache and show up; `getDocs` falls back to cache after ~10s.
- Pure logic tests: bundle the lib with esbuild, aliasing `firebase/*` and `react` to small stubs, run with node.
- Workflow logs can't be downloaded; use `gh api .../check-runs/{job}/annotations` and `::notice::` lines.
- `gh` GraphQL is blocked — use REST (`gh api repos/...`). Pushing tags is blocked; pushing branches works.

## 11. Done (history)

1. Setup, login, roles & permissions, users, settings, English/Urdu
2. Catalog: categories/sub-categories, items, same-price variants, barcodes (type/scan/generate), low stock
3. Buy & stock: suppliers, purchases, weighted average cost, adjustments, payables
4. Sell: offline sales, discounts, cash/part/udhaar, receipt print/share, sales history
5. Customers (udhaar, payments, WhatsApp reminder) and returns
6. Expenses, cash-out + summary, investment + business position, daily closing (note counter)
7. Profit & Loss, Reports (by day, salesmen, items, stock value)
8. Backup & restore (Admin), RawBT one-tap printing, Android APK (Capacitor)
- Extras: search above Scan/Select; "N left" in Sell; stop at zero stock; Sales period filters (no profit shown);
  delete user (Admin; Firebase login stays but app access removed, username can't be reused);
  Bulk Inventory CSV upload (columns: Item Name, Item Name Ur, Category, Sub Category, Sale Price, Cost Price,
  Opening Stock, Low Stock — empty optional cell = "don't change"); inventory CSV download; reset data
  (inventory only / everything; users, roles, settings kept; safety backup first); per-user receipt letters;
  redesign (Rubik, charcoal app bar, Home counter, tiles).
- Scan beep: every barcode scan beeps — camera (Sell, Buy, item form) and USB/Bluetooth keyboard scanners
  (code + Enter in the search box). Sell/Buy beep only when the item is really added; not found / no stock →
  low double beep. Viewfinder/BarcodeScanner take `beep={false}` when the screen beeps itself.

## 12. Open items / ideas

- **Direct Bluetooth printing** without RawBT (native plugin in the APK) — waiting for the client's printer model.
- Test the APK on a real phone (login, sale, scan, return, print) — client to report.
- Same user selling on two phones offline at once could duplicate a receipt number (accepted; one login per salesman).

## 13. Updating this file

At the end of each piece of work: add it to §11, change §12, and record any new client decision in §3 or §2.
Commit with the code change.
