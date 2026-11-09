import {openDb,migrate} from './db.mjs';const db=migrate(openDb());console.log('DesignPro database migrated');db.close();
