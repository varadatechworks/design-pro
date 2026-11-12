# DesignPro Admin Console — Operations Guide

## Access

1. Start DesignPro and run the existing Super Admin bootstrap command once.
2. Open `/admin` on the same origin as the storefront.
3. Sign in with the bootstrapped Super Admin account. The admin page uses the existing HttpOnly session cookie and CSRF token; it does not store passwords or session tokens in browser storage.
4. Use **View storefront** to return to the customer website.

## Managing content

- **Homepage content** changes the visible hero eyebrow and description, announcement strip, footer copy and contact links.
- **Website pages** create plain-text pages. Publish a page to make it available at `/pages/<slug>`. Draft pages are not publicly served. HTML is escaped intentionally.
- **Categories** control the customer-facing category cards and the options used by the configurator. Materials and finishes must use supported IDs from the admin screen.
- **Products** appear in the storefront's Featured Products area. Select an active category, maintain a unique URL slug and optionally associate a hosted or DesignPro media image.
- **Media library** accepts PNG/JPEG/WebP uploads up to 2 MB or HTTPS URLs. Uploaded images are currently stored in SQLite as base64 data for local/UAT convenience.
- **Pricing & rates** controls category-level setup, target margin, GST and volume discount with effective dates. All money values are stored as integer paise.
- **Production costs** maintains effective-dated raw-material, kit-item, production-operation, packing and shipping costs. Each component has a consumption basis (m², piece, 1,000 impressions, running metre, production hour or fixed charge), a consumption factor, optional wastage and optional category/material/finish conditions. The calculator uses dimensions and quantity to derive consumption; the latest active effective component rates are applied to new estimates.
- **Business settings** stores business identity, contact, GSTIN, address, currency and fulfilment defaults.

## Pricing safety

Use factory-approved rates only. Configure every applicable material, printing, cutting, selected finish, packing, production and shipping component before relying on a price. Material m² consumption is estimated from the six-face surface area `2 × (L×W + L×H + W×H)`; cutting metres use the perimeter proxy `2 × (L + W + H)`. These are early-stage consumption estimates, not a substitute for approved dielines, nesting/yield calculations, machine routing or actual supplier quotes. Missing production, printing, selected-finish or shipping coverage is flagged for technical review. Validate overhead, margin, GST applicability and freight with finance and production. A rate change affects future estimates; saved quote estimates remain snapshots. This initial console records changes in the audit log but does not yet implement independent maker-checker approval for rate changes.

## Operational and production limitations

- SQLite and database-stored image bytes are for local/UAT only. Use a persistent PostgreSQL adapter and durable object storage with backups before production.
- Add malware scanning, media quotas, image transformations/CDN, restore drills and monitoring before allowing public uploads.
- Product image URLs must be HTTPS or a registered DesignPro media path.
- The page editor is plain-text only. A rich-text/WYSIWYG editor and page-specific layout blocks are not included.
- Category material and finish choices are constrained to the current supported option dictionary. Adding new manufacturing materials/finishes requires engineering and cost-model validation.
- The component engine supports material and kit costs, production operations, packing and shipping. Use `condition=finish` with the matching finish ID for finish-specific operations, `condition=printing` for print charges and `condition=rush` for rush-only operations. Rates are stored as integer paise; consumption factors are stored as milli-units.
- The component model deliberately marks estimates for technical review when key operation/printing/finish/shipping costs are missing. Admin must populate actual factory rates; seeded catalogue values remain sample fallback rates.
- Actual factory rate cards, GST treatment, and final prices must be reviewed by authorized staff.
- This feature does not enable live payments, production-grade CAD/dielines, PDF proofs or courier booking.

## Verification

Run `npm test`, `npm run schema:preflight`, `npm run coverage`, and `node --check apps/api/server.mjs`, `node --check apps/api/admin-management.mjs`, `node --check apps/web/app.js`, `node --check apps/web/admin.js`. Use the CI responsive smoke suite before accepting UAT.
