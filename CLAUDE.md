# CLAUDE.md: Bike Builder

Personal motorcycle build configurator PWA for the owner's iPhone. Pick a stock sport bike, add mods, see cost, performance change and a wrap preview. Save and compare builds.

## Hard rules
- **$0 to run.** Static PWA on GitHub Pages. No server, no paid APIs.
- **Public repo: never commit personal data.** Builds, price edits, custom parts, photos, rider weight and backups live only on the phone (IndexedDB). Bike/part data is fine.
- **Never invent a price.** Every part price comes from a real current US listing with `priceSource` and `priceChecked`. If not found, `priceUsd: null` + `needsPrice: true`.
- **Every stat has a source or is marked `est: true`** with a note. Estimated numbers show an "est." tag in the UI. Forced induction on a non-FI bike gets `roughGuess: true`.
- **No copied photos.** Parts link to product pages; user photos are stored on-device only. Bike drawings are original SVGs.
- Offline-first and fast.

## Workflow
- Work on `dev`; merge to `main` only after the owner approves (via PR).
- Build in phases; ask/confirm before each phase. After each phase: update the progress log below and explain simply what was built.
- Owner is on a limited plan: keep work token-efficient.
- Before commit: `npm test` and `npm run typecheck` pass.

## Stack
Vite + Preact + TypeScript, Vitest, vite-plugin-pwa, idb-keyval (IndexedDB). Deployed by GitHub Actions to `https://kasene08.github.io/Bike-Builder/` (vite `base: '/Bike-Builder/'`).

## Data format (see `src/types.ts`)
- `data/bikes/<id>.json`: one bike. Stats are `{ value, source, est, note? }`. US units: USD, crank hp, lb-ft, wet lb, mph, s, cc. `physics` holds drivetrain inputs; `cdA`/`launchFactor` are fitted so stock numbers match published ones. `shape` drives the shared wrap template.
- `data/parts/<category>.json`: array of parts. `slot` (default = category) makes parts replace each other. `requires` lists categories a part needs (forced-induction → ecu). `labor` is shown separately. `effects` are % hp/torque, weight lb, sprocket deltas, cdA multiplier; `assumption` records where they come from.
- `src/validate.ts` + `src/data.test.ts` enforce sources, dates and legal reasons. New JSON files are auto-loaded via `import.meta.glob`.

## Design
White base, red accent (#d0021b) for brand/actions/prices only. Light gray for cards/dividers. No dark theme. Premium store feel: product cards, "Add to build", cart-style sticky summary. Stat deltas: green ▲ better, dark gray ▼ worse. Estimates: lighter style + "est.".

## Progress log
- **Phase 1 (plan, stack, data format):** Scaffolded Vite/Preact/TS/Vitest/PWA. Defined types for bikes, parts, builds, settings. Data validator + tests. Example bike file (V4 S, values pending Phase 2). Rough V4 S wrap sample made outside the repo for the owner to judge drawing style.
