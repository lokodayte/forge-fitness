# FORGE — Personal Fitness Tracker

A private, local-first, mobile-first fitness web app for training, cardio, nutrition, body progress and recovery. It's an installable PWA that works offline and deploys for free to GitHub Pages. There's no backend, no account, no API keys and no tracking: all data stays in your browser's IndexedDB.

> **Health & safety.** During setup FORGE asks whether you have symptoms or conditions that a doctor should check before resistance training (for example unexplained tremors or breathlessness). If you do, a health notice appears throughout, quoting your own description, and the training program is labelled **pending medical clearance**. No load or cardio progressions are suggested until you record that a clinician has cleared you (Settings → Health & safety). Your answers stay on your device. FORGE doesn't diagnose anything and isn't medical advice.
>
> **No personal data in the code.** Age, height, weight and health notes are entered during setup and stored only in your browser, so this repository can be public safely.

---

## Features

| Area | What it does |
|---|---|
| **Dashboard** | Today's planned activity, the weekly plan with completion ticks, the current 12-week phase, workouts completed vs planned, working sets, volume, cardio minutes, nutrition targets, recovery, and charts for weight, volume, sets and cardio. Every number comes from saved logs, and empty states say "No data available". |
| **Workout Tracker** | Start, pause, resume and finish sessions. Tick sets, enter load, reps or hold seconds, and RIR. Warm-up and working sets are kept separate. The rest timer can be paused, reset, extended by 15 s or skipped, and beeps/vibrates when it ends. You see last-session performance, personal bests and per-exercise notes. Exercises can be added, removed or reordered during a session, and there's a deload toggle. The session saves after every change and comes back after a refresh. You get a summary when you finish. |
| **Progression** | A load increase is suggested only when every prescribed set reached the top of the rep range at one load **and** you confirmed technique was controlled. The suggestion is optional and is the smallest increment you have available. It's never forced, and it's paused until medical clearance. |
| **12-week program** | Weeks 1–2 technique & baseline (≈3 RIR), 3–6 gradual progression (≈1–2 RIR), 7 optional deload (≈½ the working sets), 8–12 progressive overload, with an explanation for each phase. |
| **Editable program** | Workouts A/B/C are pre-loaded. You can edit exercises, sets, rep/hold ranges and rest, and create or delete workouts. History keeps a snapshot of each session, so editing templates never changes past records. |
| **Exercise Library** | 25 exercises, each with an original illustration and an animated version, main muscles, equipment, setup, steps, movement direction, form, breathing, common mistakes, and safer alternatives. Also shows your PBs and a strength chart. |
| **Abs & Core** | Choose the original or revised core programming, plus an optional side plank on a chosen day. Duplicate exercises are never added twice. Includes anatomy, breathing, technique, progression, common mistakes, and a note that ab exercises don't burn belly fat locally. |
| **Cardio** | Log walking, cycling, elliptical and more, with date, duration, distance, heart rate, effort and notes. Weekly and monthly charts show a 150-min guideline line. A gentle progression suggestion (≈10% per week) appears only after clearance. No calorie-burn estimates. |
| **Nutrition** | Meal logging, favourite meals, calories and macros (calories are derived 4/4/9 when left blank), water, and daily, weekly and 14-day charts. The 140–175 g protein target is preset. Calorie targets are optional: use the Mifflin–St Jeor formula with an uncertainty range, an estimate from your own logs, or a manual value. A 250–400 kcal deficit only becomes available once a maintenance estimate exists. |
| **Body Progress** | Weight log with a 7-day moving average and weekly trend. Waist, chest, arm, hip and thigh measurements. Private progress photos with side-by-side comparison. Strength graphs, recovery tracking (sleep, quality, fatigue, soreness, stress, readiness, notes, trends, sleep guidance, in-app reminders), weekly and monthly summaries, and optional targets with a realism check. No body-fat percentages are estimated. |
| **Calendar** | Month view of planned workouts, walks, cardio and rest days, completed sessions, logged cardio and recovery. Change or swap any day's activity, and edit the default weekly schedule. |
| **History** | Every completed session, set by set. Filter by date, exercise or workout. Edit or delete sessions, and compare two sessions side by side. |
| **Settings** | Profile, units (kg/lb), theme (dark/light/system), reduced motion, increments, targets, program start date, medical clearance, JSON backup and restore (validated, merge or replace), CSV export, persistent-storage request, delete-all, install instructions, formulas and credits. |

