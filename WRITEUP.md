# DomainSelector Write-Up

## Stack Choice

I used React with Vite because this is a single-user internal tool with a spreadsheet-like workflow and no authentication requirement. The static app is quick to run locally, easy to deploy to any static host, and keeps the operational surface small. ExcelJS handles XLSX generation in the browser so the delivery team can export without a backend round trip.

The scoring layer is deterministic keyword overlap rather than an LLM call. For this test, repeatability matters more than expressive reasoning: the same brief, inventory, and scoring config should produce the same shortlist every time. Prompt strings are still stored in config so an LLM reasoning pass can be added later without changing the shape of the admin workflow.

## UX Decisions

The workflow moves left to right through intake, criteria, expectations, notes, matching, and final brief. That keeps a non-technical account or delivery user focused on one small decision at a time instead of starting from a dense spreadsheet.

Reasoning is visible in the shortlist table as a concise one-line summary, with the score breakdown shown as compact bars. The table stays scannable while still giving the user enough signal to trust or challenge each pick.

Disqualified domains live in their own tab with plain-language reasons. This keeps rejected inventory out of the shortlist while making the scoring system auditable when someone asks why a familiar publisher did not appear.

The app saves the current campaign, selected domains, active step, and named past campaigns in browser storage. A user can refresh mid-job or come back later and continue without rebuilding the brief.

Scoring config is edited in a JSON admin panel with version history and rollback. Weight changes apply live after save, while campaign inputs update the shortlist immediately.

## What I Cut

I did not add LLM-based niche matching because it would introduce latency, API-key handling, non-determinism, and timeout states. The deterministic scorer covers the current framework and is easier to validate.

I did not add a backend. For a production internal deployment, I would add server-side logging, shared campaign storage, and a real config store so changes are centralized across users instead of stored per browser.

I also did not claim byte-for-byte XLSX compatibility because the required sample workbook is not in this repository. The current export creates the required workbook sections, but exact parity should be implemented by cloning the provided template once it is available.

## What I Would Change With More Time

I would add a small API service with SQLite or Postgres for saved campaigns, config versions, and audit logs. I would also add automated XLSX snapshot tests against the official campaign-management template, plus CSV fixture tests for malformed uploads and missing columns.
