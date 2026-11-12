import {getCategory,CATEGORIES,MATERIALS,FINISHES,KIT_ITEMS} from './catalog.mjs';
const integer=(v,min,max,label)=>{const x=typeof v==='number'?v:Number(v);if(v===null||v===true||v===false||typeof v==='object'||v===''||!Number.isSafeInteger(x)||x<min||x>max)throw new Error(`${label} must be between ${min} and ${max}`);return x;};
const money=(value,bps)=>{if(!Number.isSafeInteger(value)||value<0||!Number.isSafeInteger(bps)||bps<0)throw new Error('Invalid money');const x=(BigInt(value)*BigInt(bps)+5000n)/10000n;if(x>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Cost overflow');return Number(x);};
const sum=xs=>xs.reduce((a,b)=>{const n=a+b;if(!Number.isSafeInteger(n))throw new Error('Cost overflow');return n;},0);

const DESIGN_FACES=['front','back','left','right','top','bottom'];
const DESIGN_SHAPES=['rectangular','cube','tall','flat','rounded','oval-box','round-box','hexagon-box','pentagon-box','bottle','label-sheet','display','custom'];
const DESIGN_FONTS=['serif','sans','display','mono','arial','georgia','times','verdana','tahoma','trebuchet','palatino','garamond','noto-sans','noto-serif','kannada','custom'];
function normalizeDesignStudio(value){
 if(value===undefined||value===null)return null;
 if(typeof value!=='object'||Array.isArray(value))throw new Error('Design studio settings must be an object');
 const shape=value.shape??'rectangular';
 if(typeof shape!=='string'||!DESIGN_SHAPES.includes(shape))throw new Error('Invalid design studio shape');
 const colors=value.faceColors??{},texts=value.faceTexts??{};
 if(!colors||typeof colors!=='object'||Array.isArray(colors)||!texts||typeof texts!=='object'||Array.isArray(texts))throw new Error('Invalid side design settings');
 const faceColors={},faceTexts={};
 for(const face of DESIGN_FACES){
  const color=colors[face]??'#373327';
  if(typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))throw new Error('Each side colour must be a six-digit hex value');
  const text=texts[face]??'';
  if(typeof text!=='string'||text.length>120)throw new Error('Side text must be 120 characters or fewer');
  faceColors[face]=color.toUpperCase();faceTexts[face]=text.trim();
 }
 const fontSize=integer(value.fontSize??16,10,48,'Preview text size');
 const textAlign=value.textAlign??'center';
 if(!['left','center','right'].includes(textAlign))throw new Error('Invalid side text alignment');
 const rawTypography=value.faceTypography??{};
 if(!rawTypography||typeof rawTypography!=='object'||Array.isArray(rawTypography))throw new Error('Side typography must be an object');
 const faceTypography={};
 for(const face of DESIGN_FACES){
  const item=rawTypography[face]??{};
  if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('Invalid typography for '+face+' side');
  const fontFamily=item.fontFamily??'serif',fontStyle=item.fontStyle??'normal',fontWeight=String(item.fontWeight??'600');
  const fontColor=item.fontColor??'#F4E6CF',sideFontSize=integer(item.fontSize??16,10,48,'Side font size');
  const sideTextAlign=item.textAlign??'center';
  if(!DESIGN_FONTS.includes(fontFamily))throw new Error('Unsupported font family');
  if(!['normal','italic'].includes(fontStyle))throw new Error('Unsupported font style');
  if(!['300','400','500','600','700','800'].includes(fontWeight))throw new Error('Unsupported font weight');
  if(typeof fontColor!=='string'||!/^#[0-9a-f]{6}$/i.test(fontColor))throw new Error('Side font colour must be a six-digit hex value');
  if(!['left','center','right'].includes(sideTextAlign))throw new Error('Invalid side text alignment');
  faceTypography[face]={fontFamily,fontStyle,fontColor:fontColor.toUpperCase(),fontWeight,fontSize:sideFontSize,textAlign:sideTextAlign};
 }
 const rawPositions=value.artworkPositions??{};
 if(!rawPositions||typeof rawPositions!=='object'||Array.isArray(rawPositions))throw new Error('Artwork positions must be an object');
 const artworkPositions={};
 const percent=(v,min,max,label)=>{const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw new Error(label+' must be between '+min+' and '+max);return Math.round(n*10)/10;};
 for(const face of DESIGN_FACES){
  const item=rawPositions[face]??{};
  if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('Invalid artwork position for '+face+' side');
  const left=percent(item.left??20,0,88,'Artwork left position');
  const top=percent(item.top??18,0,88,'Artwork top position');
  const width=percent(item.width??60,12,100-left,'Artwork width');
  const height=percent(item.height??60,12,100-top,'Artwork height');
  artworkPositions[face]={left,top,width,height};
 }
 const rawLayers=value.textLayers??{};
 if(!rawLayers||typeof rawLayers!=='object'||Array.isArray(rawLayers))throw new Error('Text layers must be an object');
 const textLayers={};
 for(const face of DESIGN_FACES){
  let layers=rawLayers[face];
  if(layers===undefined)layers=faceTexts[face]?[{id:'legacy-'+face,text:faceTexts[face],position:rawPositions[face]??{left:12,top:62,width:76,height:25},...(faceTypography[face]||{})}]:[];
  if(!Array.isArray(layers)||layers.length>8)throw new Error('Each side can contain at most 8 text layers');
  const ids=new Set();
  textLayers[face]=layers.map(layer=>{
   if(!layer||typeof layer!=='object'||Array.isArray(layer))throw new Error('Invalid text layer');
   const id=String(layer.id??'');if(!/^[a-zA-Z0-9_-]{1,48}$/.test(id)||ids.has(id))throw new Error('Text layer identifier is invalid or duplicated');ids.add(id);
   const text=layer.text??'';if(typeof text!=='string'||text.length>120)throw new Error('Text layer content must be 120 characters or fewer');
   const fontFamily=layer.fontFamily??'serif',fontStyle=layer.fontStyle??'normal',fontWeight=String(layer.fontWeight??'600'),fontColor=layer.fontColor??'#F4E6CF',fontSize=integer(layer.fontSize??16,10,48,'Text layer font size'),textAlign=layer.textAlign??'center';
   if(!DESIGN_FONTS.includes(fontFamily)||!['normal','italic'].includes(fontStyle)||!['300','400','500','600','700','800'].includes(fontWeight)||!['left','center','right'].includes(textAlign)||typeof fontColor!=='string'||!/^#[0-9a-f]{6}$/i.test(fontColor))throw new Error('Text layer typography is invalid');
   const position=layer.position??{};if(!position||typeof position!=='object'||Array.isArray(position))throw new Error('Text layer position is invalid');
   const left=percent(position.left??12,0,88,'Text layer left position'),top=percent(position.top??62,0,90,'Text layer top position'),width=percent(position.width??76,12,100-left,'Text layer width'),height=percent(position.height??25,10,100-top,'Text layer height');
   return {id,text:text.trim(),position:{left,top,width,height},fontFamily,fontStyle,fontWeight,fontColor:fontColor.toUpperCase(),fontSize,textAlign};
  });
 }
 const customShapeFileName=value.customShapeFileName??'';
 if(typeof customShapeFileName!=='string'||customShapeFileName.length>120)throw new Error('Custom shape filename is invalid');
 const sourceFiles=value.artworkFiles??{};
 if(!sourceFiles||typeof sourceFiles!=='object'||Array.isArray(sourceFiles))throw new Error('Artwork file metadata must be an object');
 const artworkFiles={};
 for(const [face,metadata] of Object.entries(sourceFiles)){
  if(!DESIGN_FACES.includes(face)||!metadata||typeof metadata!=='object'||Array.isArray(metadata))throw new Error('Invalid artwork side metadata');
  const fileName=metadata.fileName;
  if(typeof fileName!=='string'||!fileName.trim()||fileName.length>180)throw new Error('Artwork filename is invalid');
  const sizeBytes=integer(metadata.sizeBytes??0,0,15*1024*1024,'Artwork file size');
  const mimeType=String(metadata.mimeType??'').slice(0,100);
  artworkFiles[face]={fileName:fileName.trim(),sizeBytes,mimeType};
 }
 const aiConcept=value.aiConcept??null;
 if(aiConcept!==null&&(typeof aiConcept!=='string'||aiConcept.length>120))throw new Error('AI concept name is invalid');
 return {shape,faceColors,faceTexts,fontSize,textAlign,faceTypography,artworkPositions,textLayers,customShapeFileName,artworkFiles,aiConcept};
}

const line=(code,label,costMinor)=>({code,label,costMinor});
export function estimate(input,rateCard={},catalog=CATEGORIES){
 if(!input||typeof input!=='object')throw new Error('Configuration is required');
 const category=catalog.find(item=>item.id===input.categoryId)||getCategory(input.categoryId);if(!category)throw new Error('Unknown category');
 const quantity=integer(input.quantity,1,100000,'Quantity');
 const length=integer(input.length??240,20,2000,'Length (mm)');
 const width=integer(input.width??180,20,2000,'Width (mm)');
 const height=integer(input.height??80,1,1000,'Height (mm)');
 const material=input.material||category.materials[0];
 const finish=input.finish||category.finishes[0];
 if(!category.materials.includes(material)||!MATERIALS[material])throw new Error('Material not compatible with product');
 if(!category.finishes.includes(finish)||!FINISHES[finish])throw new Error('Finish not compatible with product');
 const printSides=integer(input.printSides??1,1,2,'Print sides');
 const designComplexity=integer(input.designComplexity??1,1,4,'Design complexity');
 const unitsPerCarton=integer(input.unitsPerCarton??25,1,500,'Units per carton');
 const activeRate={...rateCard,...(rateCard[category.id]||{})};
 const baseUnit=integer(activeRate.baseUnitMinor??category.base,0,10000000,'Unit rate');
 const fixedSetup=integer(activeRate.setupMinor??category.setup,0,100000000,'Setup rate');
 const areaRatio=Math.max(0.3,Math.min(14,(length*width)/(240*180)));
 const geometryMultiplierBps=Math.round(areaRatio*10000);
 const selected=input.kitItems??{};
 if(!selected||typeof selected!=='object'||Array.isArray(selected))throw new Error('Kit contents must be an object');
 for(const [id,enabled] of Object.entries(selected)){if(!Object.hasOwn(KIT_ITEMS,id)||typeof enabled!=='boolean')throw new Error('Invalid kit content selection');}
 let itemCost=category.kind==='kit'?Object.entries(selected).reduce((acc,[id,on])=>acc+(on?KIT_ITEMS[id].costMinor:0),0):0;
 const destinationState=String(input.destinationState||'KA').toUpperCase();
 if(!/^[A-Z]{2}$/.test(destinationState))throw new Error('Invalid destination state code');
 const cartons=Math.ceil(quantity/unitsPerCarton);
 const perPieceKg=Math.max(0.05,(length*width*height)/5_000_000);
 const chargeableKg=Math.ceil(Math.max(perPieceKg*quantity,(length*width*height)/5_000_000*quantity)*100)/100;
 const destinationCount=integer(input.destinationCount??1,1,1000,'Destination count');
 if(destinationCount>quantity)throw new Error('Destination count cannot exceed order quantity');
 const components=Array.isArray(rateCard._components)?rateCard._components:[];
 const applicable=components.filter(c=>(!c.category_id||c.category_id===category.id)&&
  (c.scope!=='material'||c.material_id===material)&&(c.scope!=='kit'||selected[c.material_id]===true)&&
  (c.condition==='always'||(c.condition==='finish'&&c.option_id===finish)||(c.condition==='printing'&&printSides>0)||(c.condition==='rush'&&Boolean(input.rush)))&&!(c.scope==='shipping'&&input.shipping===false));
 const hasConfiguredMaterial=applicable.some(c=>c.scope==='material');
 if(applicable.some(c=>c.scope==='kit'))itemCost=Object.entries(selected).reduce((acc,[id,on])=>acc+(on&&!applicable.some(c=>c.scope==='kit'&&c.material_id===id)?KIT_ITEMS[id].costMinor:0),0);
 const componentModel=hasConfiguredMaterial&&components.length>0;
 let rawMaterial=0,scrap=0,setup=0,assembly=0,rush=0,shipping=0,processing=0;
 const componentLines=[];
 if(componentModel){
  const surfaceAreaM2=2*(length*width+length*height+width*height)/1_000_000;
  const cutLengthM=2*(length+width+height)/1000;
  for(const c of applicable){
   const basis=c.basis;
   let units=0;
   if(basis==='sqm')units=surfaceAreaM2*quantity*(c.condition==='printing'?printSides:1);
   else if(basis==='piece')units=quantity;
   else if(basis==='1000_impressions')units=quantity*printSides/1000;
   else if(basis==='meter')units=cutLengthM*quantity;
   else if(basis==='hour')units=quantity*(c.factor_milli??1000)/1000;
   else if(basis==='flat')units=1;
   const factor=(basis==='hour'?1:(c.factor_milli??1000)/1000);
   const baseCost=Math.round(units*factor*c.rate_minor);
   const wasteCost=Math.round(baseCost*(c.waste_bps??0)/10000);
   const amount=baseCost+wasteCost;
   if(!Number.isSafeInteger(amount)||amount<0)throw new Error('Production cost overflow');
   if(!amount)continue;
   if(c.scope==='material')rawMaterial+=baseCost;
   else if(c.scope==='production')processing+=baseCost;
   else if(c.scope==='packing'||c.scope==='kit')assembly+=baseCost;
   else if(c.scope==='shipping')shipping+=baseCost;
   scrap+=wasteCost;
   componentLines.push(line('component-'+c.id,c.label+(wasteCost?' (incl. wastage)':''),amount));
  }
  setup=fixedSetup;
  if(itemCost)assembly+=itemCost*quantity;
  if(input.shipping===false)shipping=0;
  if(input.rush&&!applicable.some(c=>c.condition==='rush'))rush=money(sum([rawMaterial,processing,setup,assembly,scrap]),2000);
 }else{
  const unitMaterial=money(money(baseUnit,MATERIALS[material].factorBps),Math.round(Math.max(0.3,Math.min(14,(length*width)/(240*180)))*10000));
  const unitFinished=money(unitMaterial,FINISHES[finish].factorBps);
  const unitProcessing=Math.round(baseUnit*(printSides===2?0.16:0.08)*designComplexity);
  const unitBase=sum([unitFinished,unitProcessing,itemCost]);
  const rawMaterialLegacy=sum([money(unitFinished*quantity,10000),money(unitProcessing*quantity,10000),itemCost*quantity]);
  rawMaterial=rawMaterialLegacy;
  scrap=money(rawMaterial,quantity>=500?300:700);
  setup=sum([fixedSetup,money(fixedSetup,(designComplexity-1)*1500)]);
  assembly=category.kind==='kit'?quantity*2200:category.kind==='box'?quantity*900:0;
  rush=Boolean(input.rush)?money(sum([rawMaterial,scrap,setup,assembly]),2000):0;
  shipping=input.shipping===false?0:sum([cartons*3500,Math.ceil(chargeableKg)*1800,(destinationCount-1)*9000]);
 }
 const costBase=sum([rawMaterial,processing,scrap,setup,assembly,rush,shipping]);
 const targetMarginBps=integer(activeRate.marginBps??2500,100,6500,'Margin (basis points)');
 const sellingBeforeDiscount=Number((BigInt(costBase)*10000n+BigInt(10000-targetMarginBps-1))/BigInt(10000-targetMarginBps));
 if(!Number.isSafeInteger(sellingBeforeDiscount))throw new Error('Amount overflow');
 const discountBps=quantity>=(activeRate.discountMinQty??1)?integer(activeRate.discountBps??0,0,5000,'Discount basis points'):0;
 const discountMinor=money(sellingBeforeDiscount,discountBps);
 const taxable=sellingBeforeDiscount-discountMinor;
 const totalTax=money(taxable,integer(activeRate.gstBps??1800,0,2800,'GST basis points'));
 const gstBps=integer(activeRate.gstBps??1800,0,2800,'GST basis points');
 const stateHalf=Math.floor(gstBps/2);
 const taxes=destinationState==='KA'?[
  {component:'CGST',rateBps:stateHalf,amountMinor:money(taxable,stateHalf)},
  {component:'SGST',rateBps:gstBps-stateHalf,amountMinor:totalTax-money(taxable,stateHalf)}
 ]:[{component:'IGST',rateBps:gstBps,amountMinor:totalTax}];
 const taxMinor=sum(taxes.map(t=>t.amountMinor));
 const missingCostScopes=componentModel?[
  ...(!applicable.some(c=>c.scope==='production')?['production operation']:[]),
  ...(printSides>0&&!applicable.some(c=>c.condition==='printing')?['printing']:[]),
  ...(finish!=='none'&&!applicable.some(c=>c.condition==='finish'&&c.option_id===finish)?['selected finish']:[]),
  ...(input.shipping!==false&&!applicable.some(c=>c.scope==='shipping')?['shipping']:[]),
  ...(category.kind==='kit'&&Object.entries(selected).some(([id,on])=>on&&!applicable.some(c=>c.scope==='kit'&&c.material_id===id))?['kit item']:[])
 ]:[];
 const requiresReview = category.kind==='rfq'||length>600||width>600||height>500||quantity>20000||Boolean(input.customerSuppliedMaterial)|| (category.kind==='laser'&&!input.cutPathMm)|| Boolean(input.customDie)||missingCostScopes.length>0;
 const warnings=[];
 if(category.kind==='rfq')warnings.push('Custom engineering requires an expert quotation.');
 if(category.kind==='laser'&&!input.cutPathMm)warnings.push('Laser route pricing requires verified path length and material safety review.');
 if(missingCostScopes.length)warnings.push('Admin cost configuration is incomplete for: '+missingCostScopes.join(', ')+'. The estimate is provisional until these rates are configured and reviewed.');
 if(requiresReview)warnings.push('A technical reviewer must confirm material fit, production method and final price.');
 if(componentModel)warnings.push('Calculated using the active Admin production cost components. Confirm the technical dieline and factory routing before accepting a firm order.');else warnings.push('Indicative estimate uses sample fallback factory rates because no active raw-material cost is configured for the selected material.');
 const breakdown=componentModel?[...componentLines,...(setup?[line('setup','Category setup charge',setup)]:[]),...(itemCost?[line('kit-items','Selected kit contents',itemCost*quantity)]:[])]:[line('materials','Material, print and contents',rawMaterial),line('spoilage','Production wastage allowance',scrap),line('setup','Prepress, tooling and setup',setup),line('assembly','Assembly and kitting',assembly),line('rush','Priority production',rush),line('shipping','Indicative freight & handling',shipping)];if(!componentModel&&processing)breakdown.push(line('processing','Production operations',processing));if(discountMinor)breakdown.push(line('discount','Volume discount',-discountMinor));
 const payload={categoryId:category.id,quantity,length,width,height,material,finish,printSides,designComplexity,destinationState,rush:Boolean(input.rush),shipping:input.shipping!==false,unitsPerCarton,destinationCount,kitItems:selected,designNotes:String(input.designNotes||'').slice(0,1000)};
 const designStudio=normalizeDesignStudio(input.designStudio);if(designStudio)payload.designStudio=designStudio;
 return {config:payload,categoryName:category.name,kind:category.kind,currency:'INR',quantity,breakdown,costMinor:costBase,netMinor:taxable,taxMinor,totalMinor:sum([taxable,taxMinor]),unitInclTaxMinor:Math.round((taxable+taxMinor)/quantity),taxes,marginBps:targetMarginBps,discountBps,discountMinor,chargeableKg,cartons,leadDays:category.days+(rush?-1:0),status:requiresReview?'technical_review':'indicative',confidence:requiresReview?'technical_review':'indicative',warnings,validUntil:new Date(Date.now()+7*86400000).toISOString()};
}
export const formatINR=minor=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(minor/100);
