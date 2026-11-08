# DesignPro — Custom Printing, Premium Packaging & Corporate Gifting

Configurable, India-first B2B/B2C platform for printing, packaging, and bespoke welcome kits.

**Status: functional foundation / MVP codebase, not production-ready.** Implements an attractive storefront, live *indicative* price estimates, versionable request-for-quote workflow, staff console, session-based authentication, role checks, audit trail, status-managed quotation/proof/order/production operations, PostgreSQL schema and tests. Integrations requiring real merchant/provider credentials (payments, shipping labels, WhatsApp/SMS, object storage and production-quality 3D) are gated, not simulated as live.

## Start locally

```bash
npm install
cp .env.example .env
# Set DATABASE_URL and a long BOOTSTRAP_PASSWORD
npm run db:migrate
npm run admin:bootstrap
npm run dev
# Open http://localhost:8787
```

The customer-facing studio also works as a static preview: open `apps/web/index.html` in a local static server. Live RFQ/order actions require the API and database.

## Core principles
- Quantity 1+ allowed where feasible; setup costs remain visible.
- Estimates are illustrative until an authorized estimator locks a *firm* quote.
- Customer preview is **not** a technical proof; proof approval and commercial/material clearance are separate requirements before production.
- Cost, tax and margin rules always calculate on the server for commercial actions.
- Orders, refunds, payment and shipment events must be idempotent before integrations are enabled.
- Application modules are independent from the reusable `varadatechworks/app-skeleton` library; see `docs/APP_SKELETON_REUSE.md`.

See `docs/ARCHITECTURE.md`, `docs/REQUIREMENTS_COVERAGE.md`, `docs/RELEASE_GATES.md`, and `docs/OPERATIONS.md` for boundaries and next steps.
