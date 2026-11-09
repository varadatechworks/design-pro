# BRD v2.0 coverage (first implementation)

The expanded BRD covers 368 requirements. This source is a working **Phase 1 foundation with v0.3.0 workflow hardening**, not a statement of 368/368 completion.

| BRD area | Current state | Still required |
|---|---|---|
| Categories & product catalog | 16 seeded categories, compatible materials/finishes, search & filters | Admin-defined category tree, versioned SKU templates and process recipes |
| Configurator | Quantity 1+, dimensions, material, finish, sides, kits, rush and address-state | Dielines, multiple artwork surfaces, BOM nesting, personalization CSV, variants, proofs |
| Preview | Responsive illustrative CSS 3D box, drag/angle, local logo image | Parametric 3D assets, exact dieline fitting, dimension/coverage overlay, 2D PDF proof |
| Estimation / CPQ | Server-side sample cost breakdown, setup, wastage, material, assembly, shipping, taxes, margin; review gates | Factory BOM, machine speed/click rates, imposition, rate effective dates, maker-checker, calibrated RFQ |
| User/role management | Password/session, initial Super Admin, role matrix, role assignment and custom restricted role | MFA, email verification, organizations, delegations, org/plant boundaries, privileged maker/checker |
| Quote/order | Saved indicative quotes, estimator firm price, accept, order create; guided state machine | Comprehensive change orders, cancellations, split lines, multiple POs and approval budgets |
| Artwork/proofs | Versioned proof metadata + customer approve/reject | Object storage, malware scanning, annotations, 2D production PDF, proof access tokens |
| Payments/refunds | Razorpay provider boundary gated, HMAC checks, capture confirmation, refund cap, dual approval | Full webhook refunds + settlement, reconciliation, credit notes, GST invoices, corporate credit |
| Manufacturing | Work-order creation guarded by proof, demo factory queue | Machine capacity, nested BOM, job scheduling, scrap and external-machine telemetry; basic job stage and QC evidence implemented |
| Inventory | Basic stock records | Reservations, GRN, supplier POs, lot tracing and procurement approvals |
| Shipping | Shipment creation, manual tracking events, delivery status | Carrier quotes/labels, live courier integration, automated RTO and large-volume import (multi-address allocation is now available) |
| Admin & audit | KPIs, users, roles, work orders, inventory, audit table, selected screens | Configuration console, advanced reports, exports, dashboards, notifications |
| Non-functional | Node tests, core state & authorization gates, parameterized SQL, CSRF, safe session cookie | Deploy-grade concurrency, SSO/MFA, distributed rate limiting, threat testing, SLOs, backup/restore |

**Review with factory stakeholders:** Provide actual machine specifications, materials, stock levels, vendor prices, layout/packing rules, waste percentages, printing click rates, labour and overhead, GST applicability, approval limits, logistics contracts and Razorpay credentials. Do not replace seed rates with guesses.

### v0.3.0 incremental coverage (not complete BRD acceptance)

- **BRD 5/12/17:** multi-destination recipient+quantity allocation exactly matches quoted destination count and order volume; each shipment references an allocated destination. The UI supports 1–8 address forms or a pipe-delimited bulk paste for more recipients.
- **BRD 15/18:** work-order transitions, mandatory completion before QC, recorded inspection with latest pass requirement, customer-facing timeline.
- **BRD 13/14:** finance-reviewed deductions, checked refund closure, replay-resistant Razorpay refund event consumption, guarded cancellation after payment settlement.
- **BRD 18/20:** customer complaints/change requests and staff service replies with ownership checks and audit trails.

Outstanding critical launch gates: real production-artwork preflight and PDF approval, MFA/email verification, legally approved GST tax engines, calibrated cost and machine rate cards, database transactional scalability, carrier provider integration, bank settlement reconciliation and a realistic parametric 3D production model.
