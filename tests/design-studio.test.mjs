import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {estimate} from '../packages/core/estimate.mjs';
import {openDb,migrate} from '../apps/api/db.mjs';
import {createServer} from '../apps/api/server.mjs';

const faces=['front','back','left','right','top','bottom'];
const baseDesign={
 shape:'rounded',
 faceColors:{front:'#123456',back:'#abcdef',left:'#373737',right:'#444444',top:'#555555',bottom:'#666666'},
 faceTexts:{front:'A welcome',back:'Thank you',left:'',right:'',top:'Open me',bottom:''},
 fontSize:18,textAlign:'left',
 customShapeFileName:'outline.svg',
 artworkFiles:{front:{fileName:'brand.svg',sizeBytes:2048,mimeType:'image/svg+xml'}},
 faceTypography:{back:{fontFamily:'sans',fontStyle:'italic',fontColor:'#ffffff',fontWeight:'800',fontSize:24,textAlign:'right'}},
 artworkPositions:{front:{left:12.5,top:18,width:44,height:55}},
 aiConcept:'Autumn welcome'
};

test('estimate validates and persists six-side design metadata without artwork bytes',()=>{
 const result=estimate({categoryId:'rigid-box',quantity:12,designStudio:baseDesign});
 assert.equal(result.config.designStudio.shape,'rounded');
 assert.equal(result.config.designStudio.faceColors.front,'#123456');
 assert.equal(result.config.designStudio.faceTexts.back,'Thank you');
 assert.equal(result.config.designStudio.artworkFiles.front.fileName,'brand.svg');
 assert.equal(result.config.designStudio.artworkFiles.front.sizeBytes,2048);
 assert.equal(result.config.designStudio.aiConcept,'Autumn welcome');
 assert.equal(Object.keys(result.config.designStudio.faceColors).length,6);
 assert.equal(result.config.designStudio.faceTypography.back.fontFamily,'sans');
 assert.equal(result.config.designStudio.faceTypography.back.fontColor,'#FFFFFF');
 assert.equal(result.config.designStudio.faceTypography.back.fontWeight,'800');
 assert.deepEqual(result.config.designStudio.artworkPositions.front,{left:12.5,top:18,width:44,height:55});
 assert.throws(()=>estimate({categoryId:'rigid-box',quantity:12,designStudio:{...baseDesign,faceTypography:{back:{fontFamily:'comic-sans'}}}}));
 assert.throws(()=>estimate({categoryId:'rigid-box',quantity:12,designStudio:{...baseDesign,artworkPositions:{front:{left:95,top:10,width:20,height:50}}}}));
 const bottle=estimate({categoryId:'corporate-gift',quantity:2,designStudio:{...baseDesign,shape:'bottle'}});
 assert.equal(bottle.config.designStudio.shape,'bottle');
 for(const invalid of [
  {...baseDesign,shape:'sphere'},
  {...baseDesign,faceColors:{...baseDesign.faceColors,front:'red'}},
  {...baseDesign,faceTexts:{...baseDesign.faceTexts,front:'x'.repeat(121)}},
  {...baseDesign,textAlign:'justify'},
  {...baseDesign,artworkFiles:{unknown:{fileName:'bad.svg',sizeBytes:1}}}
 ])assert.throws(()=>estimate({categoryId:'rigid-box',quantity:12,designStudio:invalid}));
});

