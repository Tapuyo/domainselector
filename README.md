# DomainSelector

DomainSelector is a BlueTree Digital campaign workspace for turning client onboarding inputs into a scored domain shortlist and campaign brief. It loads publisher inventory from CSV, applies configurable scoring rules, lets the campaign team select placements, and exports an XLSX workbook for fulfillment.

## Features

- Multi-step campaign intake for client details, target pages, link criteria, goals, and call notes
- Deterministic domain scoring based on niche overlap, DR, traffic, price, ranking, geo fit, and red flags
- Editable runtime scoring configuration saved in browser local storage
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

Default scoring settings live in `public/config/scoring-config.json`. Users can edit the scoring JSON inside the app; those runtime changes are stored in local storage under `domainselector.scoringConfig.v1`.

Campaign form state is also stored locally in the browser under `domainselector.campaign.v1`.

## Scoring Overview

Domains can be disqualified by hard rules for minimum DR, minimum traffic, nofollow links when dofollow is required, and poor ranking. Eligible domains receive a weighted score from:

- Topic or niche overlap with the campaign
- DR and traffic strength
- Price fit against campaign budget per link
- Inventory ranking quality
- Geo compatibility
- Red flag status

Industry-specific overrides can adjust weights when a campaign industry matches an override in the scoring config.
