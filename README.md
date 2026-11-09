# DesignPro — Custom Printing, Premium Packaging & Corporate Gifting

**Design. Visualise. Estimate. Approve. Manufacture. Deliver.**

DesignPro is a responsive, India-first customer storefront and manufacturing-console **UAT evaluation foundation** informed by the **Custom Printing & Packaging BRD v2.0** (368 requirements). It does **not** yet implement every BRD requirement. The included ready-to-run code demonstrates product configuration, distinct category artwork, conceptual CSS 3D preview, the indicative costing engine, quote review, artwork proof workflow, order state management, staff permissions, inventory, factory job cards, payment-provider boundaries, refunds and manual shipment tracking.

> **Release status: DEVELOPMENT / UAT ONLY. Do not accept live customer payments, upload sensitive artwork, or deploy publicly without completing `docs/RELEASE_GATES.md`.**

## Run locally (Node.js 22+)

```bash
# macOS/Linux
cp .env.example .env
# PowerShell: Copy-Item .env.example .env
# Set BOOTSTRAP_EMAIL / BOOTSTRAP_PASSWORD (12+ characters)

npm run db:migrate
npm run admin:bootstrap
npm run dev
# http://localhost:8787
```

The app intentionally has no third-party runtime dependencies. It uses `node:sqlite` (experimental in Node 22) for *local development*; use managed PostgreSQL and a reviewed persistence adapter for production, not the bundled SQLite database on ephemeral free hosting.

*Customer:* open `/`, browse the 16 seeded product families, explore the live concept model, adjust material, finish, dimensions, quantity, kit contents, print sides and freight, and sign up to save RFQs. Sign in to view quotes, accept authorized firm quotes, place orders and approve proof revisions.

*Staff:* use a separately bootstrapped Super Admin account to review quotes, mark firm pricing after real cost checks, manage quote/order lifecycles, create proofs, add machine job cards and create shipments. Role assignment is denied for the actor's own user ID; superadmin elevation is deliberately blocked by the basic route.

`PAYMENTS_ENABLED=false` by default. Razorpay order creation, signature checks, provider-side payment capture lookup and signed webhooks are included as integration contracts but require merchant credentials, HTTPS, reconciliation jobs and formal UAT before enabling. Manual waybill entry is *not* courier booking.

## Local checks

```bash
npm test
npm run coverage
# Optional browser smoke (requires Python Playwright + system Chromium):
python tests/visual-smoke.py
node --check apps/api/server.mjs
node --check apps/web/app.js
```

## Architecture

```text
apps/web/index.html  + styles.css + ux.css + app.js
  └─ responsive storefront, custom kit builder, indicative quote, staff/customer dashboards
apps/api/server.mjs
  ├─ /api/v1/catalog, /estimate, /quotes
  ├─ auth, roles, orders, proofs, work orders, inventory, shipping
  └─ gated Razorpay, refunds, audit
packages/core/estimate.mjs + catalog.mjs + policies.mjs
packages/skeleton/authorization.mjs, workflow.mjs, refunds.mjs, signatures.mjs
apps/api/db.mjs -> local SQLite migrations and structured audit
```

See `docs/APP_SKELETON_REUSE.md`, `docs/ARCHITECTURE.md`, `docs/REQUIREMENTS_COVERAGE.md`, `docs/RELEASE_GATES.md`, and `docs/OPERATIONS.md`.

## Caution: demonstration prices and visualisations

Prices and cost multipliers in `packages/core/catalog.mjs` are illustrative, not factory rate cards. Estimates expose setup, material, wastage, assembly, rush, freight, overhead/margin and tax. Company actual costs and dynamic tax applicability must be reviewed and approved. 3D CSS shapes are **concept-only**: there is no geometry validation, production-grade dieline output or true model rendering in this foundation. Firm quotes require authorized estimator review, and the latest exact proof must be approved before production release.

## Licence / reuse

`packages/skeleton/*` are adapted reusable helpers from the owner's `varadatechworks/app-skeleton` snapshot (`main` tree SHA `2cc6011652c5777b070974f4e020992fc1f1fa7d`). All other DesignPro logic is application-specific. Confirm the licensing and ownership policy before redistributing to third parties.

## Controlled UAT walkthrough (local only)

To exercise proof and dispatch flows without taking real money, set `UAT_DEMO_ENABLED=true` **only in local non-production environments** and restart the API. This enables `/api/v1/admin/uat/capture-payment` for Super Admin only, recording a clearly identified `uat_simulator` advance. This is test data, not an invoice, gateway capture or merchant settlement. In production (`NODE_ENV=production`) the route is always unavailable.

1. Sign up as customer, configure an item and save a quotation.
2. Bootstrap or sign in as Super Admin; in Quotations review and issue a firm quote.
3. Customer accepts the firm quote and places an order with a delivery address.
4. Super Admin opens the order and records a simulated UAT advance, then moves it to proofing.
5. Staff submit versioned artwork notes; customer rejects or approves the latest proof; staff release to production.
6. Create a work order, progress quality checks, prepare shipment, record waybill/tracking events and review the tracking timeline.
7. Customer requests a partial refund on the simulated payment; finance can review but **cannot issue real money without configuring and validating the live provider**.

This is not full customer UAT sign-off: email verification/MFA, actual artwork upload and PDF proof, parametric 3D, real printer rate cards, multi-address shipping, invoices and reconciled payments/refunds, and verified courier integrations are still release blockers. Read `docs/UAT_AUDIT_2026-11-09.md` and `docs/RELEASE_GATES.md`.

## Release v0.3.0 — UAT and operations hardening (2026-11-09)

- Quote-specific delivery destination count; orders must allocate **all** quoted units across exactly the priced number of recipients. Dispatch supports per-destination allocations and split shipments.
- Work cards now progress through planned → scheduled → in progress → completed, with blocked/recovery stages. Production cannot enter QC until all job cards are complete.
- QC personnel record pass/fail, sample counts and inspection notes. Only a passing latest check allows release to shipping.
- Order shipment/delivery transitions validate actual destination coverage and carrier-tracking stage. Financial cancellation is blocked until captured obligations are settled through approved refunds.
- Customer care requests, replies, controlled status transitions and customer ownership checks; order-level timeline and fulfilment dashboard enhancements.
- Independent finance deductions with a written reason, signed/duplicate-safe refund webhook updates and test-only refund settlement for the UAT simulator.
- The test suite now covers 26 Node cases and the browser smoke harness at 375, 390, 768 and 1440 pixels. See [`docs/UAT_RELEASE_0.3.md`](docs/UAT_RELEASE_0.3.md) for exact evidence and remaining gates.

**This release does not enable actual money transfers, production-grade 3D, secure artwork hosting, courier booking or verified factory pricing.** Those require merchant credentials, material/machine specifications and deployment controls before sign-off.
