import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
const DEFAULT_DB=process.env.DATABASE_FILE||'./var/designpro.sqlite';
export function openDb(file=DEFAULT_DB){
 if(file!==':memory:')mkdirSync(dirname(resolve(file)),{recursive:true});
 const db=new DatabaseSync(file);db.exec('PRAGMA foreign_keys=ON;PRAGMA journal_mode=WAL;PRAGMA busy_timeout=5000;');return db;
}
export function migrate(db){
 db.exec(`CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, display_name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'CUSTOMER',status TEXT NOT NULL DEFAULT 'active',email_verified INTEGER NOT NULL DEFAULT 0,
 organization_id TEXT,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS custom_roles (code TEXT PRIMARY KEY,name TEXT NOT NULL,permissions TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',created_by TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),csrf_hash TEXT NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),organization_id TEXT,status TEXT NOT NULL,
 configuration TEXT NOT NULL,estimate TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,firm_total_minor INTEGER,expires_at TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY,quote_id TEXT NOT NULL UNIQUE REFERENCES quotes(id),user_id TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL,
 total_minor INTEGER NOT NULL,currency TEXT NOT NULL DEFAULT 'INR',proof_id TEXT,address TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS proofs (id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),version INTEGER NOT NULL,status TEXT NOT NULL,
 notes TEXT,approved_by TEXT,approved_at TEXT,created_at TEXT NOT NULL,UNIQUE(order_id,version));
 CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),provider TEXT NOT NULL,provider_order_id TEXT UNIQUE,
 provider_payment_id TEXT UNIQUE,amount_minor INTEGER NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS refunds (id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),payment_id TEXT NOT NULL REFERENCES payments(id),
 requested_minor INTEGER NOT NULL,fee_minor INTEGER NOT NULL,refund_minor INTEGER NOT NULL,status TEXT NOT NULL,requested_by TEXT NOT NULL,
 approved_by TEXT,reason TEXT NOT NULL,provider_refund_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS shipments (id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),carrier TEXT NOT NULL,tracking_number TEXT NOT NULL,
 status TEXT NOT NULL,address TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS shipment_events (id TEXT PRIMARY KEY,shipment_id TEXT NOT NULL REFERENCES shipments(id),status TEXT NOT NULL,location TEXT,notes TEXT,at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS work_orders (id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),machine TEXT,status TEXT NOT NULL,quantity INTEGER NOT NULL,notes TEXT,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS inventory (id TEXT PRIMARY KEY,name TEXT NOT NULL,unit TEXT NOT NULL,available REAL NOT NULL DEFAULT 0,reserved REAL NOT NULL DEFAULT 0,reorder_level REAL NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY,actor_id TEXT,event_type TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id TEXT,detail TEXT,at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS webhooks (event_id TEXT PRIMARY KEY,provider TEXT NOT NULL,payload_hash TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_quote_user ON quotes(user_id,created_at);CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id,created_at);
 CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);
 CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(entity_type,entity_id,at);`);
 return db;
}
export const now=()=>new Date().toISOString();
export const newId=(prefix='dp')=>`${prefix}_${crypto.randomUUID().replace(/-/g,'').slice(0,20)}`;
export function audit(db,actorId,eventType,entityType,entityId,detail={}){
 db.prepare('INSERT INTO audit_events VALUES (?,?,?,?,?,?,?)').run(newId('aud'),actorId||null,eventType,entityType,entityId||null,JSON.stringify(detail),now());
}
export function runAtomic(db,fn){db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}
export function json(v){return JSON.parse(v);}
export function record(row,keys=[]){if(!row)return null;const result={...row};for(const k of keys)if(result[k])result[k]=json(result[k]);return result;}
