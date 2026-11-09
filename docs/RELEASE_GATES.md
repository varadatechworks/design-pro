# Production release gates — stop conditions

1. **Actual CPQ calibration:** validate against 20+ historical work orders across UV/digital/laser/rigid/gift-kit processes, pricing margin floors, wastage, setup and minimum batch economics; independently sign off by production and finance.
2. **Database/hosting:** replace Node 22 experimental SQLite with PostgreSQL transactional adapter, schema migrations, backup/restore tests, job queues, concurrency controls and durable outbox. Free-tier ephemeral local SQLite is not production persistence.
3. **Identity/security:** complete verified email/OTP reset, MFA for all privileged roles, first-party role scopes/tenant isolation, password/session revocation, restrictive CORS/TLS, WAF and distributed rate limit, audit of privileged actions, secret vault, SAST/DAST.
4. **Artwork:** authenticated virus-scanned upload, file format/preflight, private encrypted object store with signed links, retention, versioned PDF proofs, proof invalidation, user IP/time evidence. Browser-only concept logo is not a production upload.
5. **Money & tax:** test Razorpay orders, duplicate callbacks, captured/failed/authorized states, negative events, refunds, settlements and bank reconciliation. Confirm GST invoice/credit note logic, rates, e-invoicing/e-waybill if applicable. Never infer capture from browser redirect.
6. **Shipping:** carrier serviceability, negotiated rate feed, verified chargeable weight, manifest/label, pickups, webhook trust, partial shipments, RTO, returns and disputes.
7. **Manufacturing:** physical material compatibility, cutting/creasing/printing tolerances, machine capacity, job card stage approval, QC holds, stock reservations and replenishment.
8. **Testing:** UAT scenarios for customer/org/staff roles, negative security scenarios, concurrency / idempotency, loading and accessibility, traceability back to all mandatory BRD requirements.
9. **Compliance:** privacy policy, artwork licence/IP terms, local tax/business compliance, refund/cancellation policy, consumer disclosure of concept-only renders.

`PAYMENTS_ENABLED=false` must remain set until finance and security approvals are recorded. Production configuration must never contain demo admin credentials.


## v0.3.0 changes and launch status

UAT may exercise (using **simulated** payments and manual tracking only) multi-address shipping allocation, work-card statuses, QC fail/pass, delivery gating, customer support tickets, finance fee deductions and simulated refund settlement. These are **not** proof of real-gateway, carrier or production-run readiness.

Never set `UAT_DEMO_ENABLED=true` in production; server code also explicitly rejects simulated payment/refund endpoints in `NODE_ENV=production`. Real checkout requires `PAYMENTS_ENABLED=true` with verified Razorpay keys, webhook secret, per-merchant configuration and accounting reconciliation. No production-ready factory BOM or tax calculation is supplied by sample rates.
