# DomainSelector

DomainSelector is a BlueTree Digital campaign workspace for turning client onboarding inputs into a scored domain shortlist and campaign brief. It loads publisher inventory from CSV, applies configurable scoring rules, lets the campaign team select placements, and exports an XLSX workbook for fulfillment.

## Features

- Multi-step campaign intake for client details, target pages, link criteria, goals, and call notes
- Deterministic domain scoring based on niche overlap, DR, traffic, price, ranking, geo fit, and red flags
- Editable runtime scoring configuration saved in browser local storage
- Config version history and rollback from the in-app scoring configuration tab
- Saved campaign shelf for reopening past campaigns, including selected shortlist state
- Mid-refresh recovery for the current campaign step, inputs, and selected domains
- Inventory validation for malformed CSV files and missing required columns
- Shortlist and disqualification views for publisher inventory
- Budget summary and over-budget warning before finalizing a campaign brief
- Campaign brief copy action and XLSX export with client, target page, CM, and referring domain sheets

## Tech Stack

- React 19
- Vite 7
- ExcelJS for workbook export
- Lucide React icons

## Getting Started

Install dependencies:

```bash
npm install
```

Run the local development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Project Structure

```text
src/
  main.jsx          React application and scoring/export logic
  styles.css        Application styles
public/
  data/
    inventory.csv   Publisher inventory used by the app
  config/
    scoring-config.json
                    Default scoring weights, hard rules, and overrides
```

## Data And Configuration

The app expects inventory at `public/data/inventory.csv`. The CSV must include a `Domain` header row and the columns used by the scoring and export flow, including `DR`, `Traffic`, `Ranking`, `Link Type`, `GP Price`, `LI Price`, `Country. Traffic`, `Niche`, `Main`, `Complementary`, `Indirect`, `TAT`, and `Contact`.

Default scoring settings live in `public/config/scoring-config.json`. Users can edit the scoring JSON inside the app under **Domain Matching > Scoring Config**; those runtime changes are stored in local storage under `domainselector.scoringConfig.v1`.

When a config is saved, the previous version is archived under `domainselector.scoringConfigHistory.v1` and can be restored from the rollback history in the app. To roll back manually, copy the desired archived config back into `domainselector.scoringConfig.v1` in browser local storage, or use the rollback button.

Campaign form state is stored locally in the browser under `domainselector.campaign.v1`. Saved campaigns are stored under `domainselector.savedCampaigns.v1`; the current selected shortlist is stored under `domainselector.selectedDomains.v1`.

## Scoring Overview

Domains can be disqualified by hard rules for minimum DR, minimum traffic, nofollow links when dofollow is required, and poor ranking. Eligible domains receive a weighted score from:

- Topic or niche overlap with the campaign
- DR and traffic strength
- Price fit against campaign budget per link
- Inventory ranking quality
- Geo compatibility
- Red flag status

Industry-specific overrides can adjust weights when a campaign industry matches an override in the scoring config.

## Deployment

This app is a static Vite build. Any static host works.

```bash
npm run build
```

Deploy the generated `dist/` directory to the host of your choice, such as Netlify, Vercel static hosting, Cloudflare Pages, or an internal static file server.

Rollback is host-specific: redeploy the previous successful build artifact or revert the Git commit and deploy again. Runtime scoring config rollback does not require redeploying when the app is used in the same browser profile.

## Export Fidelity Note

The XLSX export creates the four required workbook tabs and includes the campaign management fields used by the current app flow. The original test brief requires byte-for-byte matching against BlueTree's sample XLSX template, including exact headers, ordering, formulas, and formatting. That sample template is not present in this repository, so exact byte-for-byte parity cannot be verified here. Once the template is added, the export should be wired to clone that workbook structure directly instead of generating sheets from scratch.

## Stability Notes

- The scorer is deterministic: the same campaign brief, vendor CSV, and config version produce the same ranked shortlist.
- Scoring runs in memory and is designed for the requested 500 to 1,000 row inventory range.
- API keys are not used or exposed. The current niche matching is deterministic keyword overlap rather than an LLM call.
- This is currently a browser-only single-user tool, so server-side logging is not available. For production, add a small backend or hosted logging endpoint before using it as a mission-critical shared deployment.
