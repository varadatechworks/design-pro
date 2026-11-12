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
 assert page.locator('.delivery-options').evaluate("(el)=>el.closest('.estimate-panel')!==null")
 assert page.locator('#stateSelect').evaluate("(el)=>el.closest('.studio-controls')===null")
 assert page.locator('#shapePreset').evaluate("(el)=>el.closest('.studio-controls')!==null")
 assert page.locator('#faceSelector').evaluate("(el)=>el.closest('.studio-center')!==null")
 assert page.locator('#faceSelector [role=tab]').count()==6
 assert page.locator('#view360Toggle').count()==1
 assert page.locator('#rotationSlider').count()==1
 assert page.locator('#rotationValue').inner_text()=='331°'
 page.locator('#stateSelect').select_option('KA')
 page.locator('#destinationCountInput').fill('2')
 page.locator('#shipInput').uncheck()
 delivery_payload=page.evaluate("()=>JSON.parse([...window.__requests].filter(x=>x.path.endsWith('/estimate')).at(-1).body)")
 assert delivery_payload['destinationState']=='KA'
 assert delivery_payload['destinationCount']==2
 assert delivery_payload['shipping'] is False
 page.locator('#faceTab-front').focus()
 page.keyboard.press('End')
 assert page.locator('#faceTab-bottom').get_attribute('aria-selected')=='true'
 page.keyboard.press('Home')
 assert page.locator('#faceTab-front').get_attribute('aria-selected')=='true'
 page.locator('#productSelect').select_option('corporate-gift')
 assert page.locator('.product-cube').get_attribute('data-shape')=='bottle'
 page.locator('#productSelect').select_option('labels')
 assert page.locator('.product-cube').get_attribute('data-shape')=='label-sheet'
 page.locator('#productSelect').select_option('display')
 assert page.locator('.product-cube').get_attribute('data-shape')=='display'
 page.locator('#productSelect').select_option('welcome-kit')
 assert page.locator('.product-cube').get_attribute('data-shape')=='rectangular'
 page.locator('#faceTab-back').click()
 page.locator('#faceColorInput').fill('#234567')
 assert page.locator('.product-cube').evaluate("(el)=>el.style.getPropertyValue('--face-back')")=='#234567'
 page.locator('#faceTextInput').fill('Made for you')
 page.locator('#faceFontFamily').select_option('sans')
 page.locator('#faceFontStyle').select_option('italic')
 page.locator('#faceFontWeight').select_option('800')
 page.locator('#faceFontColor').fill('#ffffff')
 page.locator('#faceFontSize').fill('24')
 page.locator('#faceTextAlign').select_option('right')
 assert page.locator('.face.back .face-custom-text').inner_text()=='Made for you'
 assert page.locator('.face.back .face-custom-text').evaluate("(el)=>el.style.fontStyle")=='italic'
 assert page.locator('.face.back .face-custom-text').evaluate("(el)=>el.style.fontWeight")=='800'
 assert page.locator('.face.back .face-custom-text').evaluate("(el)=>el.style.color")=='rgb(255, 255, 255)'
 page.locator('#productCube').evaluate("el=>el.style.transform='rotateX(0deg) rotateY(180deg)'")
 text_frame=page.locator('.face.back .face-text-frame')
 assert text_frame.count()==1,'Side text should be rendered as a selectable canvas object'
 text_frame.scroll_into_view_if_needed()
 text_before=text_frame.evaluate("(el)=>el.style.left")
 text_bounds=text_frame.bounding_box()
 page.mouse.move(text_bounds['x']+text_bounds['width']/2,text_bounds['y']+text_bounds['height']/2)
 page.mouse.down()
 page.mouse.move(text_bounds['x']+text_bounds['width']/2+16,text_bounds['y']+text_bounds['height']/2+10,steps=3)
 page.mouse.up()
 text_after=text_frame.evaluate("(el)=>el.style.left")
 assert text_before!=text_after,'Text object should be draggable on the selected product side'
 text_handle=text_frame.locator('.face-text-resize')
 text_handle_bounds=text_handle.bounding_box()
 text_width_before=text_frame.evaluate("(el)=>el.style.width")
 page.mouse.move(text_handle_bounds['x']+text_handle_bounds['width']/2,text_handle_bounds['y']+text_handle_bounds['height']/2)
 page.mouse.down()
 page.mouse.move(text_handle_bounds['x']+text_handle_bounds['width']/2+12,text_handle_bounds['y']+text_handle_bounds['height']/2+8,steps=3)
 page.mouse.up()
 text_width_after=text_frame.evaluate("(el)=>el.style.width")
 assert text_width_before!=text_width_after,'Text resize handle should change the text box size'
 text_font_after=text_frame.locator('.face-custom-text').evaluate("(el)=>el.style.fontSize")
 assert text_font_after!='24px','Text resize handle should scale the font size as well'
 page.locator('#faceTab-front').click()
 assert page.locator('.face.front .face-text-frame').count()==0,'Text must remain isolated to its own side'
 page.locator('#faceTab-back').click()
 assert page.locator('.face.back .face-text-frame').count()==1,'Text position should persist when switching sides'
 page.locator('#faceTab-front').click()
 page.locator('#faceTab-back').click()
 assert page.locator('#faceFontFamily').input_value()=='sans'
 assert page.locator('#faceFontSize').input_value()=='24'
 page.locator('#shapePreset').select_option('cube')
 assert page.locator('.product-cube').get_attribute('data-shape')=='cube'
 page.locator('#rotationSlider').fill('120')
 assert page.locator('#rotationValue').inner_text()=='120°'
 page.locator('#view360Toggle').click()
 assert page.locator('#cubeScene').evaluate("(el)=>el.classList.contains('is-spinning')")
 assert page.locator('#view360Toggle').get_attribute('aria-pressed')=='true'
 page.locator('#view360Toggle').click()
 assert not page.locator('#cubeScene').evaluate("(el)=>el.classList.contains('is-spinning')")
 svg={"name":"outline.svg","mimeType":"image/svg+xml","buffer":b'<svg xmlns="http://www.w3.org/2000/svg" width="200mm" height="150mm" viewBox="0 0 200 150"><rect x="4" y="4" width="192" height="142" fill="none" stroke="#222"/><text x="10" y="20">Brand line</text></svg>'}
 page.locator('#customShapeUpload').set_input_files(svg)
 page.wait_for_timeout(50)
 assert not page.locator('#customShapeThumb').is_hidden()
 page.locator('.left-studio-details > summary').first.click()
 page.locator('#artworkUpload').set_input_files(svg)
 page.wait_for_timeout(60)
 assert '200 × 150 mm' in page.locator('#artworkImportStatus').inner_text()
 assert page.locator('.face.back .face-artwork-frame').count()==1
 page.locator('#faceTab-front').click()
 page.locator('#faceImageUpload').set_input_files(svg)
 page.wait_for_timeout(60)
 frame=page.locator('.face.front .face-artwork-frame')
 assert frame.count()==1
 assert frame.locator('img').get_attribute('draggable')=='false'
 assert frame.locator('img').evaluate("(el)=>getComputedStyle(el).pointerEvents")=='auto'
 # Return the model to a front-facing view so the overlay is not occluded by another 3D face.
 page.locator('#viewFront').click()
 frame.scroll_into_view_if_needed()
 page.wait_for_timeout(300)
 before=frame.evaluate("(el)=>el.style.left")
 bounds=frame.bounding_box()
 page.mouse.move(bounds['x']+bounds['width']/2,bounds['y']+bounds['height']/2)
 page.mouse.down()
 page.mouse.move(bounds['x']+bounds['width']/2+18,bounds['y']+bounds['height']/2+12,steps=3)
 page.mouse.up()
 after=frame.evaluate("(el)=>el.style.left")
 assert before!=after,'Artwork should be draggable on the selected product side'
 handle=frame.locator('.face-artwork-resize')
 handle_bounds=handle.bounding_box()
 width_before=frame.evaluate("(el)=>el.style.width")
 page.mouse.move(handle_bounds['x']+handle_bounds['width']/2,handle_bounds['y']+handle_bounds['height']/2)
 page.mouse.down()
 page.mouse.move(handle_bounds['x']+handle_bounds['width']/2+14,handle_bounds['y']+handle_bounds['height']/2+10,steps=3)
 page.mouse.up()
 width_after=frame.evaluate("(el)=>el.style.width")
 assert width_before!=width_after,'Artwork resize handle should change the image size'
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