async function withApiServer(fn){
 const db=migrate(openDb(':memory:')),server=createServer(db);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{return await fn(base);}finally{await new Promise(resolve=>server.close(resolve));db.close();}
}
async function post(base,body){
 const response=await fetch(base+'/api/v1/ai/design-concepts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 return {status:response.status,json:await response.json()};
}
function restoreEnv(saved){
 for(const [key,value] of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
}

test('AI design route is disabled by default and gives a clear setup response',async()=>{
 const saved={AI_PROVIDER:process.env.AI_PROVIDER,OLLAMA_BASE_URL:process.env.OLLAMA_BASE_URL,OLLAMA_MODEL:process.env.OLLAMA_MODEL};
 process.env.AI_PROVIDER='disabled';
 try{await withApiServer(async base=>{
  const result=await post(base,{brief:'A premium welcome box for a technology company with a modern, calm visual style.',categoryId:'welcome-kit'});
  assert.equal(result.status,503);
  assert.match(result.json.error,/AI is disabled|AI is not enabled/i);
 });}finally{restoreEnv(saved);}
});

test('local Ollama concept output is constrained to compatible design options',async()=>{
 const saved={AI_PROVIDER:process.env.AI_PROVIDER,OLLAMA_BASE_URL:process.env.OLLAMA_BASE_URL,OLLAMA_MODEL:process.env.OLLAMA_MODEL};
 let captured=null;
 const model=http.createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;
  captured=JSON.parse(raw);
  const concept={
   conceptName:'Midnight Welcome',
   direction:'A restrained navy and copper direction for a premium welcome box.',
   shape:'tall',
   palette:{front:'#102030',back:'#AABBCC',left:'#203040',right:'#304050',top:'#405060',bottom:'#506070'},
   sideText:{front:'Welcome aboard',back:'<script>thanks</script>',left:'',right:'',top:'Open for possibility',bottom:''},
   material:'metal',
   finish:'foil',
   questions:['Do you have an approved brand font?']
  };
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({response:JSON.stringify(concept)}));
 });
 await new Promise(resolve=>model.listen(0,'127.0.0.1',resolve));
 process.env.AI_PROVIDER='ollama';
 process.env.OLLAMA_BASE_URL='http://127.0.0.1:'+model.address().port;
 process.env.OLLAMA_MODEL='test-model';
 try{await withApiServer(async base=>{
  const result=await post(base,{brief:'A premium welcome box for a technology company, navy with copper details and minimal typography.',categoryId:'rigid-box',material:'greyboard',finish:'foil',dimensions:{length:240,width:180,height:80}});
  assert.equal(result.status,200,JSON.stringify(result.json));
  assert.equal(result.json.conceptName,'Midnight Welcome');
  assert.equal(result.json.shape,'tall');
  assert.equal(result.json.palette.front,'#102030');
  assert.equal(result.json.material,'greyboard');
  assert.equal(result.json.finish,'foil');
  assert.equal(result.json.sideText.back,'thanks');
  assert.equal(result.json.questions.length,1);
  assert.match(captured.prompt,/CUSTOMER BRIEF START/);
  assert.equal(captured.model,'test-model');
 });}finally{
  restoreEnv(saved);
  await new Promise(resolve=>model.close(resolve));
 }
});

test('AI route rejects remote Ollama hosts and short briefs',async()=>{
 const saved={AI_PROVIDER:process.env.AI_PROVIDER,OLLAMA_BASE_URL:process.env.OLLAMA_BASE_URL,OLLAMA_MODEL:process.env.OLLAMA_MODEL};
 process.env.AI_PROVIDER='ollama';process.env.OLLAMA_BASE_URL='http://example.com';process.env.OLLAMA_MODEL='test-model';
 try{await withApiServer(async base=>{
  const short=await post(base,{brief:'Too short',categoryId:'rigid-box'});
  assert.equal(short.status,400);
  const remote=await post(base,{brief:'A premium gift box with a calm and minimal design direction for a new brand.',categoryId:'rigid-box'});
  assert.equal(remote.status,503);
  assert.match(remote.json.error,/localhost|this computer/i);
 });}finally{restoreEnv(saved);}
});

test('design studio normalizes independent text layers and multilingual font choices',()=>{
 const result=estimate({categoryId:'rigid-box',quantity:12,designStudio:{
  ...baseDesign,
  shape:'hexagon-box',
  textLayers:{front:[
   {id:'headline',text:'ನಮಸ್ಕಾರ',position:{left:10,top:12,width:70,height:22},fontFamily:'kannada',fontStyle:'normal',fontWeight:'700',fontColor:'#FFFFFF',fontSize:24,textAlign:'center'},
   {id:'subline',text:'Welcome',position:{left:12,top:55,width:76,height:18},fontFamily:'custom',fontStyle:'italic',fontWeight:'400',fontColor:'#F4E6CF',fontSize:14,textAlign:'left'}
  ]}
 }});
 assert.equal(result.config.designStudio.shape,'hexagon-box');
 assert.equal(result.config.designStudio.textLayers.front.length,2);
 assert.equal(result.config.designStudio.textLayers.front[0].text,'ನಮಸ್ಕಾರ');
 assert.equal(result.config.designStudio.textLayers.front[0].fontFamily,'kannada');
 assert.equal(result.config.designStudio.textLayers.front[1].fontFamily,'custom');
 assert.throws(()=>estimate({categoryId:'rigid-box',quantity:12,designStudio:{...baseDesign,textLayers:{front:Array.from({length:9},(_,i)=>({id:'layer-'+i,text:'x'}))}}}));
 assert.throws(()=>estimate({categoryId:'rigid-box',quantity:12,designStudio:{...baseDesign,textLayers:{front:[{id:'bad id',text:'x'}]}}}));
});
