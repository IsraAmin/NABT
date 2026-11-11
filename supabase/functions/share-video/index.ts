// Public link preview for published, available NABT lecture videos.
// Deploy with JWT verification disabled; reads are enforced server-side.
const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char] as string));
Deno.serve(async request=>{
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
 const input=new URL(request.url);
 const id=input.searchParams.get('id')??'';
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return new Response('Not found',{status:404});
 const base=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!base||!secret)return new Response('Unavailable',{status:503});
 try{
  const query=new URL(base+'/rest/v1/resource_videos');
  query.searchParams.set('id','eq.'+id);
  query.searchParams.set('is_published','eq.true');
  query.searchParams.set('access_status','eq.available');
  query.searchParams.set('select','id,title,description,youtube_id,source_url');
  query.searchParams.set('limit','1');
  const response=await fetch(query,{headers:{apikey:secret,Authorization:'Bearer '+secret}});
  if(!response.ok)return new Response('Unavailable',{status:503});
  const entries=await response.json();
  const video=entries[0];
  if(!video)return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
  const site=(Deno.env.get('NABT_SITE_URL')||'https://israamin.github.io/NABT/').replace(/\/?$/,'/');
  const target=new URL(site);
  target.hash='lesson/'+id;
  // WhatsApp/Meta preview crawlers receive Open Graph HTML.
  // Human visitors must get a real HTTP redirect: script-based redirects
  // are frequently blocked by WhatsApp's in-app browser.
  const agent=request.headers.get('user-agent')||'';
  const isCrawler=/(?:facebookexternalhit|facebot|whatsapp|twitterbot|linkedinbot|telegrambot|slackbot|discordbot|googlebot|bingbot)/i.test(agent);
  const browserNavigation=request.headers.get('sec-fetch-mode')==='navigate'||request.headers.get('sec-fetch-dest')==='document';
  if(request.method==='GET' && (browserNavigation || !isCrawler)){
   return Response.redirect(target.href,302);
  }
  const url=input.origin+input.pathname+'?id='+encodeURIComponent(id);
  const title=escapeHtml(video.title+' | نَبْت');
  const desc=escapeHtml((video.description||'شاهدي هذا الدرس من مرئيات منصة نَبْت').slice(0,450));
  const driveId=typeof video.source_url==='string'?video.source_url.match(/^https:\/\/drive\.google\.com\/file\/d\/([\w-]+)\/view$/)?.[1]:null;
  const image=driveId?'https://drive.google.com/thumbnail?id='+encodeURIComponent(driveId)+'&sz=w640':/^[\w-]{11}$/.test(video.youtube_id||'')?'https://i.ytimg.com/vi/'+video.youtube_id+'/hqdefault.jpg':new URL('icons/apple-touch-icon.png',site).href;
  const document=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${desc}"><meta property="og:type" content="video.other"><meta property="og:title" content="${title}"><meta property="og:description" content="${desc}"><meta property="og:url" content="${escapeHtml(url)}"><meta property="og:image" content="${escapeHtml(image)}"><meta name="twitter:card" content="summary_large_image"><meta http-equiv="refresh" content="0;url=${escapeHtml(target.href)}"></head><body><main><h1>${title}</h1><p>${desc}</p><p><a href="${escapeHtml(target.href)}">اضغطي هنا لفتح الدرس في منصة نَبْت</a></p></main><script>window.location.replace(${JSON.stringify(target.href).replace(/</g,'\\u003c')});</script></body></html>`;
  return new Response(request.method==='HEAD'?null:document,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=120'}});
 }catch{return new Response('Unavailable',{status:503});}
});
