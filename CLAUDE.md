# Book Mart — instructions for Claude

Point-of-sale, stock and money app (React + Vite + Tailwind + Firebase, Android APK via Capacitor) for the Book Mart
stationery shop in Okara. Client/developer: Saqib Khalil.

**Before doing anything, read `MEMORY.md`.** It is the full project memory: decisions, code map, data model, rules,
build/test steps and history.

Non-negotiable working rules (details in MEMORY.md §2):
1. Push changes to `main` → the web preview updates (https://justusok007-glitch.github.io/book-mart/). The client
   checks the preview first. Build the Android APK **only when the client says "build APK"**
   (`gh api -X POST repos/justusok007-glitch/book-mart/actions/workflows/apk.yml/dispatches -f ref=main`).
2. Don't change existing features unless asked; design changes keep behaviour identical.
3. After any change to `firestore.rules`, tell the client to publish them in Firebase Console.
4. Trainee (training) roles must never be able to change real data (MEMORY.md §8b) — keep all three locks.
5. Free Firebase plan: no Cloud Functions, no Storage; photos are small data-URLs cached on each phone.
6. Explain results simply (the client is not a programmer). Never commit the signing key.
7. At the end of every change, update `MEMORY.md` (§11 history, §12 open items, §9 last APK build) and commit.