Accessibility: keyboard navigation, a skip link, visible focus rings, labelled controls, ARIA roles for tabs, switches, dialogs and timers, a table view behind every chart, reduced-motion support (system setting or in-app toggle), and AA-contrast colour tokens in both themes.

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · Lucide icons · Recharts · Dexie (IndexedDB) · vite-plugin-pwa (Workbox) · Vitest + Testing Library + fake-indexeddb. The Inter font is bundled locally.

## Project structure

```
├─ .github/workflows/deploy.yml   CI: typecheck → tests → build → deploy to Pages
├─ public/
│  ├─ icons/                      PWA icons (generated)
│  └─ media/exercises/            25 static + 25 animated SVG illustrations (generated, CC0)
├─ scripts/
│  ├─ generate-media.mjs          Draws the exercise illustrations (kinematic stick-figure engine)
│  └─ generate-icons.mjs          Renders the PNG icons without dependencies
├─ src/
│  ├─ App.tsx, main.tsx           Routing (hash-based), theme, providers
│  ├─ components/                 Layout/nav, UI kit, charts, exercise image, medical notice, PWA prompt
│  ├─ data/                       Exercise library, default program & core options, 12-week phases
│  ├─ db/                         Types, Dexie schema + migrations, write helpers
│  ├─ hooks/                      Live queries, clock
│  ├─ lib/                        Pure logic: dates, units, sessions, training stats, metrics, backup, CSV
│  ├─ pages/                      One file per screen
│  └─ __tests__/                  Unit, integration and component tests
└─ vite.config.ts                 Base path, PWA manifest & caching, test config
```

---

## 1. Install dependencies

You need **Node.js 20.19+ or 22+** (LTS recommended) and npm.

```bash
npm install
```

## 2. Run locally

```bash
npm run dev
```

