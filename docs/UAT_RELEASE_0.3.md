# DesignPro v0.3.0 — implementation and acceptance evidence

**Date:** 2026-11-09  
**Target:** customer-observed, non-production exploratory UAT; not BRD completion and not a payment or shipping production launch.

## New functionality

| Journey | Implementation and gate |
|---|---|
| Multi-destination CPQ | Price includes destination count. Customer must allocate all unit quantities to exactly the quoted number of recipients. Change of delivery count requires a fresh quote. |
| Bulk address collection | 1–8 individual address forms or pipe-delimited bulk entry. Server validates count, addresses, positive whole quantities and optional contact numbers. Excel/CSV imports and address verification remain future work. |
| Dispatch | Shipment needs a valid order destination and quantity. Multiple parcels per destination are supported; over-allocation is forbidden. |
| Work cards | Staff can schedule, start, complete or block job cards with recorded notes. All cards must complete before QC. |
| Quality control | Authorized QC/PLANNER/SUPER_ADMIN records sampled quantities and notes. Latest passed inspection permits ready-to-ship. |
| Shipment-to-order integrity | Shipment coverage is checked before changing order status to shipped or delivered, including all destinations. |
| Customer service | Owner-only order-linked tickets, message history, restricted staff status workflow, audit records. |
| Financial processing | Deduction amount with finance notes, signed refund webhook state changes, duplicate event protection, UAT-only simulated refund settlement. |
| Cancellation guard | Captured payment obligations must be settled by successful refunds before status can be cancelled. |

## Verification performed

- `npm test`: **26 passing, 0 failing** on local Node 22 test runner. Tests cover access isolation, CSRF, role restrictions, invalid estimation, proofing, workflow skips, QC failure, signed/replayed payment and refund webhooks, quantity mismatch, refund deductions and simulated UAT settlements.
- `python tests/visual-smoke.py`: **passed** on Chromium at **375, 390, 768 and 1440px** using mocked API data. Verified navigation, delivery form selection, admin/customer interactions, dialog behavior, service request detail and absence of page JavaScript errors or horizontal overflow in those paths.
- No deployment tests, external payment, live courier booking, production database load test or actual printer process calibration performed.

## Customer UAT personas

1. Customer: configure welcome kit, request indicative quote, accept approved firm quote, submit destination allocation, approve or reject artwork proof, view order history, raise support request.
2. Estimator/Sales: finalize verified firm quote and handle RFQ edge conditions.
3. Designer: submit versioned proof metadata (real production artwork upload remains gated).
4. Planner/Operator: release manufacturing job, update progress and record rework/block; QC role records verified inspection.
5. Dispatch: allocate units to shipping destination and record tracking milestones; advance order only when coverage reconciles.
6. Finance: independently review/approve refund and fee deduction; Super Admin can **simulate** settlement in UAT without transferring funds.
7. Super Admin: role administration, privileged audit review, controlled demo payment/refund transactions.

## Critical launch blockers — open

- Customer identity: OTP/email verification, password recovery and privileged MFA.
- Commercials: actual machine specifications and historical costing (20+ jobs), material pricing, printed/engraved area, tolerance, scrap, profitability and approved GST classification, invoicing/credit notes.
- Assets/preview: secure file upload and scanning, per-surface artwork, correct dieline/proof PDF and production parametric 3D. Current preview is only a visual concept.
- Infrastructure: PostgreSQL transactional concurrency, backups, object storage, queues, observability, controlled staging + CI and security penetration checks.
- Fulfilment: validated multi-address CSV/XLSX with templates, live carrier rating and label generation, reverse logistics and POD.
- Finance: live gateway test credentials and contract validation, settlement reconciliation, merchant refund policy and tax invoice/credit note sign-off.
- Governance: maker-checker for Super Admin and large commercial discounts, corporate organizations/PO budgets, supplier purchase orders, inventory reservations and granular site scopes.

**UAT exit condition:** stakeholders sign off the above workflows in a protected test environment with verified controls. Live launch is explicitly blocked until outstanding critical integration and legal/business gates close.
