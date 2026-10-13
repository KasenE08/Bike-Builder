# Bike Builder — rules for Claude

Personal motorcycle build configurator. iPhone PWA on GitHub Pages. Owner-only use.

## How to work
- Ask questions and show a plan before writing code. Confirm before each phase.
- Data-accuracy calls (which figure, source or fitment is right): research and pick the most accurate yourself, note it; do not ask the owner.
- Be direct, keep work token-efficient (owner is on a limited plan).
- Work on the session's dev branch, open a PR to `main`. Once the owner approves a change, Claude merges the PR itself (owner does not merge). `main` auto-deploys to Pages.
- After each phase: explain simply what was built, update the progress log below.

## Hard rules
- **$0 to run:** static PWA only. No server, no paid APIs.
- **Public repo:** never commit personal data, retailer/manufacturer images, or backups. `.gitignore` blocks images (except app icons).
- **US units only:** mph, lb, lb-ft, hp. **Crank hp everywhere**; convert wheel-hp dyno gains (~10% drivetrain loss) and record the assumption.
- **Never invent a price.** Every price comes from a real US listing with URL + date checked. Not found → `usd: null` and flag. Price > 90 days old → "price may be outdated".
- Unpublished figures are estimated and marked `est: true` ("est." in UI). Forced induction on a bike that didn't ship with it → `roughGuess`.
- Can't reach 150 mph → 60–150 and 0–150 show "N/A, can't reach 150".
- Stock equipment shows as "Stock", not an add-on.
- Fewer than 3 real products in a category → show what exists and record a gap in `data/parts/_gaps.json`.
- Red = brand/actions only, never "bad". Green ▲ better, dark gray ▼ worse. White theme, no dark mode.

## Stack
Preact + TypeScript + Vite, vite-plugin-pwa (offline), IndexedDB via `idb` (builds, settings, price edits, custom parts), Vitest, GitHub Actions → Pages.

## Data
- `data/bikes/<bike-id>.json` — one per bike, shape `Bike` in `src/data/types.ts`.
- `data/parts/<category>.json` — array of `Part`; `fits` lists bike ids. Up to 5 real products per category per bike, shown by exact brand + model (no budget/mid/premium in the UI; `tier` is legacy).
- Every number carries `{ value, est, source, checked }`.
- Weights: `wetWeightLb` = ready to ride, full tank (physics uses this); `dryWeightLb` = no fuel/oil/coolant. Unpublished dry = wet − fuel×6.1 lb/gal − 12 lb (est.).
- Adding a bike = add a JSON file, then `npm run calibrate`.
- No photos or bike drawings (owner decision, Phase 5a).

## Engine
- Mod gains stack with diminishing returns: sort largest first, each next gain × 0.85^n, applied multiplicatively. Exhaust/intake reach full gain only with a tune.
- Time-step sim (torque curve, gears, traction/wheelie limit, shift time, drag, rolling resistance, rider weight default 155 lb).
- Per-bike `calibration` (cdA, launchG, shiftTimeS) fitted so stock sim matches published numbers.
- Limiter caps top speed unless tune's "remove limiter" is on.
- Code: `src/engine/` (curve, gains, sim, stock, calibrate, build). `npm run calibrate` rewrites every bike's `calibration`.
- Est. constants: exhaust/intake without tune = 50% of gain; stock shift 0.25 s (0.06 s with factory QS); calibration uses a 180 lb test rider (published tests), builds use the owner's 155 lb; torque curve synthesized from peak hp/torque rpm.
- Wrap/color is cosmetic only: never added to build price (owner decision, Phase 3a).

