# Sampath Finance Dashboard — v4

Personal Cash Flow Dashboard for Sampath Krishnaswamy Iyengar.
Built with React + Vite + Recharts + SheetJS.

---

## Features
- Multi-year cash flow tracker (FY 2025-26, 2026-27, and beyond)
- Editable actuals — click any number to update
- Net Worth tracker with projection
- Savings Goals with months-to-target calculator
- 18-month Cash Flow Forecast (Loan 1 auto-closes Jan 2027)
- Export all data to Excel / Import from Excel
- Add new fiscal years with one click

---

## Local Development

```bash
# Install dependencies
npm install

# Start dev server (opens at http://localhost:5173)
npm run dev

# Build for production
npm run build
```

---

## Deploy to Vercel (first time)

### Option A — Via GitHub (recommended)

1. Push this folder to a GitHub repo:
```bash
git init
git add .
git commit -m "Sampath Finance v4"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sampath-finance.git
git push -u origin main
```

2. Go to https://vercel.com → Sign in with GitHub
3. Click **"Add New Project"**
4. Select the `sampath-finance` repo
5. Vercel auto-detects Vite — just click **Deploy**
6. Your app is live at `sampath-finance.vercel.app`

### Option B — Via Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

---

## Secure Your App on Vercel (recommended)

Since this contains personal financial data:

1. Go to your project on vercel.com
2. **Settings → Password Protection**
3. Set a strong password
4. Only people with the password can open the app

Alternatively, keep the URL private — Vercel URLs are not indexed by search engines
(we've also added `noindex` to the HTML head).

---

## Updating the App (after changes)

If you're using GitHub:
```bash
git add .
git commit -m "Update: describe what changed"
git push
```
Vercel auto-redeploys in ~30 seconds. No manual steps needed.

---

## Adding a Sprint (new features)

Each sprint adds new tabs/panels. Ask Claude:
> "Build sprint 2 — add Budget vs Actual, Year-on-Year comparison, and subscription tracker"

Paste the new App.jsx, commit, push. Done.

---

## Your Data

- All data lives in your browser (React state) while the app is open
- Nothing is sent to any server
- **Always export to Excel before closing** to save your actuals
- Import the Excel file next time to restore your data
- Future sprint: add localStorage so data persists between sessions automatically

---

## Planned Sprints

| Sprint | Features |
|--------|----------|
| Sprint 2 | Budget vs Actual, Year-on-Year comparison, Subscription tracker |
| Sprint 3 | EMI prepayment simulator, Zero-based budget mode, Expense drill-down |
| Sprint 4 | Mobile layout, Monthly report card, Inter-company flow ledger |
| Sprint 5 | Tax planning panel, Retirement calculator, PDF export |

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| React 18 | UI framework |
| Vite 5 | Build tool |
| Recharts | Charts and graphs |
| SheetJS (xlsx) | Excel export/import |
| Vercel | Hosting |

No database. No backend. No subscription fees.