Open the printed URL (usually http://localhost:5173). The service worker is only active in production builds (see step 4).

## 3. Run tests

```bash
npm test
```

Also useful:

```bash
npm run typecheck
```

```bash
npm run check
```

`npm run check` runs typecheck, tests and the production build in one go.

The tests cover the progression rules, chart behaviour (empty states, table view, legend), the 7-day weight average, nutrition and maintenance calculations, local-date and DST handling, workout session tracking (sets, pause/resume, rest timer, deload), backup/restore (round-trip, merge de-duplication, validation, transactional failure, migration), the Dexie schema upgrade, CSV escaping, kg/lb conversion, core-option de-duplication, and that every exercise has its illustration files.

## 4. Build production files

```bash
npm run build
```

This regenerates the illustrations and icons, type-checks, and writes the site to `dist/`. To preview the production build, with the service worker and offline support:

```bash
npm run preview
```

### Base path (GitHub Pages subpath)

Vite needs to know the URL path the site is served from. Set it with the `VITE_BASE` environment variable:

| Where the site lives | `VITE_BASE` |
|---|---|
| `https://<user>.github.io/<repo>/` (project site) | `/<repo>/` (e.g. `/forge-fitness/`) |
| `https://<user>.github.io/` (user/org site) or a custom domain | `/` |
| Local dev | not needed (defaults to `/`) |

To build for a subpath locally:

```bash
VITE_BASE=/forge-fitness/ npm run build
```

The GitHub Actions workflow sets this **automatically** to `/<repository-name>/`. To override it (for a user site or custom domain), go to the repository's **Settings → Secrets and variables → Actions → Variables** and add a variable named `VITE_BASE` with the value `/`.

**Refreshing and navigation:** FORGE uses hash routes (`…/forge-fitness/#/nutrition`). The server only ever serves `index.html`, so refreshing any page and following deep links work on GitHub Pages without 404 workarounds.

## 5. Upload to GitHub

1. Create a new **empty** repository on github.com, for example `forge-fitness`. Don't add a README or licence there.
2. In this project folder:

```bash
git init
```

```bash
git add .
```

```bash
git commit -m "FORGE fitness tracker"
```

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/<your-username>/forge-fitness.git
```

```bash
git push -u origin main
```

## 6. Enable GitHub Pages

1. In the repository go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Open the **Actions** tab. The "Test & deploy to GitHub Pages" workflow runs on every push to `main`. If it ran before Pages was enabled, open the workflow and click **Re-run all jobs**, or use **Run workflow**.
4. When it finishes, the site is live at `https://<your-username>.github.io/forge-fitness/`. The URL also appears in the deploy job and in Settings → Pages.

Then open the site on your phone and choose **Add to Home Screen** (iOS Safari: Share menu) or **Install app** (Android/Chrome/Edge) to install it.

## 7. Update the website later

Edit the code, then commit and push:

```bash
git add .
```

```bash
git commit -m "Describe your change"
```

```bash
git push
```

The workflow tests, builds and redeploys automatically. Installed copies download the new version in the background and show **"A new version of FORGE is available — Update"**. Your data isn't affected by updates. If you change the database shape, add a new `this.version(n)` block in `src/db/db.ts` with an `.upgrade()` step, and update `migrateBackup()` in `src/lib/backup.ts` so older backups still import.

## 8. Back up your personal data

Your data exists **only in the browser on the device you use**. It doesn't sync between phone and computer or between browsers.

- **Back up:** Settings → Your data → **Download backup**. This saves `forge-backup-YYYY-MM-DD.json`. Progress photos are only included if you turn on "Include progress photos", which makes the file much larger, so store it somewhere private. The app shows when you last backed up and suggests a new backup after 14 days.
- **Restore or move devices:** Settings → **Restore from file…**. The file is validated first and you see what it contains.
  - **Merge (safe)** adds only records that don't already exist (matched by id, and by date for weigh-ins and recovery). It never overwrites anything.
  - **Replace all** wipes current data and loads the backup. You have to type `REPLACE` to confirm. An import is transactional: if anything fails, nothing changes.
- **Spreadsheets:** export CSV files for workout sets, cardio, food, water, weight, measurements and recovery.
- **Reduce the risk of data loss:** tap **Request persistent storage** in Settings. Don't use private/incognito windows. On iPhone, install FORGE to the Home Screen, because Safari may delete site data for websites you haven't opened for several weeks. Clearing the browser's site data, or uninstalling the browser, deletes FORGE data.

---

## How the numbers are calculated

All dates use the device's local time zone (stored as `YYYY-MM-DD`; never derived via UTC). Weeks start on Monday. Loads are stored in kilograms; pounds use the exact factor 0.45359237.

| Metric | Formula |
|---|---|
| Working sets | Count of sets of type *working* that are ticked complete |
| Volume | Σ load × reps over completed working sets (warm-ups, timed holds and body-weight sets add 0) |
| Weekly frequency | Completed sessions dated Monday–Sunday |
| Completed vs planned | min(100%, completed sessions ÷ scheduled workout days from the program start to today) |
| Consistency | Share of fully elapsed weeks where completed sessions ≥ planned workouts |
| Strength change | Latest top working-set load − first top working-set load (no 1RM estimates) |
| Progression eligibility | All prescribed working sets at ≥ the top of the rep range, one load, technique confirmed → optional + smallest increment |
| 7-day weight average | Mean of every weigh-in dated within the 7 calendar days ending on that date (gaps aren't filled) |
| Weekly weight trend | Change of the 7-day average over the last ~14 days, scaled to per-week |
| Calories | Entered kcal × servings, or (protein×4 + carbs×4 + fat×9) × servings when left blank |
| Maintenance (formula, estimate) | Mifflin–St Jeor: 10·kg + 6.25·cm − 5·age + 5 (male) / −161 (female), × activity factor (1.2–1.9); shown with a ±10% band |
| Maintenance (from logs, estimate) | Avg intake on logged days − (Δ trend weight × 7,700 kcal/kg) ÷ days; needs ≥10 food days and ≥6 weigh-ins over ≥14 days |
| Calorie target | Maintenance − deficit (250–400 kcal, only if enabled) |
| Weekly cardio | Σ logged minutes Monday–Sunday; the guideline line is 150 min/week (WHO) |
| Sleep averages | Mean of entered hours over 7 and 28 days |
| Recovery index | Mean of 1–5 ratings (fatigue, soreness and stress inverted) rescaled to 0–100; a summary, not a medical score |

## Exercise media & credits

- All 25 exercise illustrations (static and animated) are **original diagrams generated for FORGE** by `scripts/generate-media.mjs` and released under **CC0 1.0**. They're labelled as illustrations, bundled locally, and precached for offline use. No stock photos, hot-linked images or third-party assets are used. Credits are also listed in Settings → About.
- Icons: [Lucide](https://lucide.dev) (ISC). Font: Inter (SIL OFL 1.1). Charts: Recharts (MIT). Storage: Dexie.js (Apache-2.0).

To change an illustration, edit its pose in `scripts/generate-media.mjs` and run `npm run media`.

## Troubleshooting

- **Blank page on GitHub Pages:** the base path is wrong. Check the `VITE_BASE` variable (see above) and redeploy.
- **"Storage unavailable":** the browser is blocking IndexedDB, which often happens in private mode. Use a normal window.
- **An old version keeps loading:** close all FORGE tabs and reopen, or accept the in-app "Update" prompt.
