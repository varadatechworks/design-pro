# DesignPro printing and packaging - Architecture, Deployment, ER, Database, Migration & KT Guide
> **Code snapshot:** 2026-11-09, `main` branch of [varadatechworks/design-pro](https://github.com/varadatechworks/design-pro). **Repository-derived reference**; cloud environment and deployed DB must be verified separately.
**UAT gate:** SQLite is local and not a verified production persistence solution; payments remain gated.
## 1. System context and component architecture
**Stack observed / documented:** Node.js 22 + SQLite for UAT. Source has web components, no verified mobile app and backend/API sources.

```mermaid
flowchart LR
    Operator[Customers / Staff] --> UI[Web or module consumer]

    UI --> Service[Application API / Domain]

    Service --> Security[Auth / policy / validation]
    Security --> DB[(Persisted data store - verify env)]

    Service -.-> Provider[External adapters / payment / mail]
    QA[Tests / CI] -. checks .-> Service
```
**Cross-cutting contracts:** server-validated inputs; least-privilege RBAC; concurrency/idempotency; customer vs admin isolation; audit IDs; non-secret config; appropriate geo evidence and billing snapshots where applicable.

## 2. Deployment diagram (logical reference, not production verification)
```mermaid
flowchart TB
    Git[GitHub main / tagged release] --> QA[CI / build checks]
    QA -. approved artifact .-> Front[Frontend / CDN / HTTPS]
    Front --> Back[Backend / APIs / runtime]

    Back --> DB[(Database instance)]

    Vault[Managed secrets / environment] -. injected .-> Back
    Monitor[Logs / metrics / alerts] -. monitors .-> Back
```
**Complete for each environment:** cloud project/region, DNS and custom domain, static/web deployment, API container/function, environment names, database identity, secret manager, backup owner, health check, rollback release, CI status and contact matrix. Diagram does **not** establish a running deployment.

## 3. ER diagram - representative source-verified baseline
The ER uses `CREATE TABLE` and declared `REFERENCES` found in **1 selected baseline file(s)**, not every subsequent migration. It is not a complete physical ER; export the current database catalog for authoritative tables, columns and foreign keys.

```mermaid
erDiagram
    AUDIT_EVENTS {
        TEXT id PK
        TEXT actor_id
        TEXT event_type
        TEXT entity_type
        TEXT entity_id
        TEXT detail
        TEXT at
    }
    CUSTOM_ROLES {
        TEXT code PK
        TEXT name
        TEXT permissions
        TEXT status
        TEXT created_by
        TEXT created_at
    }
    INVENTORY {
        TEXT id PK
        TEXT name
        TEXT unit
        REAL available
        REAL reserved
        REAL reorder_level
        TEXT updated_at
    }
    ORDERS {
        TEXT id PK
        TEXT quote_id FK
        TEXT user_id FK
        TEXT status
        INTEGER total_minor
        TEXT currency
        TEXT proof_id
        TEXT address
        TEXT created_at
    }
    PAYMENTS {
        TEXT id PK
        TEXT order_id FK
        TEXT provider
        TEXT provider_order_id
        TEXT provider_payment_id
        INTEGER amount_minor
        TEXT status
        TEXT created_at
        TEXT updated_at
    }
    PROOFS {
        TEXT id PK
        TEXT order_id FK
        INTEGER version
        TEXT status
        TEXT notes
        TEXT approved_by
        TEXT approved_at
        TEXT created_at
    }
    QUOTES {
        TEXT id PK
        TEXT user_id FK
        TEXT organization_id
        TEXT status
        TEXT configuration
        TEXT estimate
        INTEGER version
        INTEGER firm_total_minor
        TEXT expires_at
    }
    REFUNDS {
        TEXT id PK
        TEXT order_id FK
        TEXT payment_id FK
        INTEGER requested_minor
        INTEGER fee_minor
        INTEGER refund_minor
        TEXT status
        TEXT requested_by
        TEXT approved_by
    }
    SESSIONS {
        TEXT token_hash PK
        TEXT user_id FK
        TEXT csrf_hash
        TEXT expires_at
        TEXT created_at
    }
    SETTINGS {
        TEXT value
        TEXT updated_at
    }
    SHIPMENT_EVENTS {
        TEXT id PK
        TEXT shipment_id FK
        TEXT status
        TEXT location
        TEXT notes
        TEXT at
    }
    SHIPMENTS {
        TEXT id PK
        TEXT order_id FK
        TEXT carrier
        TEXT tracking_number
        TEXT status
        TEXT address
        TEXT created_at
        TEXT updated_at
    }
    USERS {
        TEXT id PK
        TEXT display_name
        TEXT email
        TEXT password_hash
        TEXT role
        TEXT status
        INTEGER email_verified
        TEXT organization_id
        TEXT created_at
    }
    WEBHOOKS {
        TEXT event_id PK
        TEXT provider
        TEXT payload_hash
        TEXT created_at
    }
    WORK_ORDERS {
        TEXT id PK
        TEXT order_id FK
        TEXT machine
        TEXT status
        INTEGER quantity
        TEXT notes
        TEXT created_at
    }
    USERS ||--o{ SESSIONS : user_id
    USERS ||--o{ QUOTES : user_id
    QUOTES ||--o{ ORDERS : quote_id
    USERS ||--o{ ORDERS : user_id
    ORDERS ||--o{ PROOFS : order_id
    ORDERS ||--o{ PAYMENTS : order_id
    ORDERS ||--o{ REFUNDS : order_id
    PAYMENTS ||--o{ REFUNDS : payment_id
    ORDERS ||--o{ SHIPMENTS : order_id
    SHIPMENTS ||--o{ SHIPMENT_EVENTS : shipment_id
    ORDERS ||--o{ WORK_ORDERS : order_id
```

## 4. Database schema and migration registry
**DDL/migration sources detected:** 1. **Baseline tables detected:** 15. The full and exact schema is defined by the ordered source SQL and later ALTERs, plus the deployed migration history; this table-name view is intentionally limited to inspected baseline files.

Baseline tables: `users`, `custom_roles`, `sessions`, `quotes`, `orders`, `proofs`, `payments`, `refunds`, `shipments`, `shipment_events`, `work_orders`, `inventory`, `audit_events`, `webhooks`, `settings`.

**Versioned SQL / schema paths:**
- [`apps/api/db.mjs`](../../apps/api/db.mjs)


For a verified PostgreSQL schema snapshot: `pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > schema-only.sql`. For SQLite/D1, inspect `sqlite_master` and `PRAGMA table_info` in the correct environment. Never upload production PII or credentials to docs.

## 5. Safe migration script and procedures
**Repository-native migration:** npm run db:migrate (local UAT only). Copy/adapt this guarded operator wrapper into the deployment runbook; it performs **no migration by default**.

```bash
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-plan}" != "apply" ]]; then
  echo 'PLAN ONLY: verify target branch/SHA, migration history, pending DDL and permissions'
  echo 'Back up, restore-test, dry-run in staging and record release/backup references.'
  exit 0
fi
[[ "${CONFIRM_DB_MIGRATION:-}" == "BACKUP_VERIFIED" ]] || exit 3
: "${BACKUP_REFERENCE:?Verified backup/snapshot reference required}"
: "${MIGRATION_APPLY_CMD:?Provide the reviewed repository-native migration command}"
bash -lc "$MIGRATION_APPLY_CMD"
echo 'Verify migration tracking table, API health, smoke tests, reconciliation and audit.'
```
**Process:** (1) compare applied versions/checksums; (2) review forward/backward compatibility; (3) backup + actual restoration rehearsal; (4) staging migration/test; (5) review/approve; (6) production apply once; (7) verify health, business smoke and data; (8) record release; (9) recover using tested restore or forward-fix, never blindly undo destructive SQL. Production seeding is prohibited by default.

## 6. Build, release and deployment KT
- Check out the exact release SHA, supported runtime from `package.json` / `pom.xml` and documented local dependencies.
- Run repository tests/build/coverage as configured, inspect CI workflow failures, artifacts, lint/typecheck and vulnerability scans.
- Configure HTTPS, tenant/role/OTP modes, CORS and sessions; keep third-party secrets and payment credentials out of GitHub.
- Validate database connectivity, migration record, app health, cron/background jobs, callback signature verification, logs and alert routes.
- For web/mobile releases verify required version controls, app signing, staging-only toggles and rollback compatibility when present.

## 7. Support, maintenance and incident runbook
**Daily:** health/error rates, auth errors, queue/jobs, webhook exceptions, failed payment/invoice notifications and CI deploy status. **Weekly:** DB backup checks, restore sample, retention, storage growth, payment/reconciliation where relevant, access review. **Monthly:** dependency patching, cert renewals, DR drill, audit review and architecture drift.  
**Incident:** establish scope/last-good SHA; protect logs; disable unsafe writes; compare current vs expected config; use tested rollback/restore; verify with smoke tests; record RCA and corrective test cases.

## 8. KT and customer UAT demo script
**Show:** Product config -> estimate -> RFQ -> approved quote -> proof -> work order -> shipping.
| Minutes | What to demonstrate |
|---|---|
| 0-10 | Product scope, stakeholders, roles, current maturity |
| 10-25 | Main happy path + real error/success messages |
| 25-40 | Architecture, data flows, DB, RBAC and integrations |
| 40-50 | Local build, CI/deploy, migration and rollback |
| 50-60 | Backups, monitoring, admin operations, UAT gaps and contacts |

**Negative tests:** bad credentials, expired session, forbidden role, bad input, duplicate submission, concurrent operation/stock conflict, offline/timeouts, provider failures, duplicate webhook if used, failed refund, DB loss, location missing (where relevant), invalid migration and tenant leak. Demonstrate only sandbox transactions unless deployment approval is recorded.

## 9. Handover checklist and known evidence gaps
- [ ] Production/staging service URLs, domains, hosting region, owner and runtime version documented
- [ ] Secrets access handed over via vault (NO values committed)
- [ ] Build and CI evidence, test report/coverage and open defects acknowledged
- [ ] Current database schema-only export and ER reconciled to deployed SHA
- [ ] Migration history, checksum changes and backup/restore evidence signed
- [ ] Health, logs, monitoring thresholds and escalation contact operational
- [ ] Application walkthrough, operational SOP and security/negative UAT approved
- [ ] Release steps, rollback/forward-fix plan and next maintenance window owned

**Other source documentation:**
- [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md)
- [`docs/OPERATIONS.md`](../../docs/OPERATIONS.md)
- [`docs/RELEASE_GATES.md`](../../docs/RELEASE_GATES.md)


*This guide is a source-derived starting point for KT. Do not claim that source presence means production deployment, a passing CI run or an accurate live-schema export.*
