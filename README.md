# ___-Ledger — Personal Finance (PWA)

A fully offline, installable personal finance app. No server, no build step,
no external dependencies at runtime — plain HTML/CSS/JS backed by your
phone's own storage. The app name is self-personalizing: it shows
"___-Ledger" until you enter your name in **Profile**, then it becomes
e.g. "Patrick's Ledger" everywhere — tab title, sidebar, lock screen, and
(where the platform allows it) the install prompt.

## What's in this folder

```
index.html    the app shell
styles.css    all styling (ledger aesthetic — system fonts only)
app.js        all application logic, including the PIN lock and branding
manifest.json makes it installable
sw.js         service worker — caches everything for offline use
icons/        app icons (regular + maskable, 192px & 512px)
```

## 1. Create the repository

For the **shortest possible link**, name the repo exactly:

```
<your-github-username>.github.io
```

e.g. if your username is `victormbothuavm-source`, name the repo
`victormbothuavm-source.github.io`. GitHub serves this special repo name
at the root of your username, so your app ends up at:

```
https://<your-github-username>.github.io/
```

with no extra path. (If you'd rather keep a normal repo name like
`ledger-app`, that's fine too — your link is just longer:
`https://<username>.github.io/ledger-app/`.)

## 2. Upload the files

- Click **Add file → Upload files**
- Drag in *everything inside this folder*: `index.html`, `styles.css`,
  `app.js`, `manifest.json`, `sw.js`, `README.md`, and the `icons/`
  subfolder (drag the whole `icons` folder in — GitHub preserves the
  subfolder structure)
- Commit the changes

## 3. Turn on GitHub Pages

- **Settings → Pages**
- Source: **Deploy from a branch** → Branch: **main**, folder **/ (root)**
  → **Save**
- Give it a minute, then open the URL GitHub shows you

## 4. Install it on your phone

- **Android (Chrome):** tap the install banner, or menu → **Add to Home
  screen** / **Install app**
- **iPhone (Safari):** tap **Share** → **Add to Home Screen**

It then opens full-screen with its own icon and works with **zero internet
connection**.

## Personalizing the name

Open the app → **Profile** → enter a name → it's saved automatically. From
then on the app displays "**\<Name\>'s Ledger**" in the tab title, sidebar,
and lock screen. This works instantly, no re-upload needed.

Two platform quirks worth knowing:
- **If you already installed the home-screen icon before setting your
  name**, the *icon's label* on your home screen won't rename itself
  automatically — remove the icon and re-add it ("Add to Home Screen" /
  "Install app" again) after setting your name, so it picks up the new
  label.
- **The icon artwork itself** (the graphic on the icon, not the text
  label) stays the generic "L" ledger mark — regenerating a custom
  monogram icon per name isn't something the app can do on its own. If
  you want a personalized icon graphic, send me the name and I can
  generate a matching icon file for you to swap in.

## Data & backup

All your data lives in your phone's browser storage for this specific
site — nothing is sent anywhere, including your name and PIN.

- **Don't clear your browser's site data** for this app, or your records
  (and PIN) will be wiped.
- Use **More → Export full backup (JSON)** regularly and keep the file
  somewhere safe. Restore any backup from the same page via **More →
  Import**.
- A fresh install (new phone, cleared storage) always starts empty —
  bring your data across with a JSON backup.

## App lock (PIN)

Set a PIN in **Settings → App lock**. Once set, the app shows a lock
screen every time it's opened (or after "Lock now"), and won't show any
data until the correct PIN is entered. The PIN is hashed before storage,
but this protects against casual snooping — not a determined attacker
with real access to the device. **"Forgot PIN?" only offers a full
reset**, which erases everything — keep a JSON backup in case you ever
forget it.

## Notes on this version

- Six starter accounts (Cash, M-Pesa, Airtel Money, Bank, Savings,
  Investment) all at KES 0 — rename, delete or add more in **Accounts**.
  Each account has a notes field, a P&L figure (income − expenses through
  that account), and an "Accessible within 72h" toggle used by the
  Dashboard's Free/Locked Liquidity split and the Accounts page filter.
- **Categories** are managed from **Settings**, not a separate page.
  Selecting "+ Add new category…" in any category dropdown lets you create
  one on the spot (asks expense or income).
- **Debts & Loans** connect to real accounts and transactions: recording a
  new debt, a loan given, a repayment, or a collection can post an actual
  transaction against an account and update the debt's paid amount — from
  either the Debts page or directly from Add Transaction (categories
  "Debt", "Loan", "Debt Repayment", "Loan Repayment").
- **Split Calculator** lets you divide an amount across as many
  percentage-based allocations as you want (starts with a 50/30/20
  Needs/Wants/Savings template), plus a notes field — all saved
  automatically.
- A floating **+** button on every page jumps straight to Add Transaction.
- Recurring bills/transactions are tracked as a flag but don't
  auto-generate future entries yet — you mark them paid manually.
- Receipts are a text note, not a real file attachment.
- Charts are custom-built (no external chart library) so everything works
  fully offline with no CDN dependency.