## Engine sound
- Generated live with Web Audio (no recordings): `src/sound/` (profile → worklet exhaust model; intake hiss; supercharger whine; turbo whistle + blow-off).
- Worklet (`worklet.ts`) = physically informed model: each cylinder's blowdown pulse is shaped in crank degrees (EVO 130° ATDC, ~200°; est.) with a ~0.5 ms smooth pressure front, travels its own header pipe (two-way waveguide with reflections), merges per the bike's real collector layout (`engine.exhaust`: 2-1 / 3-1 / 4-1 / 4-2-1 + pairing groups, pipe lengths est.), then link pipe → muffler (low-pass per exhaust kind, scaled by cylinder size) → outlet radiation (derivative). Intake pulses ring the runner + airbox and radiate too (ram-air louder at high rpm). Speed of sound in exhaust 520 m/s (est.).
- No fixed-pitch ringing or oscillators in the exhaust path (that caused the old "dings" on release). Crackle = broadband afterfire bursts synced to exhaust events. Controls glide (`setTargetAtTime`), no zipper steps. No per-sample allocation in the worklet.
- Each bike's `engine` = layout + firing angles in the 720° cycle (e.g. R1 crossplane 0-270-450-540, Panigale twin-pulse 0-90-290-380) + idle rpm (est.) + `ramAir` + `exhaust` plumbing. H2R's stock voice is its race silencer.
- Turbo: lagged boost (rpm + load), compressor whistle 2.2–10.7 kHz + intake hiss, duller/quieter exhaust, blow-off on lift. Supercharger: whine at crank × 9.2 (impeller), faint at idle, steep with rpm; breathy chirp on lift. Limiter = ignition cut with rpm bounce.
- Output: worklet soft-limits spikes (0.7 tanh) → `buildOutput` (compressor −12 dB 2.5:1, makeup, limiter −3 dB, tanh soft clip at 0.9) → per-exhaust level (stock 0.72, slip-on 0.86, full 0.94, race 1). Per-layout `trimDb` evens loudness.
- Verified (Phase 7d, scratch scripts + `worklet.test.ts`): firing order exact to 1 sample for all 12 bikes (unit test, catches a 20° error); pitch at 80% redline matches firing frequency for all 12; ping detector (sudden steady-pitch peak, validated by injected pings) finds no tonal dings after release, spectrograms show only broadband pops; 0 clipped samples; A-weighted loudness 3–7 dB above Phase 7c; slip-on ≈ +2 dB(A), race ≈ +3.7 dB(A) over stock; turbo/supercharger clearly audible.
- Exhaust voice from the part name (slip-on / full system / race; `exhaustKind` overrides). Tune = faster revs + crackle. Forced induction from `bike.stock` or a custom part's `fiType`.
- UI: Build screen "Engine sound" card (Start engine, Hold to rev, tach). iOS: `navigator.audioSession.type = 'playback'` so it plays with the silent switch on.
- Real recordings: not possible from this environment (network blocks freesound/wikimedia). If ever opened: CC0/CC-BY clips only, credited, generated sound as fallback.

## KE1000 (owner's custom bike)
- `src/data/ke1000.ts`: `KeSpec` (all owner inputs) → `keBike()` → a full `Bike` with `custom: true`. Stored on device (`settings` store, key `ke1000`), included in backups. `setCustomBike` / `allBikes()` in `src/data/bikes.ts`; catalog `bikes` stays real data only.
- Owner decisions (Phase 8): inline-6 screamer (fixed, no sound option), "use my numbers", custom parts only, crazy defaults (1000 cc, 260 hp @ 16,000, 92 lb-ft @ 12,500, 17,500 redline, 395 lb, 0–60 2.5 s, 0–150 7.2 s, 220 mph). Price = owner's own (not set by default; never invented).
- Physics: specs are fitted on save (`calibrate(b, fast)`, ~0.5 s). Stock KE1000 shows the owner's numbers exactly; a build shows owner number × (modded sim / stock sim), same rider (`pinToOwner` in `build.ts`).
- Sound: inline-6, firing 1-5-3-6-2-4 (even 120°), long 6-2-1 race pipes tuned low (front/rear three paired), always the race voice (exhaust parts never quiet it), heavy decel crackle. Owner found it whiny (Phase 8b) → `grumble`: per-cylinder burn imbalance ±45% (`rough`) puts energy on half-orders (roughness −23 → −9 dB; even I4s ≈ −20, R1/V4/twins ≥ 0), darker can (lowpass ×0.5), +5 dB low body, ram-air off. Owner numbers drive it: redline/idle = pitch range, displacement = depth/muffler, torque per liter = rev speed, hp per liter = rawness (`aggression`).
- UI: picker "Your bike" card, `#/ke1000` specs page (min–max shown under every field from `KE_LIMITS`; validation blocks impossible input; warnings allowed), Settings link, build editor "Edit specs", Compare.

