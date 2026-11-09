import test from 'node:test';
import assert from 'node:assert/strict';
import {strictJsonObject,strictMinorUnits} from '../packages/core/request-validation.mjs';
import {openDb,migrate} from '../apps/api/db.mjs';
import {createServer} from '../apps/api/server.mjs';

test('JSON object contract rejects null, array, primitives and corrupt JSON',()=>{
 assert.deepEqual(strictJsonObject(''),{});
 assert.deepEqual(strictJsonObject('{"quantity":7}'),{quantity:7});
 for(const value of ['null','[]','true','"text"','4','{"bad":'])assert.throws(()=>strictJsonObject(value),e=>e.status===400);
});
test('money in paise must not accept JS coercion of boolean, empty or decimal values',()=>{
 for(const n of [null,undefined,true,false,'', ' ','01','1.4',1.4,-1,'-1',{},[],Infinity,Number.MAX_SAFE_INTEGER])assert.throws(()=>strictMinorUnits(n,'test money'),e=>e.status===400);
 for(const n of [0,1,'0','12500',1000000000])assert.equal(strictMinorUnits(n),Number(n));
});
test('API rejects invalid JSON roots, content types and broken UTF-8',async()=>{
 const db=migrate(openDb(':memory:')),server=createServer(db);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}/api/v1/estimate`;
 try{
  for(const value of ['null','[]','true','"text"','{broken']){
   const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:value});
   assert.equal(r.status,400,value);assert.match((await r.json()).error,/JSON|object/i);
  }
  const wrongType=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain'},body:'{"categoryId":"rigid-box","quantity":10}'});
  assert.equal(wrongType.status,415);assert.match((await wrongType.json()).error,/Content-Type/);
  const invalidUtf8=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:Buffer.from([0xff,0xfe])});
  assert.equal(invalidUtf8.status,400);
  const good=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:'{"categoryId":"rigid-box","quantity":10}'});
  assert.equal(good.status,200);assert.ok((await good.json()).totalMinor>0);
 }finally{await new Promise(resolve=>server.close(resolve));db.close();}
});
