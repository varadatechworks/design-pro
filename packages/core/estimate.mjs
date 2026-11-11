import {getCategory,MATERIALS,FINISHES,KIT_ITEMS} from './catalog.mjs';
const integer=(v,min,max,label)=>{const x=typeof v==='number'?v:Number(v);if(v===null||v===true||v===false||typeof v==='object'||v===''||!Number.isSafeInteger(x)||x<min||x>max)throw new Error(`${label} must be between ${min} and ${max}`);return x;};
const money=(value,bps)=>{if(!Number.isSafeInteger(value)||value<0||!Number.isSafeInteger(bps)||bps<0)throw new Error('Invalid money');const x=(BigInt(value)*BigInt(bps)+5000n)/10000n;if(x>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Cost overflow');return Number(x);};
const sum=xs=>xs.reduce((a,b)=>{const n=a+b;if(!Number.isSafeInteger(n))throw new Error('Cost overflow');return n;},0);

const DESIGN_FACES=['front','back','left','right','top','bottom'];
const DESIGN_SHAPES=['rectangular','cube','tall','flat','rounded','bottle','label-sheet','display','custom'];
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
 const fontSize=integer(value.fontSize??16,10,32,'Preview text size');
 const textAlign=value.textAlign??'center';
 if(!['left','center','right'].includes(textAlign))throw new Error('Invalid side text alignment');
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
 return {shape,faceColors,faceTexts,fontSize,textAlign,customShapeFileName,artworkFiles,aiConcept};
}

const line=(code,label,costMinor)=>({code,label,costMinor});
export function estimate(input,rateCard={}){
 if(!input||typeof input!=='object')throw new Error('Configuration is required');
 const category=getCategory(input.categoryId);if(!category)throw new Error('Unknown category');
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
 const baseUnit=integer(rateCard[category.id]?.baseUnitMinor??category.base,0,10000000,'Unit rate');
 const fixedSetup=integer(rateCard[category.id]?.setupMinor??category.setup,0,100000000,'Setup rate');
 const areaRatio=Math.max(0.3,Math.min(14,(length*width)/(240*180)));
 const geometryMultiplierBps=Math.round(areaRatio*10000);
 const unitMaterial=money(money(baseUnit,MATERIALS[material].factorBps),geometryMultiplierBps);
 const unitFinished=money(unitMaterial,FINISHES[finish].factorBps);
 const selected=input.kitItems??{};
 if(!selected||typeof selected!=='object'||Array.isArray(selected))throw new Error('Kit contents must be an object');
 for(const [id,enabled] of Object.entries(selected)){if(!Object.hasOwn(KIT_ITEMS,id)||typeof enabled!=='boolean')throw new Error('Invalid kit content selection');}
 const itemCost=category.kind==='kit'?Object.entries(selected).reduce((acc,[id,on])=>acc+(on?KIT_ITEMS[id].costMinor:0),0):0;
 const unitProcessing=Math.round(baseUnit*(printSides===2?0.16:0.08)*designComplexity);
 const unitBase=sum([unitFinished,unitProcessing,itemCost]);
 const rawMaterial=sum([money(unitFinished*quantity,10000),money(unitProcessing*quantity,10000),itemCost*quantity]);
 const scrap=money(rawMaterial,quantity>=500?300:700); // 3–7% illustrative spoilage
 const setup=sum([fixedSetup,money(fixedSetup,(designComplexity-1)*1500)]);
 const assembly=category.kind==='kit'?quantity*2200:category.kind==='box'?quantity*900:0;
 const rush=Boolean(input.rush)?money(sum([rawMaterial,scrap,setup,assembly]),2000):0;
 const destinationState=String(input.destinationState||'KA').toUpperCase();
 if(!/^[A-Z]{2}$/.test(destinationState))throw new Error('Invalid destination state code');
 const cartons=Math.ceil(quantity/unitsPerCarton);
 const perPieceKg=Math.max(0.05,(length*width*height)/5_000_000);
 const chargeableKg=Math.ceil(Math.max(perPieceKg*quantity, (length*width*height)/(5_000_000)*quantity)*100)/100;
 const destinationCount=integer(input.destinationCount??1,1,1000,'Destination count');
 if(destinationCount>quantity)throw new Error('Destination count cannot exceed order quantity');
 const shipping = input.shipping === false?0:sum([cartons*3500,Math.ceil(chargeableKg)*1800,(destinationCount-1)*9000]);
 const costBase=sum([rawMaterial,scrap,setup,assembly,rush,shipping]);
 const targetMarginBps=integer(rateCard.marginBps??2500,100,6500,'Margin (basis points)');
 const selling=Number((BigInt(costBase)*10000n+BigInt(10000-targetMarginBps-1))/BigInt(10000-targetMarginBps));
 if(!Number.isSafeInteger(selling))throw new Error('Amount overflow');
 const taxable=selling;
 const totalTax=money(taxable,integer(rateCard.gstBps??1800,0,2800,'GST basis points'));
 const gstBps=integer(rateCard.gstBps??1800,0,2800,'GST basis points');
 const stateHalf=Math.floor(gstBps/2);
 const taxes=destinationState==='KA'?[
  {component:'CGST',rateBps:stateHalf,amountMinor:money(taxable,stateHalf)},
  {component:'SGST',rateBps:gstBps-stateHalf,amountMinor:totalTax-money(taxable,stateHalf)}
 ]:[{component:'IGST',rateBps:gstBps,amountMinor:totalTax}];
 const taxMinor=sum(taxes.map(t=>t.amountMinor));
 const requiresReview = category.kind==='rfq'||length>600||width>600||height>500||quantity>20000||Boolean(input.customerSuppliedMaterial)|| (category.kind==='laser'&&!input.cutPathMm)|| Boolean(input.customDie);
 const warnings=[];
 if(category.kind==='rfq')warnings.push('Custom engineering requires an expert quotation.');
 if(category.kind==='laser'&&!input.cutPathMm)warnings.push('Laser route pricing requires verified path length and material safety review.');
 if(requiresReview)warnings.push('A technical reviewer must confirm material fit, production method and final price.');
 warnings.push('Indicative estimate using sample factory rates. Preview is not a production proof.');
 const breakdown=[line('materials','Material, print and contents',rawMaterial),line('spoilage','Production wastage allowance',scrap),line('setup','Prepress, tooling and setup',setup),line('assembly','Assembly and kitting',assembly),line('rush','Priority production',rush),line('shipping','Indicative freight & handling',shipping)];
 const payload={categoryId:category.id,quantity,length,width,height,material,finish,printSides,designComplexity,destinationState,rush:Boolean(input.rush),shipping:input.shipping!==false,unitsPerCarton,destinationCount,kitItems:selected,designNotes:String(input.designNotes||'').slice(0,1000)};
 const designStudio=normalizeDesignStudio(input.designStudio);if(designStudio)payload.designStudio=designStudio;
 return {config:payload,categoryName:category.name,kind:category.kind,currency:'INR',quantity,breakdown,costMinor:costBase,netMinor:taxable,taxMinor,totalMinor:sum([taxable,taxMinor]),unitInclTaxMinor:Math.round((taxable+taxMinor)/quantity),taxes,marginBps:targetMarginBps,chargeableKg,cartons,leadDays:category.days+(rush?-1:0),status:requiresReview?'technical_review':'indicative',confidence:requiresReview?'technical_review':'indicative',warnings,validUntil:new Date(Date.now()+7*86400000).toISOString()};
}
export const formatINR=minor=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(minor/100);
