"""Optional visual smoke test. Run `python tests/visual-smoke.py` if Playwright and Chromium are installed.
Runs a deterministic mocked UI without real external API/payment credentials.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re,os,shutil

ROOT=Path(__file__).resolve().parents[1]
HTML=re.sub(r'<script[^>]*src="/app.js"[^>]*></script>','',(ROOT/'apps/web/index.html').read_text())
HTML=re.sub(r'<link[^>]*rel="(?:stylesheet|icon)"[^>]*>','',HTML)
CSS=(ROOT/'apps/web/styles.css').read_text()+'\n'+(ROOT/'apps/web/ux.css').read_text()
SCRIPT=(ROOT/'apps/web/app.js').read_text()
CATALOG={'categories':[], 'materials':{},'finishes':{},'kitItems':{}}

BASE_MOCK={
 '/api/v1/health':{'status':'ok','paymentsEnabled':False,'uatDemoEnabled':True},
 '/api/v1/auth/csrf':{'csrf':'mockcsrf'},
 '/api/v1/admin/dashboard':{'counts':{'users':129,'quotes':48,'orders':35,'proofs':13,'refunds':2,'shipments':25},'orderStatuses':[{'status':'pending_proof','count':8},{'status':'in_production','count':14},{'status':'shipped','count':13}]},
 '/api/v1/refunds':{'refunds':[]},
 '/api/v1/admin/inventory':{'inventory':[]},
 '/api/v1/admin/work-orders':{'workOrders':[]},
 '/api/v1/admin/quality-inspections':{'inspections':[]},
 '/api/v1/tickets':{'tickets':[{'id':'tkt_UAT_0001','order_id':'ord_UAT_SAMPLE_00001','subject':'Artwork correction required','category':'artwork','status':'open','updated_at':'2026-11-09T12:00:00.000Z'}]},
 '/api/v1/tickets/tkt_UAT_0001':{'ticket':{'id':'tkt_UAT_0001','order_id':'ord_UAT_SAMPLE_00001','subject':'Artwork correction required','category':'artwork','status':'open'},'messages':[{'author_id':'u1','message':'Please update the logo before release','created_at':'2026-11-09T12:00:00.000Z'}]},
 '/api/v1/admin/audit':{'events':[]},
 '/api/v1/admin/users':{'users':[]},
 '/api/v1/admin/roles':{'defaultRoles':{},'customRoles':[]},
 '/api/v1/quotes':{'quotes':[{'id':'qte_UAT_SAMPLE_00001','status':'firm','estimate':{'categoryName':'Corporate Welcome Kits','totalMinor':160000},'configuration':{'quantity':20},'firm_total_minor':160000}]},
 '/api/v1/orders':{'orders':[{'id':'ord_UAT_SAMPLE_00001','quote_id':'qte_UAT_SAMPLE_00001','total_minor':160000,'status':'pending_payment','address':'42 Main Road, Bengaluru, Karnataka 560040'},{'id':'ord_UAT_SAMPLE_00002','quote_id':'qte_UAT_SAMPLE_00002','total_minor':150000,'status':'ready_to_ship','address':'42 Main Road, Bengaluru'}]},
 '/api/v1/orders/ord_UAT_SAMPLE_00001':{'order':{'id':'ord_UAT_SAMPLE_00001','quote_id':'qte_UAT_SAMPLE_00001','total_minor':160000,'status':'pending_payment','address':'42 Main Road, Bengaluru, Karnataka 560040'},'proofs':[],'payments':[],'shipments':[],'destinations':[{'id':'dst_first','recipient':'Customer','address':'42 Main Road, Bengaluru, Karnataka 560040','quantity':20}],'qualityChecks':[]},
 '/api/v1/orders/ord_UAT_SAMPLE_00002':{'order':{'id':'ord_UAT_SAMPLE_00002','quote_id':'qte_UAT_SAMPLE_00002','total_minor':150000,'status':'ready_to_ship','address':'42 Main Road, Bengaluru'},'proofs':[],'payments':[],'shipments':[],'destinations':[{'id':'dst_second','recipient':'Customer','address':'42 Main Road, Bengaluru, Karnataka 560040','quantity':20}],'qualityChecks':[]}
}

MOCK_SCRIPT=r'''window.__requests=[];
window.fetch=async(u,opts={})=>{const path=String(u),method=opts.method||'GET';window.__requests.push({path,method,body:opts.body||null});
 if(path.endsWith('/estimate'))return {ok:true,status:200,json:async()=>({quantity:20,totalMinor:160000,unitInclTaxMinor:8000,netMinor:130000,costMinor:110000,taxMinor:30000,status:'indicative',breakdown:[{label:'Production',costMinor:110000}],warnings:['Illustrative pricing, not a firm quote.'],leadDays:7})};
 if(method!=='GET')return {ok:true,status:200,json:async()=>({message:'UAT request accepted',id:'mock_action'})};
 const data=window.__mock[path];const success=!!data&&!data.error;
 return {ok:success,status:success?200:401,json:async()=>data||{error:'Not signed in'}};
};'''

def page_setup(browser,viewport,role):
 page=browser.new_page(viewport=viewport,device_scale_factor=1)
 errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.set_content(HTML)
 page.add_style_tag(content=CSS)
 mock={**BASE_MOCK,'/api/v1/catalog':CATALOG,'/api/v1/auth/me':{'user':{'id':'u1','role':role,'displayName':'Aarav Patel','email':'qa@example.test'}}}
 page.evaluate('(x)=>window.__mock=x',mock)
 page.add_script_tag(content=MOCK_SCRIPT)
 page.add_script_tag(content=SCRIPT)
 page.wait_for_timeout(230)
 assert not errors,errors
 assert page.locator('#designStudioControls').count()==1
 page.locator('[data-face="back"]').click()
 page.locator('#faceColorInput').fill('#234567')
 assert page.locator('.product-cube').evaluate("(el)=>el.style.getPropertyValue('--face-back')")=='#234567'
 page.locator('#faceTextInput').fill('Made for you')
 assert page.locator('.face.back .face-custom-text').inner_text()=='Made for you'
 page.locator('#shapePreset').select_option('cube')
 assert page.locator('.product-cube').get_attribute('data-shape')=='cube'
 page.locator('#view360Toggle').click()
 assert page.locator('#cubeScene').evaluate("(el)=>el.classList.contains('is-spinning')")
 page.locator('#view360Toggle').click()
 svg={"name":"outline.svg","mimeType":"image/svg+xml","buffer":b'<svg xmlns="http://www.w3.org/2000/svg" width="200mm" height="150mm" viewBox="0 0 200 150"><rect x="4" y="4" width="192" height="142" fill="none" stroke="#222"/><text x="10" y="20">Brand line</text></svg>'}
 page.locator('#customShapeUpload').set_input_files(svg)
 page.wait_for_timeout(50)
 assert not page.locator('#customShapeThumb').is_hidden()
 page.locator('#artworkUpload').set_input_files(svg)
 page.wait_for_timeout(60)
 assert '200 × 150 mm' in page.locator('#artworkImportStatus').inner_text()
 assert page.locator('.face.back .face-artwork').count()==1
 assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'),'Unexpected horizontal overflow after design studio interaction'
 return page,errors

def run():
 global CATALOG
 # Stable catalog snapshot from the app catalog module.
 import subprocess
 script="import {CATEGORIES,MATERIALS,FINISHES,KIT_ITEMS} from './packages/core/catalog.mjs';console.log(JSON.stringify({categories:CATEGORIES,materials:MATERIALS,finishes:FINISHES,kitItems:KIT_ITEMS}))"
 CATALOG=json.loads(subprocess.check_output(['node','--input-type=module','-e',script],cwd=ROOT,text=True))
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser') or p.chromium.executable_path,headless=True,args=['--no-sandbox'])
  for width in (375,768,1440):
   pg,errors=page_setup(browser,{'width':width,'height':900},'SUPER_ADMIN')
   assert pg.locator('.portal-sidebar').count()==1
   assert pg.locator('.mini-stat').count()>=4
   pg.locator('[data-tab="shipping"]').click()
   pg.wait_for_timeout(40)
   assert pg.locator('#shipmentForm select[name=orderId] option').count()==1
   assert pg.locator('#shipmentDestinationSelect option').count()==1
   pg.locator('[data-tab="orders"]').click()
   pg.locator('[data-detail="ord_UAT_SAMPLE_00001"]').click()
   pg.wait_for_timeout(40)
   assert pg.locator('.detail-panel').count()==1
   pg.locator('[data-demo-capture="ord_UAT_SAMPLE_00001"]').click()
   assert pg.locator('#actionDialog').evaluate('(el)=>el.open')
   pg.locator('#actionDialogCancel').click()
   assert not pg.locator('#actionDialog').evaluate('(el)=>el.open')
   pg.locator('[data-tab="tickets"]').click()
   assert pg.locator('[data-ticket-detail="tkt_UAT_0001"]').count()==1
   pg.locator('[data-ticket-detail="tkt_UAT_0001"]').click()
   assert pg.locator('#ticketDetails .detail-panel').count()==1
   pg.evaluate("showAuth('login')")
   assert pg.locator('#authModal').is_visible()
   pg.keyboard.press('Escape')
   assert not pg.locator('#authModal').is_visible()
   pg.evaluate("notify('Status feedback test')")
   assert pg.locator('#toast').is_visible()
   pg.locator('.toast-dismiss').click()
   assert not pg.locator('#toast').is_visible()
   assert not errors,errors
   pg.close()
  customer,errors=page_setup(browser,{'width':390,'height':844},'CUSTOMER')
  customer.locator('[data-accept="qte_UAT_SAMPLE_00001"]').click()
  assert customer.locator('#actionDialog').evaluate('(el)=>el.open')
  customer.locator('#actionDialogConfirm').click()
  customer.wait_for_timeout(40)
  assert any(x['path'].endswith('/accept') for x in customer.evaluate('window.__requests'))
  assert not errors,errors
  customer.close()
  browser.close()
 print('VISUAL SMOKE PASS: 375px, 390px, 768px and 1440px; admin navigation, eligible shipment, order detail, UAT dialog and customer quote acceptance.')

if __name__=='__main__':run()
