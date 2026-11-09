import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDestinations,shipmentCoverage} from '../packages/core/fulfillment.mjs';
test('single destination default and strict multi-address quantity matching',()=>{
 const one=normalizeDestinations({address:'27 Main Road, Bengaluru Karnataka 560001',quantity:1,expectedCount:1});
 assert.equal(one[0].quantity,1);
 assert.throws(()=>normalizeDestinations({address:'26 Main Road Bengaluru 560001',quantity:1,expectedCount:2}),/destination/i);
 const two=[{recipient:'Customer A',quantity:3,address:'Bangalore Main Rd 560040'}, {recipient:'Customer B',quantity:5,address:'Mysuru Main Rd 570001'}];
 assert.equal(normalizeDestinations({destinations:two,quantity:8,expectedCount:2}).length,2);
 for(const invalid of [two.slice(0,1),[{...two[0],quantity:1},two[1]],[{...two[0],quantity:0},two[1]],[{...two[0],recipient:'X'},two[1]]]){
  assert.throws(()=>normalizeDestinations({destinations:invalid,quantity:8,expectedCount:2}));
 }
});
test('shipment coverage requires all delivered units, not merely a tracking number',()=>{
 const destinations=[{id:'a',quantity:3},{id:'b',quantity:4}];
 const shipments=[{destination_id:'a',quantity:3,status:'in_transit'},{destination_id:'b',quantity:1,status:'delivered'}];
 assert.equal(shipmentCoverage({destinations,shipments}),false);
 shipments.push({destination_id:'b',quantity:3,status:'collected'});
 assert.equal(shipmentCoverage({destinations,shipments}),true);
 assert.equal(shipmentCoverage({destinations,shipments,delivered:true}),false);
 shipments[0].status='delivered';shipments[2].status='delivered';
 assert.equal(shipmentCoverage({destinations,shipments,delivered:true}),true);
});
