import {openDb,migrate,audit} from './db.mjs';import {migrateAdmin} from './admin-management.mjs';import {createUser,getUser} from './auth.mjs';
const email=process.env.BOOTSTRAP_EMAIL,password=process.env.BOOTSTRAP_PASSWORD;
if(!email||!password){console.error('Set BOOTSTRAP_EMAIL and BOOTSTRAP_PASSWORD (12+ characters), then run this command.');process.exitCode=1;}
else {const db=migrate(openDb());migrateAdmin(db);if(getUser(db,email)){console.error('Account already exists; bootstrap is intentionally not repeatable.');process.exitCode=1;}else{createUser(db,{email,password,displayName:'Super Administrator',role:'SUPER_ADMIN',verified:true});console.log('Created Super Admin:',email);}db.close();}
