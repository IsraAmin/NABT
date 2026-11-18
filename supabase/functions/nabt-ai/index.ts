import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(status:number,data:Record<string,unknown>)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
type Profile={id:string;full_name:string;role:string;active:boolean;approval_status:string;supervisor_groups:string[]|null;nabt_group:string|null;phone:string|null};
type Config={enabled:boolean;model:string;admin_daily_limit:number;director_daily_limit:number;allow_member_names:boolean;allow_university:boolean;allow_phone:boolean;allow_email:boolean;key1_id:string|null;key2_id:string|null};
type Session={id:string;session_date:string;start_time:string|null;end_time:string|null;book_id:string|null;nabt_groups:string[]|null};
type ResponseRow={session_id:string;member_id:string;response:string};
const norm=(s:string)=>s.toLowerCase().normalize("NFKC").replace(/[\u064b-\u065f\u0670]/g,"").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/\s+/g," ").trim();
const isObj=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x);
const DATE_ZONE="Africa/Khartoum";
const dayStamp=()=>new Intl.DateTimeFormat("en-CA",{timeZone:DATE_ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
function monthTarget(offset:number){const now=dayStamp().split("-").map(Number);const d=new Date(Date.UTC(now[0],now[1]-1+offset,1));return d.toISOString().slice(0,7);}
const withGroup=(groups:string[]|null,allowed:string[])=>Array.isArray(groups)&&groups.some(g=>allowed.includes(g));
function localIntent(question:string){
 const q=norm(question);
 if(/(رقم|هاتف|جوال|تلفون|ايميل|بريد|جامع[هة])/.test(q))return "member_info";
 if(/(تعويض|عوضن|عوضت)/.test(q))return "compensations";
 if(/(حضور|حضرت|الغياب|غابت|نسبه|التزام)/.test(q))return "attendance";
 if(/(كتاب|كتب|المكتبه)/.test(q))return "books";
 if(/(فيديو|مرئيات|مرئيه)/.test(q))return "videos";
 if(/(عضوات|اعضاء|عضوه|عضو)/.test(q))return "members";
 if(/(جلسات|جلسه)/.test(q))return "sessions";
 return "overview";
}
function scrubQuestion(question:string,members:Profile[]){
 let safe=question;
 for(const name of members.map(m=>m.full_name).filter(Boolean).sort((a,b)=>b.length-a.length)){
  safe=safe.split(name).join("[MEMBER]");
 }
 return safe.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,"[EMAIL]").replace(/\+?\d[\d\s()-]{7,}\d/g,"[PHONE]").slice(0,500);
}
async function chooseIntent(question:string,members:Profile[],keys:string[],model:string){
 const scrubbed=scrubQuestion(question,members);
 const payload={systemInstruction:{parts:[{text:"You classify Arabic user questions for an educational group management analytics tool. Never assume facts. Return ONLY JSON: {\"intent\":\"attendance|compensations|sessions|members|books|videos|member_info|overview\",\"period\":\"current|previous|all\"}. Questions about numbers or academic statistics belong to their corresponding category. No SQL, no personal data."}]},contents:[{parts:[{text:scrubbed}]}],generationConfig:{temperature:0,maxOutputTokens:160,responseMimeType:"application/json"}};
 let problem="تعذر الاتصال بخدمة Gemini.";
 for(const key of keys){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  try{
   const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent",{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},body:JSON.stringify(payload),signal:controller.signal});
   clearTimeout(timer);
   if(!response.ok){problem=response.status===429?"تم بلوغ حد Google المؤقت أو اليومي.":response.status===401||response.status===403?"مفتاح Gemini غير صالح أو غير مخول.":response.status===404?"النموذج المختار غير متاح للمشروع.":"تعذّر استدعاء Gemini ("+response.status+").";if([401,403,429,500,502,503,504].includes(response.status))continue;throw new Error(problem);}
   const out=await response.json();
   const value=String(out?.candidates?.[0]?.content?.parts?.map((p:{text?:string})=>p.text||"").join("")||"");
   let parsed:Record<string,unknown>;
   try{parsed=JSON.parse(value);}catch{parsed=JSON.parse(value.match(/\{[\s\S]*\}/)?.[0]||"{}");}
   const options=["attendance","compensations","sessions","members","books","videos","member_info","overview"];
   const intent=options.includes(String(parsed.intent))?String(parsed.intent):localIntent(question);
   const period=["current","previous","all"].includes(String(parsed.period))?String(parsed.period):"current";
   return {intent,period};
  }catch(error){clearTimeout(timer);problem=error instanceof Error?error.message:problem;}
 }
 throw new Error(problem);
}
async function allRows(client:ReturnType<typeof createClient>,table:string,fields:string){
 const rows:Record<string,unknown>[]=[];
 for(let from=0;from<50000;from+=500){
  const {data,error}=await client.from(table).select(fields).range(from,from+499);
  if(error)throw new Error("Data read failed: "+table);
  rows.push(...(data||[]));
  if((data||[]).length<500)return rows;
 }
 throw new Error("Query range too large");
}
function countPeriod(date:string,month:string|null){return !month||date.startsWith(month);}
function makeAnswer(intent:string,period:string,question:string,members:Profile[],sessions:Session[],answers:ResponseRow[],books:Record<string,unknown>[],videos:Record<string,unknown>[],config:Config,scope:string[],client:ReturnType<typeof createClient>){
 const today=dayStamp();const clock=new Intl.DateTimeFormat("en-GB",{timeZone:DATE_ZONE,hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date());
 const month=period==="all"?null:monthTarget(period==="previous"?-1:0);
 const titlePeriod=period==="all"?"جميع الفترات":period==="previous"?"الشهر الماضي":"الشهر الحالي";
 const activeSessions=sessions.filter(s=>withGroup(s.nabt_groups,scope)&&countPeriod(s.session_date,month)&&(
  s.session_date<today||(s.session_date===today&&(s.end_time||"23:59:59").slice(0,5)<=clock)
 ));
 const sessionIds=new Set(activeSessions.map(s=>s.id));
 const scopedMembers=members.filter(m=>m.role==="member"&&m.nabt_group&&scope.includes(m.nabt_group));
 const eligibleMembers=new Set(scopedMembers.map(m=>m.id));
 const filtered=answers.filter(a=>sessionIds.has(a.session_id)&&eligibleMembers.has(a.member_id));
 const q=norm(question);
 const found=scopedMembers.filter(m=>norm(m.full_name).length>2&&q.includes(norm(m.full_name))).sort((a,b)=>b.full_name.length-a.full_name.length);
 const member=found[0]||null;
 const group=q.includes("نبت ٢")||q.includes("نبت 2")?"nabt2":q.includes("نبت ١")||q.includes("نبت 1")?"nabt1":null;
 const selectedMembers=scopedMembers.filter(m=>(!member||m.id===member.id)&&(!group||m.nabt_group===group));
 const selectedIds=new Set(selectedMembers.map(m=>m.id));
 const selectedSessions=activeSessions.filter(s=>!group||withGroup(s.nabt_groups,[group]));
 const selectedSessionsIds=new Set(selectedSessions.map(s=>s.id));
 const selectedResponses=filtered.filter(r=>selectedIds.has(r.member_id)&&selectedSessionsIds.has(r.session_id));
 const base={period:titlePeriod,month:month||"الكل",scope:scope.map(g=>g==="nabt1"?"نبت 1":"نبت 2").join(" و ")};
 const displayName=member&&config.allow_member_names?member.full_name:"العضوة المحددة";
 const respond=(answer:string,values:Record<string,string|number|null>={})=>({answer,values,period:base.period,month:base.month,scope:base.scope});
 if(intent==="member_info"){
  if(!member)return respond("للاستعلام عن بيانات عضوة، اكتبي اسمها الكامل كما هو مسجل في نَبْت.");
  const askPhone=/(رقم|هاتف|جوال|تلفون)/.test(q),askEmail=/(ايميل|بريد)/.test(q),askUniversity=/(جامع[هة])/.test(q);
  if(askPhone&&!config.allow_phone)return respond("السوبر أدمن لم يسمح للمساعد بعرض أرقام الهواتف.");
  if(askEmail&&!config.allow_email)return respond("عرض البريد الإلكتروني غير مسموح في إعدادات المساعد.");
  if(askUniversity&&!config.allow_university)return respond("عرض الجامعة غير مسموح في إعدادات المساعد.");
  if(!askPhone&&!askEmail&&!askUniversity)return respond("حددي نوع المعلومة المطلوبة: الجامعة، الهاتف، أو البريد الإلكتروني.");
  // Read auth metadata locally only: never transmit these fields to Gemini.
  return {memberInfoId:member.id,displayName,askPhone,askEmail,askUniversity,base};
 }
 if(intent==="members"){
  const active=selectedMembers.filter(m=>m.active!==false).length;
  return respond("عدد العضوات ضمن النطاق المحدد: "+selectedMembers.length+"، منهن "+active+" حساباً نشطاً.",{members:selectedMembers.length,active,inactive:selectedMembers.length-active});
 }
 if(intent==="sessions")return respond("عدد الجلسات المنتهية في "+titlePeriod+": "+selectedSessions.length+" جلسة.",{sessions:selectedSessions.length});
 if(intent==="compensations"){
  const n=selectedResponses.filter(r=>r.response==="compensated").length;
  return respond((member?"التعويضات المسجلة لـ "+displayName:"عدد التعويضات المسجلة")+" في "+titlePeriod+": "+n+" تعويضاً.",{compensations:n,attended:selectedResponses.filter(r=>r.response==="attended").length});
 }
 if(intent==="attendance"){
  const rates=selectedMembers.map(m=>{
   const relevant=selectedSessions.filter(s=>withGroup(s.nabt_groups,[m.nabt_group||""]));
   const ids=new Set(relevant.map(s=>s.id));
   const response=selectedResponses.filter(r=>r.member_id===m.id&&ids.has(r.session_id));
   const attended=new Set(response.filter(r=>r.response==="attended").map(r=>r.session_id));
   const compensated=new Set(response.filter(r=>r.response==="compensated").map(r=>r.session_id).filter(id=>!attended.has(id)));
   return {total:relevant.length,attended:attended.size,compensated:compensated.size,rate:relevant.length?Math.round((attended.size+compensated.size)*100/relevant.length):null};
  });
  const total=rates.reduce((v,r)=>v+r.total,0),attended=rates.reduce((v,r)=>v+r.attended,0),compensated=rates.reduce((v,r)=>v+r.compensated,0);
  const attendanceRate=total?Math.round(attended*100/total):null;
  const engagementRate=total?Math.round((attended+compensated)*100/total):null;
  return respond((member?"إحصائيات "+displayName:"إحصائيات الحضور")+" في "+titlePeriod+": "+(attendanceRate===null?"لا توجد جلسات مكتملة للحساب.":"الحضور الفعلي "+attendanceRate+"%، والالتزام باحتساب التعويض "+engagementRate+"%.")+" (الحضور "+attended+"، التعويض "+compensated+" من "+total+" فرصة حضور).",{attendance_rate:attendanceRate,participation_rate:engagementRate,attended,compensations:compensated,eligible_sessions:total});
 }
 if(intent==="books"){
  const scoped=books.filter(b=>withGroup(b.nabt_groups as string[]|null,scope)||!Array.isArray(b.nabt_groups));
  return respond("المكتبة تحتوي على "+scoped.length+" كتاباً متاحاً للنطاق المحدد، منها "+scoped.filter(b=>b.status==="completed").length+" مكتملة.",{books:scoped.length,completed:scoped.filter(b=>b.status==="completed").length,in_progress:scoped.filter(b=>b.status==="in_progress").length});
 }
 if(intent==="videos"){
  const scoped=videos.filter(v=>withGroup(v.nabt_groups as string[]|null,scope)||!Array.isArray(v.nabt_groups));
  return respond("عدد المرئيات في نطاقك "+scoped.length+"، المنشور منها "+scoped.filter(v=>v.is_published).length+".",{videos:scoped.length,published:scoped.filter(v=>v.is_published).length});
 }
 return respond("ملخص "+titlePeriod+": "+scopedMembers.length+" عضوة، "+activeSessions.length+" جلسة منتهية، "+filtered.filter(r=>r.response==="attended").length+" حالة حضور، و"+filtered.filter(r=>r.response==="compensated").length+" تعويض.",{members:scopedMembers.length,sessions:activeSessions.length,attended:filtered.filter(r=>r.response==="attended").length,compensations:filtered.filter(r=>r.response==="compensated").length});
}
Deno.serve(async (req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 if(req.method!=="POST")return reply(405,{error:"Method not allowed"});
 const url=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!serviceKey)return reply(503,{error:"خدمة المساعد غير مهيأة."});
 const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"").trim();
 if(!token)return reply(401,{error:"يجب تسجيل الدخول أولاً."});
 const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error:authError}=await db.auth.getUser(token);
 if(authError||!auth.user)return reply(401,{error:"انتهت جلسة الدخول."});
 const uid=auth.user.id;
 const {data:profile,error:profileError}=await db.from("profiles").select("id,role,active,approval_status,supervisor_groups,nabt_group").eq("id",uid).single();
 if(profileError||!profile||!["director","admin"].includes(profile.role)||profile.active!==true||profile.approval_status!=="approved")return reply(403,{error:"المساعد الذكي للإدارة فقط."});
 const director=profile.role==="director";
 const scope=director?["nabt1","nabt2"]:(profile.supervisor_groups?.length?profile.supervisor_groups:[profile.nabt_group].filter(Boolean));
 const {data:cfg,error:cfgError}=await db.from("nabt_ai_config").select("*").eq("id",true).single();
 if(cfgError||!cfg)return reply(503,{error:"لم تكتمل إعدادات المساعد."});
 const config=cfg as Config;
 const limit=director?config.director_daily_limit:config.admin_daily_limit;
 const {data:usage}=await db.from("nabt_ai_usage").select("used").eq("user_id",uid).eq("usage_date",dayStamp()).maybeSingle();
 const used=Number(usage?.used||0);
 const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
 if(!body||typeof body.action!=="string")return reply(400,{error:"الطلب غير صحيح."});
 if(body.action==="status")return reply(200,{enabled:config.enabled,configured:!!(config.key1_id||config.key2_id),remaining:Math.max(0,limit-used),limit,model:config.model});
 if(body.action==="get_settings"){
  if(!director)return reply(403,{error:"إعدادات المساعد للسوبر أدمن فقط."});
  return reply(200,{enabled:config.enabled,model:config.model,admin_daily_limit:config.admin_daily_limit,director_daily_limit:config.director_daily_limit,allow_member_names:config.allow_member_names,allow_university:config.allow_university,allow_phone:config.allow_phone,allow_email:config.allow_email,key1_configured:!!config.key1_id,key2_configured:!!config.key2_id});
 }
 if(body.action==="save_settings"){
  if(!director)return reply(403,{error:"الإعدادات للسوبر أدمن فقط."});
  const allowed=["enabled","model","admin_daily_limit","director_daily_limit","allow_member_names","allow_university","allow_phone","allow_email"];
  const update:Record<string,unknown>={};
  for(const name of allowed)if(Object.prototype.hasOwnProperty.call(body,name))update[name]=body[name];
  for(const field of ["admin_daily_limit","director_daily_limit"])if(field in update&&(!Number.isInteger(update[field])||Number(update[field])<1||Number(update[field])>300))return reply(400,{error:"حد الأسئلة يجب أن يكون بين 1 و300."});
  if("model" in update&&(!/^gemini-[a-zA-Z0-9._-]{2,70}$/.test(String(update.model))))return reply(400,{error:"اسم نموذج Gemini غير صحيح."});
  for(const name of ["enabled","allow_member_names","allow_university","allow_phone","allow_email"])if(name in update&&typeof update[name]!=="boolean")return reply(400,{error:"الإعدادات غير صحيحة."});
  if(Object.keys(update).length){const {error}=await db.from("nabt_ai_config").update({...update,updated_at:new Date().toISOString()}).eq("id",true);if(error)return reply(500,{error:"تعذر حفظ الإعدادات."});}
  return reply(200,{success:true});
 }
 if(body.action==="save_key"||body.action==="clear_key"){
  if(!director)return reply(403,{error:"المفاتيح للسوبر أدمن فقط."});
  const slot=Number(body.slot);
  if(slot!==1&&slot!==2)return reply(400,{error:"المفتاح المحدد غير صحيح."});
  if(body.action==="save_key"&&(typeof body.key!=="string"||body.key.length<12||body.key.length>400||/\s/.test(body.key)))return reply(400,{error:"أدخلي مفتاح API صالحاً."});
  const {error}=body.action==="save_key"
   ?await db.rpc("nabt_ai_save_key",{p_slot:slot,p_key:body.key})
   :await db.rpc("nabt_ai_clear_key",{p_slot:slot});
  if(error)return reply(500,{error:"تعذر حفظ المفتاح بأمان."});
  return reply(200,{success:true});
 }
 if(body.action!=="chat")return reply(400,{error:"الأمر غير معروف."});
 if(!config.enabled)return reply(403,{error:"المساعد معطل من إعدادات النظام."});
 if(used>=limit)return reply(429,{error:"وصلتي إلى الحد اليومي للأسئلة. جرّبي غداً.",remaining:0});
 const question=typeof body.question==="string"?body.question.trim():"";
 if(question.length<3||question.length>500)return reply(400,{error:"اكتبي سؤالاً من 3 إلى 500 حرف."});
 if(!config.key1_id&&!config.key2_id)return reply(503,{error:"لا يوجد مفتاح Gemini محفوظ. أضيفيه من إعدادات النظام."});
 const {data:secrets,error:keyError}=await db.rpc("nabt_ai_read_keys");
 if(keyError)return reply(503,{error:"تعذر قراءة إعدادات Gemini."});
 const keys=[secrets?.primary,secrets?.backup].filter((x:unknown):x is string=>typeof x==="string"&&x.length>10);
 if(!keys.length)return reply(503,{error:"لم يتم إعداد مفاتيح Gemini بعد."});
 const {data:claimed,error:claimError}=await db.rpc("nabt_ai_claim",{p_user:uid,p_limit:limit});
 if(claimError)return reply(500,{error:"تعذر التحقق من الحصة اليومية."});
 if(!claimed)return reply(429,{error:"اكتمل عدد الأسئلة اليوم.",remaining:0});
 try{
  const [memberRows,sessionRows,responseRows,bookRows,videoRows]=await Promise.all([
   allRows(db,"profiles","id,full_name,role,active,approval_status,supervisor_groups,nabt_group,phone"),
   allRows(db,"sessions","id,session_date,start_time,end_time,book_id,nabt_groups"),
   allRows(db,"session_responses","session_id,member_id,response"),
   allRows(db,"books","id,title,status,nabt_groups"),
   allRows(db,"resource_videos","id,is_published,nabt_groups")
  ]);
  const members=(memberRows as unknown as Profile[]).filter(m=>m.role==="member"&&m.nabt_group&&scope.includes(m.nabt_group)&&m.approval_status==="approved");
  // Gemini only classifies sanitized questions: no database records, keys, or identifying fields are sent.
  const intent=await chooseIntent(question,members,keys,config.model);
  const raw=makeAnswer(intent.intent,intent.period,question,members,sessionRows as unknown as Session[],responseRows as unknown as ResponseRow[],bookRows,videoRows,config,scope,db);
  if("memberInfoId" in raw){
   const info=raw as {memberInfoId:string;displayName:string;askPhone:boolean;askEmail:boolean;askUniversity:boolean;base:{period:string;month:string;scope:string}};
   const member=members.find(m=>m.id===info.memberInfoId);
   if(!member)throw new Error("العضوة خارج نطاق الصلاحية.");
   const fields:string[]=[];
   if(info.askPhone)fields.push("الهاتف: "+(member.phone||"غير مسجل"));
   if(info.askEmail||info.askUniversity){
    const {data,error}=await db.auth.admin.getUserById(member.id);
    if(error||!data.user)throw new Error("تعذر الحصول على البيانات.");
    if(info.askEmail)fields.push("البريد: "+(data.user.email||"غير مسجل"));
    if(info.askUniversity)fields.push("الجامعة: "+(String(data.user.user_metadata?.university||"غير مسجلة")));
   }
   return reply(200,{answer:info.displayName+"\n"+fields.join("\n"),values:{},period:info.base.period,remaining:limit-Number(claimed),scope:info.base.scope});
  }
  return reply(200,{...raw,remaining:limit-Number(claimed)});
 }catch(error){
  await db.rpc("nabt_ai_refund",{p_user:uid});
  return reply(502,{error:error instanceof Error?error.message:"تعذرت الإجابة. لم يُخصم السؤال من حصتك."});
 }
});