## Progress log
- **Phase 1 (plan, stack, data format):** scaffold, data types, deploy workflow, this file. Approved.
- **Phase 2 (bike data):** 12 bike JSONs with sources (2026-10-12), `src/data/bikes.ts` loader, data tests (sources present, 150 mph N/A rule, gearing reaches top speed). Session network blocks direct page fetches; data came via web search with cited URLs. Gaps marked est.: Yamaha/Honda/Aprilia internal gear ratios, small-bike 0-60/top speed, R9/ZX-6R 0-150. Approved.
- **Phase 3a (part prices, Ninja 500 / RS 457 / ZX-4R / R7):** done. Approved. Prices = full/list price from real US listings (RevZilla first, then maker; no Amazon/eBay), via web search since direct fetches are blocked. Labor = est. hours × $147/hr (Nashville Motorcycle Repair). `effect` and `weightDeltaLb` deferred to Phase 3b. Wraps not priced. `src/data/parts.ts` loader + `parts.test.ts`. 51 parts, 48 gaps. Fitment is exact-model only: Ninja 400-only, ZX-4RR-only and pre-2026 R7 listings excluded (2026 R7 changed, e.g. 520 chain). Blemished/open-box-only prices not used. Dev branch for this phase: `claude/bike-build-phase-3a-6fpfvy` → PR to `main` on approval.
- **Phase 3b (part effects + weights):** every part has `effect` (hp/torque %, `est`, basis) and `weightDeltaLb` (Stat). No dyno for a part → est. from closest real data (same category/bike, or same engine). Gearing parts list tooth options (`sprocketOptions`, default stock, owner picks). Quickshifter `shiftTimeS` 0.06 s. ZX-4R tune = +20.2% (TST ECU-only dyno), not +35%. RS 457 marked factory-limited at 120 mph (BT Moto). Done.
- **Phase 4 (sim engine):** time-step sim + top-speed solver, gain stacking, build evaluator (price, hp, torque, weight, 0-60/60-150/0-150/top), calibration for all 12 bikes (cdA from top speed, or 0-150 when the limiter binds; launchG from 0-60). Big bikes match published within 2%. Ninja 500 (+7%) and RS 457 (+15%) stay slower than their est. 0-60 targets (physics says the targets were optimistic; Ninja 400 measured 4.07 s). ZX-4R 0-60 target corrected to 4.5 s est. Note: -1 front on the Ninja 500 adds a shift before 60 mph. Default rider 155 lb. Approved.
- **Phase 5a (core screens):** hash-routed Preact UI in `src/ui/` — Garage, bike picker (4 bikes with parts first, others stock-only), build editor (sticky stat bar with ▲/▼ vs stock and per-metric est., Stock/Budget/Mid/Premium per category, gap notes, price-not-found/outdated flags, gearing teeth, limiter switch, part detail sheet, cost table, autosave), Compare (any saved build or stock bike), Settings (rider weight). IndexedDB store `src/store/db.ts` (+ tests with fake-indexeddb). App icon (public/icon.svg + PNGs). Photos and drawings dropped. Approved.
- **Phase 5b (owner prices, custom parts, backup):** DB v2 adds `prices` (owner price per catalog part; listed price still shown) and `customParts` (tier `custom`, fits one bike, all numbers est.). Build editor: "Custom" option + "+ Add custom part" per category; part sheet: "Use my price"/reset, edit/delete custom. Settings: backup to Files (share sheet or download, `*.bikebuilder-backup.json`) and restore (replaces all). Approved; live.
- **App icon v2:** sportbike silhouette, red/black on white (`public/icon.svg`, `public/icons/icon-v2-*.png`). iPhone home-screen icons only update when the app is removed and re-added.
- **Offline/update fix:** service worker precaches only hashed JS/CSS; the page is fetched with `cache: no-cache` (bypasses GitHub's 10-min HTTP cache), icons network-first, cached copies only offline. `skipWaiting` + `clientsClaim`; `src/main.tsx` registers the SW, checks for updates on open/foreground and reloads once when a new version takes over. Verified with a GitHub-Pages-like server: updates show on the first open; offline still works.
- **Phase 6a (named products):** build editor lists every product by brand + model (radio list per category, collapsible, sorted by price, ⓘ for details); tiers removed from the UI; up to 5 products per category per bike. Owner approved.
- **Phase 6b (all 12 bikes):** 138 products, 135 gaps. Per bike: Ninja 500 32, R9 19, ZX-6R 17, RS 457 15, ZX-4R 14, R7 11, CBR650R 9, R1 9, Panigale V4 S 7, H2R 3, ZX-10R 2, Panigale V4 R 1. Fitment rule: listing must cover the exact model and the 2026 generation; older-year listings only where that model didn't change (H2R, ZX-6R 2024+, RS 457). 2026 CBR650R is E-Clutch only (counts as stock quickshifter). 2026 ZX-10R and R7 changed, so 2021-2025 parts are logged as gaps. Sums of two real listings are allowed with a note (Panigale sprockets). Done.
- **Phase 7 (engine sound):** owner chose generated sound, Hold-to-rev control, forced induction via custom parts (Turbo/Supercharger choice). 7b: per-bike voices, realistic turbo, audible supercharger, measured accuracy (see Engine sound). Owner asked for checks before merging. 7c: louder overall. 7d: rebuilt as a pipe/waveguide model per bike's real exhaust layout; release dings removed (see Engine sound).
- **Phase 8 (KE1000):** owner's fully custom bike (see KE1000). Also: output soft clipper without oversampling (its filter overshot the ceiling on dense high-rpm sound; peaks now ≤ 0.88). 360 tests.
- **Phase 8b:** KE1000 grumblier (see KE1000); min–max shown for every spec field.
