import {newId,now,audit,runAtomic} from './db.mjs';
import {CATEGORIES,MATERIALS,FINISHES,KIT_ITEMS} from '../../packages/core/catalog.mjs';
import {requireActor} from './auth.mjs';

const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));return true;};
const fail=(status,message)=>Object.assign(new Error(message),{status});
async function read(req,max=50000){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>max)throw fail(413,'Request is too large');chunks.push(c);}let x;try{x=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fail(400,'Send a valid JSON object');}if(!x||Array.isArray(x)||typeof x!=='object')throw fail(400,'Send a JSON object');return x;}
const text=(v,label,max=180,required=true)=>{if(typeof v!=='string'||(required&&!v.trim())||v.length>max)throw fail(400,label+' is required and must be at most '+max+' characters');return v.trim();};
const int=(v,label,min=0,max=100000000)=>{if(!Number.isSafeInteger(v)||v<min||v>max)throw fail(400,label+' must be an integer between '+min+' and '+max);return v;};
const slug=v=>text(v,'Slug',80).toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
const list=(v,allowed,label)=>{if(!Array.isArray(v)||!v.length||v.some(x=>typeof x!=='string'||!allowed.includes(x)))throw fail(400,'Choose valid '+label);return [...new Set(v)];};
const categoryRow=r=>({...r,base:r.base_minor,setup:r.setup_minor,days:r.lead_days,baseMinor:r.base_minor,setupMinor:r.setup_minor,leadDays:r.lead_days,materials:JSON.parse(r.materials),finishes:JSON.parse(r.finishes),active:!!r.active});
function seed(db){
 const n=now(),ins=db.prepare('INSERT OR IGNORE INTO catalog_categories (id,name,tag,icon,base_minor,setup_minor,lead_days,materials,finishes,kind,active,sort_order,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
 for(let i=0;i<CATEGORIES.length;i++){const c=CATEGORIES[i];ins.run(c.id,c.name,c.tag,c.icon,c.base,c.setup,c.days,JSON.stringify(c.materials),JSON.stringify(c.finishes),c.kind,1,i,n);}
 const page=db.prepare('INSERT OR IGNORE INTO site_content (content_key,value,updated_at) VALUES (?,?,?)');
 for(const [k,v] of Object.entries({heroEyebrow:'CRAFTED WITH INTENTION · MADE TO IMPRESS',heroTitle:'Beyond ordinary. Made for wonder.',heroDescription:'Custom packaging, premium gift boxes, corporate welcome kits and precision printing — designed by you, thoughtfully made by us.',footerDescription:'Thoughtful design. Exceptional craftsmanship. A little bit of magic in every box.',contactEmail:'',contactPhone:'',announcement:''}))page.run(k,v,n);
}
function rows(db,sql,...args){return db.prepare(sql).all(...args);}
export function migrateAdmin(db){
 db.exec(`
 CREATE TABLE IF NOT EXISTS catalog_categories(id TEXT PRIMARY KEY,name TEXT NOT NULL,tag TEXT NOT NULL DEFAULT '',icon TEXT NOT NULL DEFAULT 'box',base_minor INTEGER NOT NULL DEFAULT 0,setup_minor INTEGER NOT NULL DEFAULT 0,lead_days INTEGER NOT NULL DEFAULT 0,materials TEXT NOT NULL,finishes TEXT NOT NULL,kind TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS catalog_products(id TEXT PRIMARY KEY,category_id TEXT NOT NULL REFERENCES catalog_categories(id),name TEXT NOT NULL,slug TEXT NOT NULL UNIQUE,description TEXT NOT NULL DEFAULT '',sku TEXT NOT NULL DEFAULT '',image_url TEXT NOT NULL DEFAULT '',specifications TEXT NOT NULL DEFAULT '{}',active INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS pricing_rate_cards(id TEXT PRIMARY KEY,category_id TEXT NOT NULL REFERENCES catalog_categories(id),base_unit_minor INTEGER NOT NULL,setup_minor INTEGER NOT NULL,margin_bps INTEGER NOT NULL DEFAULT 2500,gst_bps INTEGER NOT NULL DEFAULT 1800,effective_from TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,updated_by TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(category_id,effective_from));
 CREATE TABLE IF NOT EXISTS cms_pages(id TEXT PRIMARY KEY,slug TEXT NOT NULL UNIQUE,title TEXT NOT NULL,body TEXT NOT NULL,meta_title TEXT NOT NULL DEFAULT '',meta_description TEXT NOT NULL DEFAULT '',published INTEGER NOT NULL DEFAULT 0,updated_by TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS site_content(content_key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS media_assets(id TEXT PRIMARY KEY,name TEXT NOT NULL,url TEXT NOT NULL,alt_text TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL,created_at TEXT NOT NULL,data_url TEXT,mime_type TEXT,size_bytes INTEGER NOT NULL DEFAULT 0);
 CREATE INDEX IF NOT EXISTS idx_products_category ON catalog_products(category_id,active,sort_order);
 CREATE INDEX IF NOT EXISTS idx_pages_published ON cms_pages(published,slug);
 `);
 // Additive compatibility for databases created by an earlier admin-console preview.
 const mediaCols=db.prepare('PRAGMA table_info(media_assets)').all().map(c=>c.name);
 if(!mediaCols.includes('data_url'))db.exec('ALTER TABLE media_assets ADD COLUMN data_url TEXT');
 if(!mediaCols.includes('mime_type'))db.exec('ALTER TABLE media_assets ADD COLUMN mime_type TEXT');
 if(!mediaCols.includes('size_bytes'))db.exec('ALTER TABLE media_assets ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0');
 const rateIndexes=db.prepare("PRAGMA index_list('pricing_rate_cards')").all().filter(x=>x.unique);
 for(const idx of rateIndexes){const cols=db.prepare('PRAGMA index_info('+JSON.stringify(idx.name)+')').all().map(c=>c.name);if(cols.length===1&&cols[0]==='category_id'){
  db.exec("ALTER TABLE pricing_rate_cards RENAME TO pricing_rate_cards_legacy; CREATE TABLE pricing_rate_cards(id TEXT PRIMARY KEY,category_id TEXT NOT NULL REFERENCES catalog_categories(id),base_unit_minor INTEGER NOT NULL,setup_minor INTEGER NOT NULL,margin_bps INTEGER NOT NULL DEFAULT 2500,gst_bps INTEGER NOT NULL DEFAULT 1800,effective_from TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,updated_by TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(category_id,effective_from)); INSERT INTO pricing_rate_cards SELECT * FROM pricing_rate_cards_legacy; DROP TABLE pricing_rate_cards_legacy;");
  break;
 }}
 seed(db);return db;
}
export function publicCatalog(db){
 const categories=rows(db,'SELECT * FROM catalog_categories WHERE active=1 ORDER BY sort_order,name').map(categoryRow);
 const products=rows(db,'SELECT p.id,p.category_id,p.name,p.slug,p.description,p.sku,p.image_url,p.specifications FROM catalog_products p JOIN catalog_categories c ON c.id=p.category_id WHERE p.active=1 AND c.active=1 ORDER BY p.sort_order,p.name').map(p=>({...p,specifications:JSON.parse(p.specifications)}));
 return {categories,products,materials:MATERIALS,finishes:FINISHES,kitItems:KIT_ITEMS};
}
export function getRateCard(db){const out={};for(const r of rows(db,'SELECT p.* FROM pricing_rate_cards p JOIN (SELECT category_id,MAX(effective_from) effective_from FROM pricing_rate_cards WHERE active=1 AND effective_from<=? GROUP BY category_id) latest ON latest.category_id=p.category_id AND latest.effective_from=p.effective_from',now()))out[r.category_id]={baseUnitMinor:r.base_unit_minor,setupMinor:r.setup_minor,marginBps:r.margin_bps,gstBps:r.gst_bps};return out;}
export async function handleAdminApi({db,req,res,pathname}){
 if(pathname==='/api/v1/site-content'&&req.method==='GET'){
  return send(res,200,{content:Object.fromEntries(rows(db,'SELECT content_key,value FROM site_content').map(x=>[x.content_key,x.value])),pages:rows(db,'SELECT slug,title,body,meta_title,meta_description FROM cms_pages WHERE published=1 ORDER BY title')});
 }
 if(pathname==='/api/v1/catalog/products'&&req.method==='GET')return send(res,200,{products:publicCatalog(db).products});
 const root='/api/v1/admin/management';
 if(!pathname.startsWith(root))return false;
 const actor=requireActor(db,req,'catalog','view',{csrf:req.method!=='GET'});
 const parts=pathname.slice(root.length).split('/').filter(Boolean),resource=parts[0]||'overview',id=parts[1];
 const grants={overview:'reports',categories:'catalog',products:'catalog',pages:'settings',content:'settings',rates:'pricing',media:'catalog',settings:'settings'};
 const permission=grants[resource];if(!permission)throw fail(404,'Management resource not found');
 const action=req.method==='GET'?'view':req.method==='POST'?'create':req.method==='DELETE'?'delete':'edit';
 const allowedActor=requireActor(db,req,permission,action,{csrf:req.method!=='GET'});
 if(['pages','content','settings','rates'].includes(resource)&&allowedActor.role!=='SUPER_ADMIN')throw fail(403,'Super Admin permission is required for this configuration');
 if(resource==='overview'&&req.method==='GET')return send(res,200,{counts:{categories:db.prepare('SELECT COUNT(*) n FROM catalog_categories WHERE active=1').get().n,products:db.prepare('SELECT COUNT(*) n FROM catalog_products WHERE active=1').get().n,pages:db.prepare('SELECT COUNT(*) n FROM cms_pages').get().n,media:db.prepare('SELECT COUNT(*) n FROM media_assets').get().n},recentAudit:rows(db,"SELECT event_type,entity_type,entity_id,at FROM audit_events WHERE entity_type IN ('category','product','cms_page','pricing','site_content','media') ORDER BY at DESC LIMIT 8")});
 if(resource==='categories'){
  if(req.method==='GET')return send(res,200,{categories:rows(db,'SELECT * FROM catalog_categories ORDER BY sort_order,name').map(categoryRow)});
  if(req.method==='POST'||req.method==='PUT'){
   const x=await read(req),key=id||slug(x.id||x.name);const name=text(x.name,'Category name',100),kind=text(x.kind,'Category type',20);if(!['box','kit','print','gift','uv','laser','rfq'].includes(kind))throw fail(400,'Invalid category type');
   const materials=list(x.materials,Object.keys(MATERIALS),'materials'),finishes=list(x.finishes,Object.keys(FINISHES),'finishes'),n=now();
   const data=[name,text(x.tag||'','Tagline',120,false),text(x.icon||'box','Icon',30),int(x.baseMinor,'Base rate'),int(x.setupMinor,'Setup rate'),int(x.leadDays,'Lead days',0,365),JSON.stringify(materials),JSON.stringify(finishes),kind,x.active===false?0:1,int(x.sortOrder??0,'Sort order',0,100000),n];
   if(req.method==='POST'){db.prepare('INSERT INTO catalog_categories(id,name,tag,icon,base_minor,setup_minor,lead_days,materials,finishes,kind,active,sort_order,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(key,...data);audit(db,actor.id,'catalog.category.created','category',key);}
   else{if(!db.prepare('SELECT id FROM catalog_categories WHERE id=?').get(key))throw fail(404,'Category not found');db.prepare('UPDATE catalog_categories SET name=?,tag=?,icon=?,base_minor=?,setup_minor=?,lead_days=?,materials=?,finishes=?,kind=?,active=?,sort_order=?,updated_at=? WHERE id=?').run(...data,key);audit(db,actor.id,'catalog.category.updated','category',key);}
   return send(res,req.method==='POST'?201:200,{id:key});
  }
  if(req.method==='DELETE'){if(!id)throw fail(400,'Category ID required');if(db.prepare('SELECT id FROM catalog_products WHERE category_id=? LIMIT 1').get(id))throw fail(409,'Move or delete products in this category first');db.prepare('UPDATE catalog_categories SET active=0,updated_at=? WHERE id=?').run(now(),id);audit(db,actor.id,'catalog.category.archived','category',id);return send(res,200,{id,archived:true});}
 }
 if(resource==='products'){
  if(req.method==='GET')return send(res,200,{products:rows(db,'SELECT * FROM catalog_products ORDER BY sort_order,name').map(p=>({...p,specifications:JSON.parse(p.specifications)}))});
  if(req.method==='POST'||req.method==='PUT'){
   const x=await read(req),key=id||newId('prd'),category=text(x.categoryId,'Category',80);if(!db.prepare('SELECT id FROM catalog_categories WHERE id=? AND active=1').get(category))throw fail(400,'Choose an active category');
   const data=[category,text(x.name,'Product name',120),slug(x.slug||x.name),text(x.description||'','Description',3000,false),text(x.sku||'','SKU',80,false),text(x.imageUrl||'','Image URL',1000,false),JSON.stringify(x.specifications&&typeof x.specifications==='object'&&!Array.isArray(x.specifications)?x.specifications:{}),x.active===false?0:1,int(x.sortOrder??0,'Sort order',0,100000),now()];
   if(data[5]&&!/^https:\/\//i.test(data[5])&&!/^\/api\/v1\/media\/[a-zA-Z0-9_-]+$/.test(data[5]))throw fail(400,'Product image must be HTTPS or a DesignPro media asset');
   if(req.method==='POST')db.prepare('INSERT INTO catalog_products(id,category_id,name,slug,description,sku,image_url,specifications,active,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(key,...data.slice(0,9),data[9],data[9]);
   else{if(!db.prepare('SELECT id FROM catalog_products WHERE id=?').get(key))throw fail(404,'Product not found');db.prepare('UPDATE catalog_products SET category_id=?,name=?,slug=?,description=?,sku=?,image_url=?,specifications=?,active=?,sort_order=?,updated_at=? WHERE id=?').run(...data,key);}
   audit(db,actor.id,'catalog.product.'+(req.method==='POST'?'created':'updated'),'product',key);return send(res,req.method==='POST'?201:200,{id:key});
  }
  if(req.method==='DELETE'){if(!id)throw fail(400,'Product ID required');db.prepare('UPDATE catalog_products SET active=0,updated_at=? WHERE id=?').run(now(),id);audit(db,actor.id,'catalog.product.archived','product',id);return send(res,200,{id,archived:true});}
 }
 if(resource==='rates'){
  if(req.method==='GET')return send(res,200,{rates:rows(db,'SELECT * FROM pricing_rate_cards ORDER BY category_id')});
  if(req.method==='POST'||req.method==='PUT'){
   const x=await read(req),category=text(x.categoryId,'Category',80);if(!db.prepare('SELECT id FROM catalog_categories WHERE id=? AND active=1').get(category))throw fail(400,'Choose an active category');
   const base=int(x.baseUnitMinor,'Unit rate',0,10000000),setup=int(x.setupMinor,'Setup rate',0,100000000),margin=int(x.marginBps,'Margin',100,6500),gst=int(x.gstBps,'GST',0,2800),effective=text(x.effectiveFrom||now().slice(0,10),'Effective date',40);if(effective.length!==10||effective[4]!=='-'||effective[7]!=='-'||Number.isNaN(Date.parse(effective)))throw fail(400,'Effective date must use YYYY-MM-DD');
   const existing=db.prepare('SELECT id FROM pricing_rate_cards WHERE category_id=? AND effective_from=?').get(category,effective),key=existing?.id||newId('rate');
   if(existing)db.prepare('UPDATE pricing_rate_cards SET base_unit_minor=?,setup_minor=?,margin_bps=?,gst_bps=?,active=1,updated_by=?,updated_at=? WHERE id=?').run(base,setup,margin,gst,actor.id,now(),key);
   else db.prepare('INSERT INTO pricing_rate_cards(id,category_id,base_unit_minor,setup_minor,margin_bps,gst_bps,effective_from,active,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(key,category,base,setup,margin,gst,effective,1,actor.id,now());
   audit(db,actor.id,'pricing.rate_card.updated','pricing',category,{baseUnitMinor:base,setupMinor:setup,marginBps:margin,gstBps:gst,effectiveFrom:effective});return send(res,200,{id:key});
  }
 }
 if(resource==='content'){
  if(req.method==='GET')return send(res,200,{content:Object.fromEntries(rows(db,'SELECT content_key,value FROM site_content').map(x=>[x.content_key,x.value]))});
  if(req.method==='PUT'){const x=await read(req),entries=x.content;if(!entries||typeof entries!=='object'||Array.isArray(entries))throw fail(400,'Content object required');const allowed=['heroEyebrow','heroTitle','heroDescription','footerDescription','contactEmail','contactPhone','announcement'];runAtomic(db,()=>{for(const key of allowed)if(key in entries){const value=text(String(entries[key]),key,1200,false);db.prepare('INSERT INTO site_content(content_key,value,updated_at) VALUES (?,?,?) ON CONFLICT(content_key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').run(key,value,now());}audit(db,actor.id,'site.content.updated','site_content','homepage',{keys:Object.keys(entries).filter(k=>allowed.includes(k))});});return send(res,200,{saved:true});}
 }
 if(resource==='pages'){
  if(req.method==='GET')return send(res,200,{pages:rows(db,'SELECT * FROM cms_pages ORDER BY updated_at DESC')});
  if(req.method==='POST'||req.method==='PUT'){const x=await read(req),key=id||newId('page'),s=slug(x.slug),title=text(x.title,'Page title',140),body=text(x.body,'Page content',15000),metaTitle=text(x.metaTitle||title,'SEO title',160,false),meta=text(x.metaDescription||'','SEO description',320,false),published=x.published===true?1:0;
   if(req.method==='POST')db.prepare('INSERT INTO cms_pages(id,slug,title,body,meta_title,meta_description,published,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(key,s,title,body,metaTitle,meta,published,actor.id,now());
   else{if(!db.prepare('SELECT id FROM cms_pages WHERE id=?').get(key))throw fail(404,'Page not found');db.prepare('UPDATE cms_pages SET slug=?,title=?,body=?,meta_title=?,meta_description=?,published=?,updated_by=?,updated_at=? WHERE id=?').run(s,title,body,metaTitle,meta,published,actor.id,now(),key);}
   audit(db,actor.id,'cms.page.saved','cms_page',key,{slug:s,published:!!published});return send(res,req.method==='POST'?201:200,{id:key});
  }
  if(req.method==='DELETE'){db.prepare('DELETE FROM cms_pages WHERE id=?').run(id);audit(db,actor.id,'cms.page.deleted','cms_page',id);return send(res,200,{id});}
 }
 if(resource==='media'){
  if(req.method==='GET')return send(res,200,{assets:rows(db,'SELECT id,name,url,alt_text,created_by,created_at,mime_type,size_bytes FROM media_assets ORDER BY created_at DESC')});
  if(req.method==='POST'){const x=await read(req,3000000),name=text(x.name,'Asset name',120),alt=text(x.altText||'','Alt text',240,false);let url=text(x.url||'','Media URL',1000,false),dataUrl=null,mime=null,size=0;
   if(x.dataUrl){const m=String(x.dataUrl).match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);if(!m)throw fail(400,'Upload a PNG, JPEG or WebP image');mime=m[1];const bin=Buffer.from(m[2],'base64'),valid=mime==='image/png'?bin.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mime==='image/jpeg'?bin[0]===255&&bin[1]===216&&bin[2]===255:bin.length>=12&&bin.toString('ascii',0,4)==='RIFF'&&bin.toString('ascii',8,12)==='WEBP';if(!bin.length||bin.length>2*1024*1024||bin.toString('base64')!==m[2]||!valid)throw fail(400,'Image content does not match PNG, JPEG or WebP format (max 2 MB)');dataUrl=x.dataUrl;size=bin.length;}
   else if(!/^https:\/\//i.test(url))throw fail(400,'Provide an HTTPS image URL or upload an image');
   const key=newId('med');if(dataUrl)url='/api/v1/media/'+key;db.prepare('INSERT INTO media_assets(id,name,url,alt_text,created_by,created_at,data_url,mime_type,size_bytes) VALUES (?,?,?,?,?,?,?,?,?)').run(key,name,url,alt,actor.id,now(),dataUrl,mime,size);audit(db,actor.id,'media.asset.created','media',key,{sizeBytes:size,mimeType:mime});return send(res,201,{id:key,url});}
  if(req.method==='DELETE'){db.prepare('DELETE FROM media_assets WHERE id=?').run(id);audit(db,actor.id,'media.asset.deleted','media',id);return send(res,200,{id});}
 }
 if(resource==='settings'){
  if(req.method==='GET')return send(res,200,{settings:Object.fromEntries(rows(db,'SELECT key,value FROM settings'))});
  if(req.method==='PUT'){const x=await read(req);const values=x.settings;if(!values||typeof values!=='object'||Array.isArray(values))throw fail(400,'Settings object required');const allowed=['business_name','business_email','business_phone','business_address','gstin','currency','default_lead_days','shipping_note','terms_url'];runAtomic(db,()=>{for(const k of allowed)if(k in values){const v=text(String(values[k]),k,1000,false);db.prepare('INSERT INTO settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').run(k,v,now());}audit(db,actor.id,'business.settings.updated','settings','business',{keys:Object.keys(values).filter(k=>allowed.includes(k))});});return send(res,200,{saved:true});}
 }
 return send(res,405,{error:'Method not allowed'});
}
