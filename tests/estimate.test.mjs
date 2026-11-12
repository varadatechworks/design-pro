import test from 'node:test';import assert from 'node:assert/strict';
import {estimate} from '../packages/core/estimate.mjs';
import {CATEGORIES} from '../packages/core/catalog.mjs';
const base={categoryId:'welcome-kit',quantity:100,length:240,width:180,height:80,material:'premium',finish:'softtouch',kitItems:{bottle:true,diary:true,pen:true,id:true,card:true}};
test('catalog has 16 defined product families',()=>assert.equal(CATEGORIES.length,16));
test('estimate returns itemized rounded tax and sale total',()=>{const q=estimate(base);assert.equal(q.status,'indicative');assert.ok(q.totalMinor>q.costMinor);assert.equal(q.totalMinor,q.netMinor+q.taxMinor);assert.equal(q.breakdown.reduce((s,x)=>s+x.costMinor,0),q.costMinor);assert.ok(q.cartons>0);});
test('one unit is supported but setup fee does not disappear',()=>{const a=estimate({...base,quantity:1}),b=estimate({...base,quantity:100});assert.equal(a.quantity,1);assert.equal(a.breakdown.find(x=>x.code==='setup').costMinor,b.breakdown.find(x=>x.code==='setup').costMinor);assert.ok(a.unitInclTaxMinor>b.unitInclTaxMinor)});
test('unreviewed laser cut requires technical confirmation',()=>assert.equal(estimate({categoryId:'laser-cut',quantity:5}).status,'technical_review'));
test('unreviewed custom manufacturing requires a technical review',()=>assert.equal(estimate({categoryId:'custom',quantity:2}).status,'technical_review'));
test('compatibility rejects unlisted materials and finishes',()=>{assert.throws(()=>estimate({...base,material:'metal'}),/not compatible/);assert.throws(()=>estimate({...base,finish:'engrave'}),/not compatible/)});
test('incompatible quantity, negative dimensions and over-large size rejected',()=>{for(const x of [{quantity:0},{quantity:100001},{length:-1},{height:999999}])assert.throws(()=>estimate({...base,...x}),/must be between/)});
test('urgent production and multiple destinations affect estimate',()=>{const standard=estimate(base),urgent=estimate({...base,rush:true,destinationCount:5});assert.ok(urgent.totalMinor>standard.totalMinor)});
test('in-state tax split and interstate IGST',()=>{const a=estimate(base),b=estimate({...base,destinationState:'MH'});assert.deepEqual(a.taxes.map(x=>x.component),['CGST','SGST']);assert.deepEqual(b.taxes.map(x=>x.component),['IGST']);assert.equal(a.taxMinor,b.taxMinor)});
test('quote snapshot includes expiry and approximations',()=>{const a=estimate(base);assert.ok(a.validUntil);assert.match(a.warnings.join(' '),/Indicative/)});

test('destination count cannot exceed the number of units',()=>assert.throws(()=>estimate({categoryId:'digital-print',quantity:1,destinationCount:2}),/Destination count/));

test('configured raw material and production components drive the design estimate',()=>{
 const components=[
  {id:'mat-1',code:'greyboard',label:'Greyboard',scope:'material',material_id:'greyboard',condition:'always',basis:'sqm',rate_minor:50000,factor_milli:1000,waste_bps:1000},
  {id:'cut-1',code:'cutting',label:'Die cutting',scope:'production',condition:'always',basis:'meter',rate_minor:1000,factor_milli:1000,waste_bps:0},
  {id:'print-1',code:'printing',label:'Printing',scope:'production',condition:'printing',basis:'1000_impressions',rate_minor:5000,factor_milli:1000,waste_bps:0},
  {id:'pack-1',code:'packing',label:'Packing',scope:'packing',condition:'always',basis:'piece',rate_minor:500,factor_milli:1000,waste_bps:0},
  {id:'ship-1',code:'shipping',label:'Freight',scope:'shipping',condition:'always',basis:'flat',rate_minor:2000,factor_milli:1000,waste_bps:0}
 ];
 const q=estimate({...base,categoryId:'rigid-box',quantity:10,material:'greyboard',finish:'matte'}, {_components:components});
 assert.ok(q.breakdown.some(x=>x.code==='component-mat-1'&&x.costMinor===84480));
 assert.ok(q.breakdown.some(x=>x.code==='component-cut-1'));
 assert.ok(q.breakdown.some(x=>x.code==='component-print-1'));
 assert.ok(q.breakdown.some(x=>x.code==='component-pack-1'));
 assert.ok(q.breakdown.some(x=>x.code==='component-ship-1'));
 assert.equal(q.breakdown.reduce((sum,x)=>sum+x.costMinor,0),q.costMinor-q.discountMinor);
 assert.match(q.warnings.join(' '),/active Admin production cost components/);
});
test('configured material wastage and shipping opt-out are applied once',()=>{
 const components=[
  {id:'mat-2',code:'kraft',label:'Kraft board',scope:'material',material_id:'kraft',condition:'always',basis:'sqm',rate_minor:10000,factor_milli:1000,waste_bps:1000},
  {id:'ship-2',code:'shipping',label:'Shipping',scope:'shipping',condition:'always',basis:'flat',rate_minor:10000,factor_milli:1000,waste_bps:0}
 ];
 const q=estimate({...base,categoryId:'rigid-box',quantity:10,material:'kraft',shipping:false},{_components:components});
 assert.equal(q.breakdown.some(x=>x.code==='component-ship-2'),false);
 const mat=q.breakdown.find(x=>x.code==='component-mat-2');
 assert.ok(mat.costMinor>0);
 assert.equal(q.breakdown.reduce((sum,x)=>sum+x.costMinor,0),q.costMinor-q.discountMinor);
});
