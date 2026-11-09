import test from 'node:test';
import assert from 'node:assert/strict';
import {openDb,migrate} from '../apps/api/db.mjs';
import {createServer} from '../apps/api/server.mjs';
import {createUser} from '../apps/api/auth.mjs';
import {estimate} from '../packages/core/estimate.mjs';

function fixture(){
 const db=migrate(openDb(':memory:'));
 createUser(db,{email:'owner@designpro.test',displayName:'Business Owner',password:'T3st Account Password !',role:'SUPER_ADMIN',verified:true});
 createUser(db,{email:'buyer@designpro.test',displayName:'Customer Buyer',password:'T3st Account Password !',verified:true});
 createUser(db,{email:'outsider@designpro.test',displayName:'Other Customer',password:'T3st Account Password !',verified:true});
 createUser(db,{email:'finance@designpro.test',displayName:'Finance Manager',password:'T3st Account Password !',role:'FINANCE',verified:true});
 const server=createServer(db);
 return {db,server};
}
async function req(base,path,{method='GET',session,body,csrf=true,headers={}}={}){
 const h={...(session?{cookie:session.cookie,...(csrf?{'x-csrf-token':session.csrf}:{})}:{}),...headers};
 if(body!==undefined)h['Content-Type']='application/json';
 const response=await fetch(base+'/api/v1'+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)});
 return {status:response.status,json:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function actor(base,email){const r=await req(base,'/auth/login',{method:'POST',body:{email,password:'T3st Account Password !'}});assert.equal(r.status,200);return {cookie:r.cookie,csrf:r.json.csrf,...r.json.user};}
async function serve(fn){const {server,db}=fixture();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;try{return await fn(base,db)}finally{await new Promise(resolve=>server.close(resolve));db.close()}}
async function checked(base,p,s,expected,body){const r=await req(base,p,{method:'POST',session:s,body});assert.equal(r.status,expected,`${p}: ${JSON.stringify(r.json)}`);return r.json}

// Test production-like risks without any live gateway or customer-visible fake payments.
test('indicative estimator rejects malformed dimensions, quantity and unknown kit SKUs',()=>{
 for(const input of [
  {categoryId:'welcome-kit',quantity:0}, {categoryId:'welcome-kit',quantity:100001},
  {categoryId:'welcome-kit',quantity:1.5}, {categoryId:'welcome-kit',quantity:true},
  {categoryId:'welcome-kit',quantity:2,kitItems:{alienBottle:true}},
  {categoryId:'welcome-kit',quantity:2,kitItems:{bottle:'yes'}},
  {categoryId:'rigid-box',quantity:10,material:'toxic'},
  {categoryId:'rigid-box',quantity:10,width:-50},
  {categoryId:'rigid-box',quantity:10,printSides:3},
  {categoryId:'rigid-box',quantity:10,destinationState:'??'},
 ])assert.throws(()=>estimate(input),{name:'Error'});
 const sample=estimate({categoryId:'rigid-box',quantity:1},{gstBps:1200});assert.equal(sample.taxMinor,Math.round(sample.netMinor*.12));
 assert.equal(sample.taxes[0].amountMinor+sample.taxes[1].amountMinor,sample.taxMinor);
});

test('authentication, request validation and cross-customer confidentiality',async()=>serve(async(base)=>{
 assert.equal((await req(base,'/admin/dashboard')).status,401);
 const bad=await req(base,'/auth/login',{method:'POST',body:{email:'buyer@designpro.test',password:'incorrectpassword!'}});assert.equal(bad.status,401);
 const b=await actor(base,'buyer@designpro.test'),outside=await actor(base,'outsider@designpro.test');
 assert.equal((await req(base,'/quotes',{method:'POST',session:b,csrf:false,body:{categoryId:'rigid-box',quantity:10}})).status,403);
 const short=await req(base,'/auth/register',{method:'POST',body:{email:'bad-email',displayName:'Z',password:'123'}});assert.equal(short.status,400);
 const q=await checked(base,'/quotes',b,201,{categoryId:'rigid-box',quantity:12});
 const customerQuotes=await req(base,'/quotes',{session:outside});assert.equal(customerQuotes.json.quotes.length,0);
 assert.equal((await req(base,`/quotes/${q.id}/accept`,{method:'POST',session:outside,body:{}})).status,403);
 const missing=await req(base,'/orders/unknown',{session:b});assert.equal(missing.status,404);
 assert.equal((await req(base,'/admin/roles',{session:b})).status,403);
 assert.equal((await req(base,'/admin/uat/capture-payment',{method:'POST',session:b,body:{orderId:'fake'}})).status,404);
}));

test('UAT demo payment is permission-gated; proof, production, shipping and refund lifecycle',async()=>{
 const old=process.env.UAT_DEMO_ENABLED;process.env.UAT_DEMO_ENABLED='true';
 try{await serve(async(base)=>{
  const buyer=await actor(base,'buyer@designpro.test'),owner=await actor(base,'owner@designpro.test'),outsider=await actor(base,'outsider@designpro.test'),fin=await actor(base,'finance@designpro.test');
  const quote=await checked(base,'/quotes',buyer,201,{categoryId:'welcome-kit',quantity:25,kitItems:{bottle:true,diary:true,pen:true}});
  assert.equal((await req(base,`/quotes/${quote.id}/accept`,{method:'POST',session:buyer,body:{}})).status,409);
  assert.equal((await req(base,`/quotes/${quote.id}/firm`,{method:'POST',session:buyer,body:{firmTotalMinor:250000,reviewNotes:'Approved dimensions and artwork'}})).status,403);
  await checked(base,`/quotes/${quote.id}/firm`,owner,200,{firmTotalMinor:250000,reviewNotes:'Reviewed stock, material, shipping and required margins'});
  await checked(base,`/quotes/${quote.id}/accept`,buyer,200,{});
  const order=await checked(base,'/orders',buyer,201,{quoteId:quote.id,address:'No. 25, Warehouse Road, Bengaluru, Karnataka 560040'});
  const orderId=order.id;
  assert.equal((await req(base,`/orders/${orderId}`,{session:outsider})).status,403);
  assert.equal((await req(base,'/admin/uat/capture-payment',{method:'POST',session:buyer,body:{orderId}})).status,403);
  assert.equal((await req(base,`/orders/${orderId}/transition`,{method:'POST',session:owner,body:{to:'pending_proof'}})).status,409);
  assert.equal((await req(base,'/admin/uat/capture-payment',{method:'POST',session:owner,body:{orderId,amountMinor:100}})).status,400);
  const testPayment=await checked(base,'/admin/uat/capture-payment',owner,201,{orderId,amountMinor:125000});assert.equal(testPayment.simulated,true);
  assert.equal((await req(base,'/admin/uat/capture-payment',{method:'POST',session:owner,body:{orderId,amountMinor:125000}})).status,409);
  assert.equal((await req(base,'/payments/initiate',{method:'POST',session:buyer,body:{orderId}})).status,409);
  await checked(base,`/orders/${orderId}/transition`,owner,200,{to:'pending_proof',reason:'Test advance verified'});
  assert.equal((await req(base,`/orders/${orderId}/transition`,{method:'POST',session:owner,body:{to:'production_ready'}})).status,409);
  const proof=await checked(base,'/proofs',owner,201,{orderId,notes:'First production draft with placement revision'});
  assert.equal((await req(base,`/proofs/${proof.id}/approve`,{method:'POST',session:outsider,body:{}})).status,403);
  await checked(base,`/proofs/${proof.id}/reject`,buyer,200,{});
  assert.equal((await req(base,`/proofs/${proof.id}/approve`,{method:'POST',session:buyer,body:{}})).status,409);
  const proof2=await checked(base,'/proofs',owner,201,{orderId,notes:'New customer-reviewed production artwork reference'});
  assert.equal((await req(base,`/proofs/${proof2.id}/approve`,{method:'POST',session:owner,body:{}})).status,403);
  await checked(base,`/proofs/${proof2.id}/approve`,buyer,200,{});
  await checked(base,`/orders/${orderId}/transition`,owner,200,{to:'production_ready',reason:'Customer approved proof'});
  assert.equal((await req(base,`/orders/${orderId}/transition`,{method:'POST',session:owner,body:{to:'shipped'}})).status,400);
  const job=await checked(base,'/admin/work-orders',owner,201,{orderId,machine:'UV Printer'});assert.equal(job.status,'planned');
  for(const to of ['in_production','quality_check','ready_to_ship'])await checked(base,`/orders/${orderId}/transition`,owner,200,{to,reason:'UAT progression'});
  const ship=await checked(base,'/shipments',owner,201,{orderId,carrier:'Manual UAT Courier',trackingNumber:'DP-TEST-000123'});
  assert.equal((await req(base,`/shipments/${ship.id}/track`,{session:outsider})).status,403);
  for(const status of ['labelled','collected','in_transit','delivered'])await checked(base,`/shipments/${ship.id}/events`,owner,200,{status,location:'Bengaluru',notes:'UAT tracking event'});
  const tracked=await req(base,`/shipments/${ship.id}/track`,{session:buyer});assert.equal(tracked.status,200);assert.equal(tracked.json.events.length,4);
  for(const to of ['shipped','delivered'])await checked(base,`/orders/${orderId}/transition`,owner,200,{to,reason:'Delivery confirmed'});
  assert.equal((await req(base,`/refunds`,{method:'POST',session:outsider,body:{paymentId:testPayment.id,requestedMinor:500,reason:'wrong order'}})).status,403);
  const refund=await checked(base,'/refunds',buyer,201,{paymentId:testPayment.id,requestedMinor:50000,feeMinor:20000,reason:'Customer made a genuine claim'});assert.equal(refund.feeDeductionMinor,0);
  assert.equal((await req(base,'/refunds',{method:'POST',session:buyer,body:{paymentId:testPayment.id,requestedMinor:100000,reason:'Second request exceeds balance'}})).status,400);
  assert.equal((await req(base,`/refunds/${refund.id}/approve`,{method:'POST',session:buyer,body:{}})).status,403);
  await checked(base,`/refunds/${refund.id}/approve`,fin,200,{});
  assert.equal((await req(base,`/refunds/${refund.id}/approve`,{method:'POST',session:fin,body:{}})).status,409);
  assert.equal((await req(base,`/refunds/${refund.id}/submit`,{method:'POST',session:fin,body:{}})).status,503);
  assert.equal((await req(base,'/admin/audit',{session:owner})).status,200);
 });}finally{if(old===undefined)delete process.env.UAT_DEMO_ENABLED;else process.env.UAT_DEMO_ENABLED=old;}
});

test('UAT capture route cannot be accessed without explicit switch',async()=>serve(async(base)=>{
 const owner=await actor(base,'owner@designpro.test');
 assert.equal((await req(base,'/admin/uat/capture-payment',{method:'POST',session:owner,body:{orderId:'fake'}})).status,404);
}));
