import {openDb,migrate} from '../apps/api/db.mjs';
const db=openDb(':memory:');
try{
 migrate(db);
 const before=db.prepare("SELECT type,name,sql FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
 migrate(db);
 const after=db.prepare("SELECT type,name,sql FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
 if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Second migration changed existing schema (non-idempotent).');
 const integrity=db.prepare('PRAGMA integrity_check').all();
 const foreignKeys=db.prepare('PRAGMA foreign_key_check').all();
 if(integrity.length!==1||integrity[0].integrity_check!=='ok'||foreignKeys.length)throw new Error('Database integrity or foreign-key validation failed.');
 const tables=after.filter(row=>row.type==='table');
 const expected=['users','sessions','quotes','orders','order_destinations','proofs','payments','refunds','work_orders','qc_inspections','shipments','shipment_events','tickets','ticket_messages','inventory','audit_events','webhooks','settings','custom_roles'];
 for(const name of expected)if(!tables.some(t=>t.name===name))throw new Error('Missing required table: '+name);
 console.log(JSON.stringify({result:'pass',engine:'development SQLite',tables:tables.length,indexes:after.length-tables.length,idempotent:true,integrity:'ok',foreignKeys:'ok'},null,2));
}finally{db.close();}
