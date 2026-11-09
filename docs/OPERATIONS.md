# Local operations and handover

1. Install Node.js 22+, copy `.env.example` to `.env`, choose a non-public test database path.
2. `npm run db:migrate` creates tables; repeat migrations are idempotent for existing tables.
3. Use a long unique password in `BOOTSTRAP_PASSWORD` and verified email in `BOOTSTRAP_EMAIL`, run `npm run admin:bootstrap` exactly once. Remove the bootstrap password from environment after initialization.
4. `npm run dev` serves API and storefront on `http://localhost:8787`.
5. Visit `/api/v1/health` for health and payment-enabled state. Use `npm test` for smoke integration.
6. Staff: enter a firm price only after checking actual manufacture cost, VAT/GST applicability, supplier rates and technical feasibility.
7. Customer: accept a firm quote to create an order; production requires verified payment advance and latest proof approval. No live real payment should be enabled without merchant account validation.
8. Known development constraints: no password recovery/email delivery, SQLite local only, no machine scheduling or file storage, no full PDF proof, manually entered courier tracking, and initial demo rates.

For zero-cost prototyping, run on developer machine or small free VM with persisted disk. For production, choose reliable durable infrastructure; costs and service availability depend on chosen provider.

## UAT-only simulated payments

- For a disposable local database, set `UAT_DEMO_ENABLED=true` and `NODE_ENV=development`, restart the service, and log in as the bootstrapped Super Admin.
- Use the explicitly labelled **Record simulated UAT advance** action in an order's detail panel. It records a test ledger entry with `provider=uat_simulator`; it never calls Razorpay or charges a customer.
- This route is disabled by default, unavailable in production, rate- and role-guarded, and cannot be used to claim settlement. Never enable it for a publicly exposed test server without additional access controls.
- Do not use the simulator on customer financial data or present simulated payment events as real transactions.
