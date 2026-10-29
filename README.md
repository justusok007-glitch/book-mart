# Book Mart

Point-of-sale and stock app for the Book Mart stationery shop (Okara).
English + Urdu, works offline, roles & permissions set by the Admin.

**Preview:** https://justusok007-glitch.github.io/book-mart/ (updates automatically on every push to `main`)

**Sell screen demo for the client (no login, sample data):** https://justusok007-glitch.github.io/book-mart/#/demo/sell

Design: logo colours (charcoal `#373435` + lime `#9fcc47`), light theme only, flat style, 48px touch targets. Lime is only used as a fill with charcoal text on it.

## Stack
- React + Vite + Tailwind CSS
- Firebase Authentication (username/password) + Cloud Firestore with offline cache
- Capacitor (later) to package the Android APK

## Build phases
1. ✅ Setup, login, roles & permissions, users, settings, English/Urdu
2. ✅ Catalog — categories, sub-categories, items, same-price colours/types, barcodes (type/scan/generate), opening stock, low stock
3. Buy & stock — suppliers, purchases, average cost, last cost price, low stock, supplier payables
4. Sell screen — scan / select (category tabs → sub-category → item → same-price items), cart, discount, cash/credit, receipt printing
5. Customers (udhaar ledger) and returns
6. Expenses, cash-out, investment, daily closing
7. Reports — profit & loss, cash-out summary, sales by day/salesman
8. Backup & restore, testing, APK release

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
