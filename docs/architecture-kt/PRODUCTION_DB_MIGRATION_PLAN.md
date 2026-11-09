# SQLite → PostgreSQL implementation and migration plan (not yet live)
DesignPro uses `node:sqlite` and synchronous queries in `apps/api/db.mjs` / `apps/api/server.mjs`. The SQL under `sql/postgres` is an **unwired candidate** for a clean disposable database only, not a production migration.

1. **Freeze source and backup**: record commit/DB file/version, export sqlite_master schema, create an encrypted SQLite consistent backup and actually restore to isolated media.
2. **Build adapter**: refactor SQL statements, connection pooling, transactions, JSONB conversion, timestamp and amount types, idempotency/retries and durable outbox. Merely changing DATABASE_URL does not switch the API.
3. **Review candidate SQL**: run on empty scratch PostgreSQL; verify 19-table inventory, keys, indexes, money constraints and state values against `db.mjs`; record migration checksum/version. Add future changes via numbered incremental scripts.
4. **Data conversion in FK order**: roles/users, sessions, quotes, orders, proofs, destinations, payments, refunds, stock, jobs, inspections, shipments/events, tickets/messages, webhook keys, audit and settings. Do not move real PII into open UAT.
5. **Integrity/reconciliation**: table counts; foreign key check; JSON round trips; payment/refund totals; provider unique IDs; latest proof versions; stock and shipment quantities; append-only audit continuity.
6. **Staging regression**: test cross-customer isolation, CSRF, negative payment/webhook cases, simultaneous refund/proof/stock writes, replay handling, role matrix, browser E2E, actual backup restore.
7. **Approved cutover**: hold writes; capture final recoverable snapshot; apply versioned migration and data delta; verify health/finance; reopen only after release signoff.
8. **Failure**: stop writes; restore tested backup to isolated environment; use preapproved cutback/forward-fix, not arbitrary DROP or manual payment table edits.

**Launch block:** PostgreSQL adapter, durable storage, secure artwork, verified auth, manufacturing CPQ, live payment reconciliation, tax invoice and courier controls must all be delivered/tested before real production.
