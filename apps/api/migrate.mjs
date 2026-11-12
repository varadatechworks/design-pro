import {openDb,migrate} from './db.mjs';import {migrateAdmin} from './admin-management.mjs';const db=migrate(openDb());migrateAdmin(db);console.log('DesignPro database migrated');db.close();
