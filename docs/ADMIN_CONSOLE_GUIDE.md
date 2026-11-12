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
- **Pricing & rates** stores category-level base unit, setup, margin and GST rates with effective dates. All money values are stored as integer paise. An estimate uses the latest active effective rate card; if none exists it uses the category's fallback rates and default estimate settings.
- **Business settings** stores business identity, contact, GSTIN, address, currency and fulfilment defaults.

## Pricing safety

Use factory-approved rates only. Validate material costs, machine/click charges, prepress, tooling, wastage, assembly, overhead, margin, freight and tax applicability with finance and production before publishing. Rates are not a substitute for a technical review. A rate change affects future estimates; saved quote estimates remain snapshots. This initial console records changes in the audit log but does not yet implement independent maker-checker approval for rate changes.

## Operational and production limitations

- SQLite and database-stored image bytes are for local/UAT only. Use a persistent PostgreSQL adapter and durable object storage with backups before production.
- Add malware scanning, media quotas, image transformations/CDN, restore drills and monitoring before allowing public uploads.
- Product image URLs must be HTTPS or a registered DesignPro media path.
- The page editor is plain-text only. A rich-text/WYSIWYG editor and page-specific layout blocks are not included.
- Category material and finish choices are constrained to the current supported option dictionary. Adding new manufacturing materials/finishes requires engineering and cost-model validation.
- Actual factory rate cards, GST treatment, and final prices must be reviewed by authorized staff.
- This feature does not enable live payments, production-grade CAD/dielines, PDF proofs or courier booking.

## Verification

Run `npm test`, `npm run schema:preflight`, `npm run coverage`, and `node --check apps/api/server.mjs`, `node --check apps/api/admin-management.mjs`, `node --check apps/web/app.js`, `node --check apps/web/admin.js`. Use the CI responsive smoke suite before accepting UAT.
