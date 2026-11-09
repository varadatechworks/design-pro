# DesignPro technical architecture (current and target)

## Current UAT foundation

Static, responsive browser client and same-origin Node HTTP API (no extra npm dependencies) with a SQLite relational schema, scrypt passwords, HttpOnly SameSite cookies, CSRF token, server-owned quotes and role checks. Seeded 16 category families. Browser CSS transforms visualise a generic 3D concept box; original inline vector artwork distinguishes catalog categories; customer-provided logos stay local to the preview only. A quote does **not** contain a durable uploaded artwork file. Orders require an authorized firm quote and customer acceptance; production requires a current approved proof, and pending proof requires captured advance.

## Intended production architecture

```
Cloudflare Pages / CDN (customer web) -> authenticated API (Node/NestJS)
 -> PostgreSQL/Neon (orders, quotes, pricing, permissions, ledgers, audit)
 -> Object Storage/R2 (private artwork, signed URLs and output proofs)
 -> Async jobs (preflight, PDF proof, 3D render, CSV import, notification outbox)
 -> Payment gateway (Razorpay) / settlement-reconciliation job
 -> Carrier aggregator (rates, labels, tracking webhooks, returns)
 -> Print factory OMS/WMS/MES (machines, stock, job cards, QA, dispatch)
```

## Important consistency rules

- Server is sole authority for quoted price, tax, payable, identity and statuses.
- All state transitions must be guarded by authenticated actor and role, and persisted transactionally; background side effects use durable event outbox and retries.
- No auto-release into manufacturing on visually plausible concept render alone.
- All customer and corporate operations require per-tenant organization filters in SaaS; the current demo is single business tenant and **not multi-tenant ready**.
- Email/OTP MFA, tax tables, GST compliance, artwork antivirus scanning, private signed files, backup/restore, payment reconciliation and carrier tracking integration are **release gates**.
