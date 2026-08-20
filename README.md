# EDUNEXIS — Digital Data Saving & Receipt System

A fully functional, client-side web application for college fee receipt management, designed with a futuristic JARVIS-inspired HUD interface.

**EDUNEXIS**  
Digital Data Saving & Receipt System  
Secure • Smart • Organized • Digital

---

## Features

- Secure login & new user registration
- Separate **Login Password** and **Master Delete Password**
- Institute name locked to user account and printed on every receipt
- Automatic unique receipt numbers (`EDX-YYYY-XXXXXX`)
- Dynamic fee table with custom heads, discount, late fee, totals & amount-in-words
- Receipts become **read-only** after finalization (no edit)
- Controlled cancel workflow + audit trail
- Delete only with Master Password + typing `DELETE`
- Receipt History with search, filters, pagination
- Print-ready professional receipts
- PDF generation (html2canvas + jsPDF)
- Excel export (SheetJS)
- IndexedDB local database (Users, Receipts, Audit Logs, Deleted Records, Settings)
- Backup & Restore (JSON)
- Dashboard with live stats and Chart.js analytics
- Responsive design (desktop, tablet, mobile)
- GitHub Pages compatible (pure static HTML/CSS/JS)

---

## Quick Start (Local)

1. Clone or download this repository.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari).
3. Or serve the folder with any static server:

```bash
# Example with Python
python -m http.server 8080
# Then open http://localhost:8080
```

---

## GitHub Pages Deployment

1. Create a new GitHub repository.
2. Upload the entire `EDUNEXIS` folder contents to the repository root (or keep the folder and set Pages source to `/EDUNEXIS`).
3. Go to **Settings → Pages**.
4. Select branch `main` (or `master`) and folder `/` (or `/docs` if you place files there).
5. Save. Your site will be available at `https://<username>.github.io/<repo>/`.

**Important:** Relative paths are used throughout. The app works whether hosted at domain root or in a subfolder.

---

## First-Time Use

1. Open the site → initialization sequence runs.
2. Click **New Registration**.
3. Fill User Information + **Institute Name** (required) + Login Password + **Master Password** (must be different).
4. After registration you see a welcome screen → **Go to Dashboard**.
5. Create your first receipt from **Create Receipt**.

---

## Security Notes (Client-Side)

This is a **frontend-only** application intended for GitHub Pages / single-device use.

- Passwords are hashed with SHA-256 in the browser and stored in IndexedDB.
- There is **no** server-side authentication.
- Data lives in the browser’s IndexedDB — it does **not** sync across devices.
- Clearing browser data will erase records (use **Backup** regularly).
- Do **not** claim bank-level security for this deployment.

For multi-user institutional use, migrate to a proper backend (Firebase, Supabase, Node.js + PostgreSQL/MySQL, etc.). The UI is structured so a backend can be integrated later.

---

## Project Structure

```
EDUNEXIS/
├── index.html          # Login + Registration + Init
├── dashboard.html      # Command Center
├── receipt.html        # Create Receipt
├── history.html        # History / Search / Export
├── reports.html        # Analytics
├── profile.html        # User Profile
├── security.html       # Security Center + Audit Log
├── settings.html       # Backup & Restore
├── css/
│   ├── style.css
│   ├── dashboard.css
│   ├── receipt.css
│   ├── responsive.css
│   └── print.css
├── js/
│   ├── database.js     # IndexedDB
│   ├── auth.js         # Registration / Login / Passwords
│   ├── receipts.js     # Receipt CRUD + Stats
│   ├── export.js       # Excel
│   ├── pdf.js          # PDF generation
│   ├── backup.js       # Backup / Restore
│   └── app.js          # Shared utilities
├── assets/
└── README.md
```

---

## External Libraries (CDN)

- Chart.js — dashboard & reports charts  
- html2canvas + jsPDF — PDF generation  
- SheetJS (XLSX) — Excel export  

Internet connection is required for the first load of these CDNs.

---

## License

This project is provided as-is for educational and institutional internal use.  
The visual design is an original futuristic HUD aesthetic and does not copy any copyrighted Iron Man / JARVIS assets.

---

**EDUNEXIS** — Digital Data Saving & Receipt System  
Built for college offices that need a clean, modern, offline-capable receipt workflow.
