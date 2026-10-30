# Book Mart

Point-of-sale and stock app for the Book Mart stationery shop (Okara).
English + Urdu, works offline, roles & permissions set by the Admin.

**Preview:** https://justusok007-glitch.github.io/book-mart/ (updates automatically on every push to `main`)

**Sell screen demo for the client (no login, sample data):** https://justusok007-glitch.github.io/book-mart/#/demo/sell

Design: logo colours (charcoal `#373435` + lime `#9fcc47`), light theme only, flat style, 48px touch targets. Lime is only used as a fill with charcoal text on it.

## Stack
- React + Vite + Tailwind CSS
- Firebase Authentication (username/password) + Cloud Firestore with offline cache
- Capacitor packages the Android APK (built by `.github/workflows/apk.yml`)

## Build phases
1. ✅ Setup, login, roles & permissions, users, settings, English/Urdu
2. ✅ Catalog — categories, sub-categories, items, same-price colours/types, barcodes (type/scan/generate), opening stock, low stock
3. ✅ Buy & stock — suppliers, purchases, weighted average cost, last cost price, stock adjustments, supplier payables & payments
4. ✅ Sell — saves offline, stock down, cost at sale for profit, discount, cash/part/udhaar with customers, receipt print & share, sales history
5. ✅ Customers (udhaar account, receive payments, WhatsApp reminders) and returns (stock back, cash or account refund, damaged option)
6. ✅ Expenses, owner cash-out (who/when) & summary, investment & business position, daily closing (cash count, short/extra)
7. ✅ Reports — profit & loss, sales by day/month, salesmen, top items, stock value by category
8. ✅ Backup & restore (Admin), RawBT direct printing, Android APK (Capacitor) on the Releases page

## Android app
Every push builds `book-mart.apk` and puts it on the Releases page:
https://github.com/justusok007-glitch/book-mart/releases/download/apk-latest/book-mart.apk

Signing: add repository secrets `ANDROID_KEYSTORE_B64` and `ANDROID_KEYSTORE_PASS` for a permanent key. Without them the
workflow makes a key once and keeps it in the Actions cache (if that cache expires, uninstall the old app once before installing).

## Printing
Settings → Receipt printer → "Print directly with RawBT": Print sends an ESC/POS receipt (58mm, 32 columns) to the RawBT app,
which prints on the paired Bluetooth printer. Off = the phone's print screen.

## How access works
- The developer Admin (`saadmalikok@gmail.com`) has every permission and cannot be changed or locked out.
- Every other user has one role; each role has a list of permissions the Admin ticks in **Roles & Permissions**.
- Staff log in with a username. Internally it becomes `username@bookmart.app` in Firebase Auth.
- The same checks are enforced on the server by `firestore.rules`.

## Firestore rules
After each phase, copy `firestore.rules` into Firebase Console → Firestore Database → Rules → **Publish**.

## Local development
```bash
npm install
npm run dev
```
