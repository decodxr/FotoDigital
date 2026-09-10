import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {resolve} from 'node:path';
import {PDFDocument} from 'pdf-lib';
for (const adapter of ['platform', 'platform-postgres']) test('Commerce API (' + adapter + '): identity, originals, PDF pages, checkout, ZIP and concurrency',async()=>{
 let databaseAdapter;
 const loader=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:'custom',resolve:{alias:[{find:'@/lib/server/platform',replacement:resolve('tests/' + adapter + '.ts')},{find:'@',replacement:process.cwd()}]}});
 try{
 const {handleApi}=await loader.ssrLoadModule('/lib/server/api.ts');const {shippingItems}=await loader.ssrLoadModule('/lib/server/cart.ts');const platform=await loader.ssrLoadModule('/tests/' + adapter + '.ts');
 databaseAdapter = platform;
 const base='https://fotodigital.test';
 function client(){let cookie='';return {async call(path,method='GET',body,extra={}){const headers={origin:base,cookie,...extra};if(body&&!(body instanceof Uint8Array)){headers['content-type']='application/json';body=JSON.stringify(body);}const req=new Request(base+'/api/'+path,{method,headers,body,duplex:'half'});const r=await handleApi(req,path.split('/'));const set=r.headers.getSetCookie();for(const c of set){const item=c.split(';')[0],name=item.split('=')[0];cookie=cookie.split('; ').filter(x=>x&&!x.startsWith(name+'=')).concat(item).join('; ');}return r;}};}
 const a=client(),b=client(),admin=client();
 let r=await a.call('catalog');assert.equal(r.status,200);const initial=await r.json();assert.equal(initial.products.every(p=>p.price===null),true);assert.equal(initial.testimonials.length,0);
 for(const [c,email] of [[a,'a@test.example'],[b,'b@test.example'],[admin,'admin@test.example']]){await c.call('session');r=await c.call('auth/register','POST',{name:'Pessoa de teste',email,password:'test-only-password-123'});assert.equal(r.status,200,await r.text());}
 assert.equal((await a.call('admin/dashboard')).status,403);
 assert.equal((await admin.call('admin/bootstrap','POST',{token:'test-only-bootstrap-code-1234567890'})).status,200);
 assert.equal((await b.call('admin/bootstrap','POST',{token:'test-only-bootstrap-code-1234567890'})).status,409);
 assert.equal((await admin.call('admin/printSizes/10x15','PATCH',{name:'10 × 15 cm',width:10,height:15,price:500,active:1,finishes:['Fosco'],tiers:[{quantity:10,price:400}]})).status,200);
 const original=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2l0AAAAASUVORK5CYII=','base64'));
 async function upload(c,bytes,mime,name){const init=await c.call('uploads','POST',{name,mime,bytes:bytes.length,width:6000,height:4000,consent:true});assert.equal(init.status,200,await init.clone().text());const {id}=await init.json();const done=await c.call('uploads/'+id,'PUT',bytes,{'content-length':String(bytes.length)});assert.equal(done.status,200,await done.clone().text());return await done.json();}

 // Storefront photographs are editable and separately authorized from customer originals.
 assert.equal(initial.banners.length,5);
 assert.equal(initial.banners.every((slide,i)=>slide.sortOrder===i+1&&slide.illustrative===1),true);
 assert.equal((await a.call('admin/media','POST',original)).status,403);
 assert.equal((await admin.call('admin/media','POST',new TextEncoder().encode('<svg onload="alert(1)"></svg>'))).status,415);
 const mediaResponse=await admin.call('admin/media','POST',original);assert.equal(mediaResponse.status,201);const media=await mediaResponse.json();
 assert.equal((await a.call('store-media/'+media.id)).status,403);
 assert.equal((await admin.call('store-media/'+media.id)).status,200);
 const banner={title:'Foto autorizada da loja',subtitle:'Descrição editável da vitrine.',image:media.url,link:'/revelacao',active:1,illustrative:0,sortOrder:0};
 r=await admin.call('admin/banners','POST',banner);assert.equal(r.status,200,await r.clone().text());const savedBanner=await r.json();
 r=await a.call('catalog');const withBanner=await r.json();assert.equal(withBanner.banners[0].id,savedBanner.id);assert.equal(withBanner.banners[0].subtitle,banner.subtitle);
 r=await b.call('store-media/'+media.id);assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/^public/);assert.deepEqual(new Uint8Array(await r.arrayBuffer()),original);
 assert.equal((await admin.call('admin/banners/'+savedBanner.id,'PATCH',{...banner,link:'/\\attacker.example'})).status,422);
 assert.equal((await admin.call('admin/banners/'+savedBanner.id,'DELETE')).status,200);
 assert.equal((await b.call('store-media/'+media.id)).status,403);
 assert.equal((await (await a.call('catalog')).json()).banners.some(x=>x.id===savedBanner.id),false);
 const photo=await upload(a,original,'image/png','família original.png');
 r=await a.call('files/'+photo.id);assert.deepEqual(new Uint8Array(await r.arrayBuffer()),original);assert.equal((await b.call('files/'+photo.id)).status,403);
 assert.equal((await b.call('store-media/'+photo.id)).status,404);
 const item={productId:'fotos-tradicionais',quantity:1,fields:{},photos:[{photoId:photo.id,sizeId:'10x15',quantity:10,finish:'Fosco',crop:{x:50,y:50,zoom:1,rotation:0,fit:'cover'},qualityAccepted:true}]};
 r=await a.call('cart','POST',item);assert.equal(r.status,200,await r.clone().text());const photoCart=await r.json();assert.equal(photoCart.subtotal,4000);assert.equal(shippingItems(photoCart.items)[0].quantity,10);assert.equal(shippingItems([{...photoCart.items[0],quantity:2}])[0].quantity,20);
 const checkout={customer:{name:'Pessoa de teste',email:'a@test.example',phone:'44997372702',taxId:'05.998.428/0001-99'},delivery:'pickup',paymentMethod:'pix',consent:true,idempotencyKey:crypto.randomUUID()};
 r=await a.call('orders','POST',checkout);assert.equal(r.status,201,await r.clone().text());const order=await r.json();assert.equal(order.total,3800);assert.equal(order.shipping,0);assert.equal(order.status,'payment_pending');assert.ok(order.pixCode.startsWith('000201'));assert.equal(order.paymentStatus,'pending');assert.equal((await (await a.call('orders','POST',checkout)).json()).id,order.id);assert.equal((await b.call('orders/'+order.id)).status,403);
 r=await admin.call('admin/order/'+order.id+'/zip');assert.equal(r.status,200);const zip=Buffer.from(await r.arrayBuffer());assert.ok(zip.includes(Buffer.from(original)));assert.ok(zip.includes(Buffer.from('instrucoes-de-impressao.json')));assert.ok(zip.includes(Buffer.from('pedido-'+order.number+'/10x15/')));
 assert.equal((await admin.call('admin/order/'+order.id,'PATCH',{status:'delivered'})).status,400);assert.equal((await admin.call('admin/order/'+order.id,'PATCH',{status:'paid'})).status,200);assert.equal((await a.call('uploads/'+photo.id,'DELETE')).status,409);
 assert.equal((await a.call('cart','POST',item,{origin:'https://attacker.example'})).status,403);
 const pdf=await PDFDocument.create();pdf.addPage();pdf.addPage();const document=await upload(a,await pdf.save(),'application/pdf','duas-paginas.pdf');assert.equal(document.pageCount,2);
 const settings=initial.settings;assert.equal((await admin.call('admin/settings','PATCH',{...settings,documentBw:100})).status,200);
 const documentItem={productId:'documentos',quantity:1,fields:{fileId:document.id,color:'bw',pageCount:'1',pages:'',duplex:'no'},photos:[]};assert.equal((await a.call('cart','POST',documentItem)).status,400);
 documentItem.fields.pageCount='2';r=await a.call('cart','POST',documentItem);assert.equal(r.status,200);const documentCart=await r.json();assert.equal(documentCart.subtotal,200);assert.equal(shippingItems(documentCart.items)[0].quantity,2);assert.equal(shippingItems([{...documentCart.items[0],fields:{...documentCart.items[0].fields,duplex:'yes'}}])[0].quantity,1);
 const init=await a.call('uploads','POST',{name:'malicious.jpg',mime:'image/jpeg',bytes:36,width:1,height:1,consent:true});const bad=await init.json();const invalid=new Uint8Array(36);invalid.set(new TextEncoder().encode('<script>bad</script>'));assert.equal((await a.call('uploads/'+bad.id,'PUT',invalid)).status,415);
 const product=initial.products.find(p=>p.id==='porta-retratos');assert.equal((await admin.call('admin/products/'+product.id,'PATCH',{...product,price:1000,stock:1})).status,200);
 // Both buyers request the last unit; database CHECK and atomic batch prevent overselling.
 const ca=await (await a.call('cart')).json();for(const i of ca.items)await a.call('cart/'+i.id,'DELETE');
 for(const c of [a,b])assert.equal((await c.call('cart','POST',{productId:product.id,quantity:1,fields:{},photos:[]})).status,200);
 const results=await Promise.all([a.call('orders','POST',{...checkout,idempotencyKey:crypto.randomUUID()}),b.call('orders','POST',{...checkout,idempotencyKey:crypto.randomUUID()})]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
 if (adapter === 'platform') assert.equal((await platform.query('PRAGMA foreign_key_check')).length,0);
 else assert.equal((await platform.query('SELECT COUNT(*) AS count FROM users'))[0].count,3);
 }finally{await databaseAdapter?.close();await loader.close();}
});
