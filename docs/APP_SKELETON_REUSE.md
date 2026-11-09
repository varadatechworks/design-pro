# Direct reuse of Varada App Skeleton

The source repository `https://github.com/varadatechworks/app-skeleton` was inspected at tree `2cc6011652c5777b070974f4e020992fc1f1fa7d` (November 9, 2026).

| DesignPro path | Skeleton origin | Usage |
|---|---|---|
| `packages/skeleton/authorization.mjs` | `modules/authorization/simple.mjs` | Explicit RBAC grants, deny by default. |
| `packages/skeleton/workflow.mjs` | `modules/workflow/index.mjs` | Named state machine validation and transition log. |
| `packages/skeleton/refunds.mjs` | `modules/payments/refunds.mjs` | Cap refunds to paid amount, fee deduction, reviewer controls. |
| `packages/skeleton/signatures.mjs` | `modules/payments/index.mjs`, `checkout.mjs` | Razorpay HMAC verification with timing-safe signature comparison. |

Deliberate adaptations include source attribution, code formatting and combining signature helpers. Skeleton billing's `calculateQuote` does not account for manufacturing BOM, setup, wastage, stock, machine time and freight, so `packages/core/estimate.mjs` adds a printing-specific cost breakdown instead of misusing generic unit pricing. Price calculations remain server-side and follow the skeleton's money-in-paise convention. Remaining generic skeleton services (audit, notifications, reports, role service, and DB adapters) should be adopted as their production persistence/transports are implemented.

**Limitation:** Reusing library functions is not equivalent to implementing the library's whole production reference architecture; the app still needs integration hardening.
