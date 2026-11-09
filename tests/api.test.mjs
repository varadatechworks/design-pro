import test from 'node:test';import assert from 'node:assert/strict';
import {openDb,migrate} from '../apps/api/db.mjs';import {createServer} from '../apps/api/server.mjs';import {createUser} from '../apps/api/auth.mjs';
function setup(){const db=migrate(openDb(':memory:'));createUser(db,{email:'admin@test.example',displayName:'Admin One',password:'A strong test password !',role:'SUPER_ADMIN',verified:true});const server=createServer(db);return {db,server};}
async function request(base,path,{method='GET',cookie,csrf,body}={}){const response=await fetch(base+'/api/v1'+path,{method,headers:{...(cookie?{cookie}:{}),...(csrf?{'x-csrf-token':csrf}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const json=await response.json();return {code:response.status,body:json,cookie:response.headers.get('set-cookie')?.split(';')[0]};}
async function login(base,email,password){const r=await request(base,'/auth/login',{method:'POST',body:{email,password}});assert.equal(r.code,200);return {cookie:r.cookie,csrf:r.body.csrf,user:r.body.user};}
test('full quote -> firm -> acceptance -> order workflow and access controls',async()=>{const {db,server}=setup();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 try{const cat=await request(base,'/catalog');assert.equal(cat.body.categories.length,16);const guestEstimate=await request(base,'/estimate',{method:'POST',body:{categoryId:'rigid-box',quantity:1}});assert.equal(guestEstimate.code,200);
 const signup=await request(base,'/auth/register',{method:'POST',body:{email:'buyer@test.example',displayName:'Buyer One',password:'Very Strong Buyer Pass 1!'}});assert.equal(signup.code,201);
 const buyer=await login(base,'buyer@test.example','Very Strong Buyer Pass 1!'),admin=await login(base,'admin@test.example','A strong test password !');
 assert.equal((await request(base,'/quotes',{method:'POST',cookie:buyer.cookie,body:{categoryId:'rigid-box',quantity:10}})).code,403);
 const q=await request(base,'/quotes',{method:'POST',cookie:buyer.cookie,csrf:buyer.csrf,body:{categoryId:'rigid-box',quantity:10}});assert.equal(q.code,201);const id=q.body.id;
 assert.equal((await request(base,`/quotes/${id}/accept`,{method:'POST',cookie:buyer.cookie,csrf:buyer.csrf,body:{}})).code,409);
 assert.equal((await request(base,`/quotes/${id}/firm`,{method:'POST',cookie:buyer.cookie,csrf:buyer.csrf,body:{firmTotalMinor:100000,reviewNotes:'Checked'}})).code,403);
 const firm=await request(base,`/quotes/${id}/firm`,{method:'POST',cookie:admin.cookie,csrf:admin.csrf,body:{firmTotalMinor:100000,reviewNotes:'Approved material, shape, tolerances and shipping costs'}});assert.equal(firm.code,200);
 assert.equal((await request(base,`/quotes/${id}/accept`,{method:'POST',cookie:buyer.cookie,csrf:buyer.csrf,body:{}})).code,200);
 const order=await request(base,'/orders',{method:'POST',cookie:buyer.cookie,csrf:buyer.csrf,body:{quoteId:id,address:'42 Main Street, Bengaluru Karnataka, India 560001'}});assert.equal(order.code,201);
 const attempt=await request(base,`/orders/${order.body.id}/transition`,{method:'POST',cookie:admin.cookie,csrf:admin.csrf,body:{to:'pending_proof'}});assert.equal(attempt.code,409);
 assert.equal((await request(base,'/admin/dashboard',{cookie:buyer.cookie})).code,403);
 assert.equal((await request(base,'/admin/dashboard',{cookie:admin.cookie})).code,200);
 assert.equal((await request(base,'/orders',{cookie:buyer.cookie})).body.orders.length,1);
 assert.equal((await request(base,'/payments/initiate',{method:'POST',cookie:buyer.cookie,csrf:buyer.csrf,body:{orderId:order.body.id}})).code,503);
 }finally{await new Promise(resolve=>server.close(resolve));db.close();}
});
