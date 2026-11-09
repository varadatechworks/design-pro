# BRD v2.0 coverage (first implementation)

The expanded BRD covers 368 requirements. This source is a working **Phase 1 foundation**, not a statement of 368/368 completion.

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
| Manufacturing | Work-order creation guarded by proof, demo factory queue | Machine capacity, nested BOM, job scheduling, scrap, QC evidence, real WIP progress |
| Inventory | Basic stock records | Reservations, GRN, supplier POs, lot tracing and procurement approvals |
| Shipping | Shipment creation, manual tracking events, delivery status | Carrier quotes, labels, courier integration, multi-address orders and RTO automation |
| Admin & audit | KPIs, users, roles, work orders, inventory, audit table, selected screens | Configuration console, advanced reports, exports, dashboards, notifications |
| Non-functional | Node tests, core state & authorization gates, parameterized SQL, CSRF, safe session cookie | Deploy-grade concurrency, SSO/MFA, distributed rate limiting, threat testing, SLOs, backup/restore |

**Review with factory stakeholders:** Provide actual machine specifications, materials, stock levels, vendor prices, layout/packing rules, waste percentages, printing click rates, labour and overhead, GST applicability, approval limits, logistics contracts and Razorpay credentials. Do not replace seed rates with guesses.
