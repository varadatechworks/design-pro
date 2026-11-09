/** Shipment allocation controls; quote destination count must match the actual delivery plan. */
const validQuantity = n => Number.isSafeInteger(n) && n > 0 && n <= 100000;
export function normalizeDestinations({destinations,address,expectedCount,quantity}) {
 if (!validQuantity(quantity) || !Number.isSafeInteger(expectedCount) || expectedCount < 1 || expectedCount > 1000) throw new Error('Invalid quote fulfilment quantity');
 if (destinations === undefined || destinations === null) {
  if (expectedCount !== 1) throw new Error('This quote requires destination details for every delivery address');
  const plain=String(address??'').trim();if(plain.length<10 || plain.length>800)throw new Error('Complete delivery address required');
  return [{recipient:'Customer',address:plain,quantity,phone:null}];
 }
 if(!Array.isArray(destinations)||destinations.length!==expectedCount)throw new Error('Destination count does not match quoted freight. Request a revised quote.');
 let total=0;
 const clean=destinations.map((d,i)=>{
  if(!d||typeof d!=='object'||Array.isArray(d))throw new Error(`Invalid destination ${i+1}`);
  const recipient=String(d.recipient??'').trim(),location=String(d.address??'').trim();
  if(recipient.length<2||recipient.length>100||location.length<10||location.length>800||!validQuantity(d.quantity))throw new Error(`Check recipient, address and quantity for destination ${i+1}`);
  const phone=d.phone==null||d.phone===''?null:String(d.phone).trim();
  if(phone&&!/^\+?[0-9][0-9\- ]{7,17}$/.test(phone))throw new Error(`Invalid contact number for destination ${i+1}`);
  total+=d.quantity;if(!Number.isSafeInteger(total)||total>quantity)throw new Error('Delivery quantities exceed the quoted quantity');
  return {recipient,address:location,quantity:d.quantity,phone};
 });
 if(total!==quantity)throw new Error('Delivery quantities must equal the quantity in the accepted quotation');
 return clean;
}
/** Every destination must have sufficient dispatched/received units. */
export function shipmentCoverage({destinations,shipments,delivered=false}){
 if(!destinations?.length)return false;
 return destinations.every(d=>{
  const rows=shipments.filter(s=>s.destination_id===d.id&&
   (delivered ? s.status==='delivered' : ['collected','in_transit','delivered'].includes(s.status)));
  return rows.reduce((n,s)=>n+s.quantity,0) >= d.quantity;
 });
}
