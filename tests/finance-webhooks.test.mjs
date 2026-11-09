import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {openDb,migrate,now} from '../apps/api/db.mjs';
import {createServer} from '../apps/api/server.mjs';
import {createUser} from '../apps/api/auth.mjs';
const settings=['PAYMENTS_ENABLED','RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAY_WEBHOOK_SECRET'];
async function fixture(fn){
 const prior=Object.fromEntries(settings.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{PAYMENTS_ENABLED:'true',RAZORPAY_KEY_ID:'rzp_test_example',RAZORPAY_KEY_SECRET:'not-a-real-secret-123456',RAZORPAY_WEBHOOK_SECRET:'whsec_test_no_real_value_123456'});
 const db=migrate(openDb(':memory:'));
 const user=createUser(db,{email:'webhook@test.example',displayName:'Webhook Customer',password:'Example stronger password 123!',verified:true});
 db.prepare("INSERT INTO quotes(id,user_id,status,configuration,estimate,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run('q1',user.id,'accepted','{}','{}','2030-01-01T00:00:00Z',now(),now());
 db.prepare('INSERT INTO orders(id,quote_id,user_id,status,total_minor,address,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run('o1','q1',user.id,'pending_payment',100000,'10 Main Road, Bengaluru 560040',now(),now());
 db.prepare('INSERT INTO payments(id,order_id,provider,provider_order_id,amount_minor,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run('pay1','o1','razorpay','order_provider_1',100000,'initiated',now(),now());
 const server=createServer(db);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{await fn(`http://127.0.0.1:${server.address().port}/api/v1/payments/webhook`,db,user.id)}finally{
 await new Promise(r=>server.close(r));db.close();for(const k of settings){if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k];}
 }
}
async function event(url,eventName,entity,id,secret='whsec_test_no_real_value_123456'){
 const payload=JSON.stringify({event:eventName,payload:{[eventName.split('.')[0]]:{entity}}});
 const signature=createHmac('sha256',secret).update(payload).digest('hex');
 const res=await fetch(url,{method:'POST',headers:{'x-razorpay-event-id':id,'x-razorpay-signature':signature,'Content-Type':'application/json'},body:payload});
 return {status:res.status,body:await res.json()};
}
test('Razorpay signed webhooks are idempotent and verify amount, currency and provider',async()=>fixture(async(url,db,userId)=>{
 const correct={id:'pay_gateway_1',order_id:'order_provider_1',amount:100000,currency:'INR',status:'captured'};
 assert.equal((await event(url,'payment.captured',{...correct,amount:100},'event_mismatch')).status,200);
 assert.equal(db.prepare('SELECT status FROM payments WHERE id=?').get('pay1').status,'initiated');
 assert.equal((await event(url,'payment.captured',correct,'event_valid','a-wrong-signature-secret-123456')).status,401);
 assert.equal((await event(url,'payment.captured',correct,'event_valid')).status,200);
 assert.equal((await event(url,'payment.captured',correct,'event_valid')).status,200);
 assert.equal(db.prepare('SELECT status FROM payments WHERE id=?').get('pay1').status,'captured');
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE event_type='payment.captured.webhook'").get().n,1);
 db.prepare("INSERT INTO refunds(id,order_id,payment_id,requested_minor,fee_minor,refund_minor,status,requested_by,approved_by,reason,provider_refund_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").run('r1','o1','pay1',30000,3000,27000,'submitted',userId,'admin1','Customer approved exception','rfnd_gateway_1',now(),now());
 const refund={id:'rfnd_gateway_1',payment_id:'pay_gateway_1',amount:27000,currency:'INR',status:'processed'};
 assert.equal((await event(url,'refund.processed',{...refund,amount:28000},'refund_bad')).status,200);
 assert.equal(db.prepare('SELECT status FROM refunds WHERE id=?').get('r1').status,'submitted');
 assert.equal((await event(url,'refund.processed',refund,'refund_valid')).status,200);
 assert.equal((await event(url,'refund.processed',refund,'refund_valid')).status,200);
 assert.equal(db.prepare('SELECT status FROM refunds WHERE id=?').get('r1').status,'succeeded');
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE event_type='refund.succeeded.webhook'").get().n,1);
}));
