# Bike Builder — rules for Claude

Personal motorcycle build configurator. iPhone PWA on GitHub Pages. Owner-only use.

## How to work
- Ask questions and show a plan before writing code. Confirm before each phase.
- Be direct, keep work token-efficient (owner is on a limited plan).
- Dev branch = `claude/bike-build-configurator-g5w85d`. Merge to `main` (via PR) only after owner approval. `main` auto-deploys to Pages.
- After each phase: explain simply what was built, update the progress log below.

## Hard rules
- **$0 to run:** static PWA only. No server, no paid APIs.
- **Public repo:** never commit personal data, reference photos, retailer/manufacturer images, or backups. `.gitignore` blocks images; keep reference photos in the session scratchpad.
- **US units only:** mph, lb, lb-ft, hp. **Crank hp everywhere**; convert wheel-hp dyno gains (~10% drivetrain loss) and record the assumption.
- **Never invent a price.** Every price comes from a real US listing with URL + date checked. Not found → `usd: null` and flag. Price > 90 days old → "price may be outdated".
- Unpublished figures are estimated and marked `est: true` ("est." in UI). Forced induction on a bike that didn't ship with it → `roughGuess`.
- Can't reach 150 mph → 60–150 and 0–150 show "N/A, can't reach 150".
- Stock equipment shows as "Stock", not an add-on.
- Fewer than 3 real products in a category → show what exists and record a gap in `data/parts/_gaps.json`.
- Red = brand/actions only, never "bad". Green ▲ better, dark gray ▼ worse. White theme, no dark mode.

## Stack
Preact + TypeScript + Vite, vite-plugin-pwa (offline), IndexedDB via `idb` (builds, photos, settings, price edits, custom parts), Vitest, GitHub Actions → Pages.

## Data
- `data/bikes/<bike-id>.json` — one per bike, shape `Bike` in `src/data/types.ts`.
- `data/parts/<category>.json` — array of `Part`; `fits` lists bike ids. Up to 3 tiers (budget/mid/premium) per category per bike.
- Every number carries `{ value, est, source, checked }`.
- Weights: `wetWeightLb` = ready to ride, full tank (physics uses this); `dryWeightLb` = no fuel/oil/coolant. Unpublished dry = wet − fuel×6.1 lb/gal − 12 lb (est.).
- Adding a bike = add a JSON file (uses the `generic` drawing until it gets its own).

## Engine
- Mod gains stack with diminishing returns: sort largest first, each next gain × 0.85^n, applied multiplicatively. Exhaust/intake reach full gain only with a tune.
- Time-step sim (torque curve, gears, traction/wheelie limit, shift time, drag, rolling resistance, rider weight default 210 lb).
- Per-bike `calibration` (cdA, launchG, shiftTimeS) fitted so stock sim matches published numbers.
- Limiter caps top speed unless tune's "remove limiter" is on.
- Wrap/color is cosmetic only: never added to build price (owner decision, Phase 3a).

## Drawings
Side-profile SVG per bike, traced from owner's reference photo (potrace → hand-redrawn clean panels: tank, fairing, tail, bellyPan, wheels, frame). Two-tone flat shading per panel, signature details listed before drawing, no floating parts, render and compare to photo before showing. Do one bike first and get approval.

## Progress log
- **Phase 1 (plan, stack, data format):** scaffold, data types, deploy workflow, this file. Approved.
- **Phase 2 (bike data):** 12 bike JSONs with sources (2026-10-12), `src/data/bikes.ts` loader, data tests (sources present, 150 mph N/A rule, gearing reaches top speed). Session network blocks direct page fetches; data came via web search with cited URLs. Gaps marked est.: Yamaha/Honda/Aprilia internal gear ratios, small-bike 0-60/top speed, R9/ZX-6R 0-150. Approved.
- **Phase 3a (part prices, Ninja 500 / RS 457 / ZX-4R / R7):** done. Approved. Prices = full/list price from real US listings (RevZilla first, then maker; no Amazon/eBay), via web search since direct fetches are blocked. Labor = est. hours × $147/hr (Nashville Motorcycle Repair). `effect` and `weightDeltaLb` deferred to Phase 3b. Wraps not priced. `src/data/parts.ts` loader + `parts.test.ts`. 51 parts, 48 gaps. Fitment is exact-model only: Ninja 400-only, ZX-4RR-only and pre-2026 R7 listings excluded (2026 R7 changed, e.g. 520 chain). Blemished/open-box-only prices not used. Dev branch for this phase: `claude/bike-build-phase-3a-6fpfvy` → PR to `main` on approval.
- **Phase 3b (part effects + weights):** every part has `effect` (hp/torque %, `est`, basis) and `weightDeltaLb` (Stat). No dyno for a part → est. from closest real data (same category/bike, or same engine). Gearing parts list tooth options (`sprocketOptions`, default stock, owner picks). Quickshifter `shiftTimeS` 0.06 s. ZX-4R tune = +20.2% (TST ECU-only dyno), not +35%. In progress.
