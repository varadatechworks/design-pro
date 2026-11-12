import test from 'node:test';
import assert from 'node:assert/strict';
import {openDb,migrate} from '../apps/api/db.mjs';
import {createServer} from '../apps/api/server.mjs';
import {createUser} from '../apps/api/auth.mjs';

function setup(){const db=migrate(openDb(':memory:'));createUser(db,{email:'root@designpro.test',displayName:'Root Admin',password:'Strong Admin Password 123!',role:'SUPER_ADMIN',verified:true});const server=createServer(db);return {db,server};}
async function request(base,path,{method='GET',cookie,csrf,body}={}){const response=await fetch(base+path,{method,headers:{...(cookie?{cookie}:{}),...(csrf?{'x-csrf-token':csrf}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});const contentType=response.headers.get('content-type')||'';const data=contentType.includes('text/html')?await response.text():contentType.includes('application/json')?await response.json():await response.arrayBuffer();return {code:response.status,body:data,cookie:response.headers.get('set-cookie')?.split(';')[0],type:response.headers.get('content-type')};}
test('admin CMS, catalogue, product, media and effective-dated pricing management',async()=>{
 const {db,server}=setup();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{
  const adminPage=await request(base,'/admin');assert.equal(adminPage.code,200);assert.match(adminPage.body,/DesignPro · Admin Console/);
  assert.equal((await request(base,'/api/v1/admin/management/categories')).code,401);
  const login=await request(base,'/api/v1/auth/login',{method:'POST',body:{email:'root@designpro.test',password:'Strong Admin Password 123!'}});
  assert.equal(login.code,200);const cookie=login.cookie,csrf=login.body.csrf;
  assert.equal((await request(base,'/api/v1/admin/management/categories',{method:'POST',cookie,body:{id:'no-csrf',name:'Blocked',kind:'box',materials:['greyboard'],finishes:['matte']}})).code,403);
  const category=await request(base,'/api/v1/admin/management/categories',{method:'POST',cookie,csrf,body:{id:'test-box',name:'Test Box',tag:'Test category',icon:'box',kind:'box',baseMinor:12500,setupMinor:20000,leadDays:4,materials:['greyboard'],finishes:['matte'],active:true,sortOrder:50}});
  assert.equal(category.code,201);
  const product=await request(base,'/api/v1/admin/management/products',{method:'POST',cookie,csrf,body:{categoryId:'test-box',name:'Sample Product',slug:'sample-product',description:'Managed product',sku:'DP-001',imageUrl:'https://example.test/product.png',specifications:{size:'A5'},active:true,sortOrder:1}});
  assert.equal(product.code,201);
  const rate=await request(base,'/api/v1/admin/management/rates',{method:'POST',cookie,csrf,body:{categoryId:'test-box',baseUnitMinor:15000,setupMinor:25000,marginBps:2500,gstBps:1800,discountBps:500,discountMinQty:5,effectiveFrom:new Date().toISOString().slice(0,10)}});
  assert.equal(rate.code,200);
  assert.equal((await request(base,'/api/v1/admin/management/cost-components')).code,401);
  const materialCost=await request(base,'/api/v1/admin/management/cost-components',{method:'POST',cookie,csrf,body:{code:'greyboard-sheet',label:'Greyboard sheet',scope:'material',categoryId:'test-box',materialId:'greyboard',condition:'always',basis:'sqm',rateMinor:50000,factorMilli:1000,wasteBps:800,effectiveFrom:new Date().toISOString().slice(0,10)}});
  assert.equal(materialCost.code,201);
  const cuttingCost=await request(base,'/api/v1/admin/management/cost-components',{method:'POST',cookie,csrf,body:{code:'die-cutting',label:'Die cutting',scope:'production',categoryId:'test-box',condition:'always',basis:'meter',rateMinor:1200,factorMilli:1000,wasteBps:0,effectiveFrom:new Date().toISOString().slice(0,10)}});
  assert.equal(cuttingCost.code,201);
  const invalidCost=await request(base,'/api/v1/admin/management/cost-components',{method:'POST',cookie,csrf,body:{code:'bad',label:'Invalid',scope:'material',materialId:'greyboard',condition:'always',basis:'unknown',rateMinor:100,effectiveFrom:new Date().toISOString().slice(0,10)}});
  assert.equal(invalidCost.code,400);
  const costEstimate=await request(base,'/api/v1/estimate',{method:'POST',body:{categoryId:'test-box',quantity:10,material:'greyboard',finish:'matte'}});
  assert.equal(costEstimate.code,200);const costList=await request(base,'/api/v1/admin/management/cost-components');const greyboardRecord=costList.body.components.find(c=>c.code==='greyboard-sheet');assert.ok(greyboardRecord);assert.ok(costEstimate.body.breakdown.some(x=>x.code==='component-'+greyboardRecord.id));
  createUser(db,{email:'buyer@designpro.test',displayName:'Buyer',password:'Strong Buyer Password 123!',role:'CUSTOMER',verified:true});
  const buyerLogin=await request(base,'/api/v1/auth/login',{method:'POST',body:{email:'buyer@designpro.test',password:'Strong Buyer Password 123!'}});
  assert.equal(buyerLogin.code,200);
  const savedQuote=await request(base,'/api/v1/quotes',{method:'POST',cookie:buyerLogin.cookie,csrf:buyerLogin.body.csrf,body:{categoryId:'test-box',quantity:10,material:'greyboard',finish:'matte'}});
  assert.equal(savedQuote.code,201);assert.ok(savedQuote.body.breakdown.some(x=>x.code==='component-'+greyboardRecord.id),'Saved quote must use the same active cost model as the preview estimate');

  const estimate=await request(base,'/api/v1/estimate',{method:'POST',body:{categoryId:'test-box',quantity:10,material:'greyboard',finish:'matte'}});
  assert.equal(estimate.code,200);assert.ok(estimate.body.breakdown.some(x=>x.code==='setup'&&x.costMinor===25000));assert.equal(estimate.body.marginBps,2500);assert.equal(estimate.body.taxes[0].rateBps,900);assert.equal(estimate.body.discountBps,500);assert.ok(estimate.body.discountMinor>0);assert.ok(estimate.body.breakdown.some(x=>x.code==='discount'&&x.costMinor<0));
  const content=await request(base,'/api/v1/admin/management/content',{method:'PUT',cookie,csrf,body:{content:{heroDescription:'Updated storefront message',announcement:'New launch'}}});
  assert.equal(content.code,200);
  const publicContent=await request(base,'/api/v1/site-content');assert.equal(publicContent.body.content.heroDescription,'Updated storefront message');
  const page=await request(base,'/api/v1/admin/management/pages',{method:'POST',cookie,csrf,body:{slug:'about-test',title:'About DesignPro',body:'A managed content page.',metaTitle:'About',metaDescription:'About us',published:true}});
  assert.equal(page.code,201);
  const publicPage=await request(base,'/pages/about-test');assert.equal(publicPage.code,200);assert.match(publicPage.body,/A managed content page/);
  assert.doesNotMatch(publicPage.body,/<script>/i);
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p2sAAAAASUVORK5CYII=';
  const media=await request(base,'/api/v1/admin/management/media',{method:'POST',cookie,csrf,body:{name:'Pixel',altText:'One pixel',dataUrl:image}});
  assert.equal(media.code,201);
  const invalidMedia=await request(base,'/api/v1/admin/management/media',{method:'POST',cookie,csrf,body:{name:'Fake',dataUrl:'data:image/png;base64,SGVsbG8='}});assert.equal(invalidMedia.code,400);
  const imageResponse=await request(base,media.body.url);assert.equal(imageResponse.code,200);assert.match(imageResponse.type,/image\/png/);
  const publicCatalog=await request(base,'/api/v1/catalog');assert.ok(publicCatalog.body.categories.some(x=>x.id==='test-box'));assert.ok(publicCatalog.body.products.some(x=>x.id===product.body.id));
  assert.equal((await request(base,'/api/v1/admin/management/overview',{cookie})).code,200);
 }finally{await new Promise(resolve=>server.close(resolve));db.close();}
});
