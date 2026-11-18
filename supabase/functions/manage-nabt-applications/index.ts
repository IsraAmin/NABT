import {createClient} from "npm:@supabase/supabase-js@2.57.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const response=(status:number,data:Record<string,unknown>)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 if(req.method!=="POST")return response(405,{error:"Method not allowed"});
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return response(500,{error:"الخادم غير مهيأ."});
 const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"").trim();
 if(!token)return response(401,{error:"يجب تسجيل الدخول."});
 const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
 try{
 const {data:authData,error:authError}=await admin.auth.getUser(token);
 if(authError||!authData.user)return response(401,{error:"انتهت جلسة الدخول."});
 const {data:operator,error:operatorError}=await admin.from("profiles").select("role,active,approval_status,supervisor_groups").eq("id",authData.user.id).single();
 if(operatorError||!["director","admin"].includes(operator?.role??"")||operator.active!==true||operator.approval_status!=="approved")
  return response(403,{error:"هذه العملية للإدارة فقط."});
 const isDirector=operator.role==="director";
 const allowedGroups=isDirector?["nabt1","nabt2"]:(operator.supervisor_groups?.length?operator.supervisor_groups:["nabt1"]);
 const body=await req.json().catch(()=>null) as {action?:unknown,id?:unknown,userId?:unknown}|null;
 const action=body?.action;

 if(action==="audit"){
  if(!isDirector)return response(403,{error:"سجل العمليات متاح للمديرة فقط."});
  const {data,error}=await admin.from("nabt_admin_audit").select("id,actor_id,action,target_name,nabt_group,details,created_at").order("created_at",{ascending:false}).limit(150);
  if(error)return response(500,{error:"تعذر تحميل سجل العمليات."});
  return response(200,{success:true,events:data||[]});
 }
 if(action==="resend_invite"){
  const userId=typeof body?.userId==="string"?body.userId:"";
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId))return response(400,{error:"معرّف الحساب غير صحيح."});
  const {data:member,error:memberError}=await admin.from("profiles").select("full_name,role,approval_status,active,password_setup_required,nabt_group").eq("id",userId).single();
  if(memberError||!member||member.role!=="member"||!allowedGroups.includes(member.nabt_group)||member.approval_status!=="approved"||member.active!==true||member.password_setup_required!==true)return response(409,{error:"إعادة الدعوة متاحة للحسابات المقبولة التي لم تعيّن كلمة المرور."});
  const {data:authUser,error:userError}=await admin.auth.admin.getUserById(userId);
  if(userError||!authUser.user?.email)return response(404,{error:"لم يتم العثور على بريد الحساب."});
  const {error:emailError}=await admin.auth.resetPasswordForEmail(authUser.user.email,{redirectTo:"https://israamin.github.io/NABT/"});
  if(emailError)return response(500,{error:"تعذر إرسال الرابط: "+emailError.message});
  await admin.from("nabt_admin_audit").insert({actor_id:authData.user.id,action:"invitation_resent",target_id:userId,target_name:member.full_name});
  return response(200,{success:true,message:"تم إرسال رابط جديد لتعيين كلمة المرور."});
 }
 if(action==="list"){
  const {data,error}=await admin.from("nabt_applications").select("id,full_name,email,phone,birth_date,country,city,nabt_group,created_at").order("created_at",{ascending:false}).limit(500);
  if(error)return response(500,{error:"تعذر تحميل الطلبات."});
  return response(200,{success:true,applications:(data||[]).filter(a=>allowedGroups.includes(a.nabt_group))});
 }
 if(action!=="approve"&&action!=="reject")return response(400,{error:"العملية غير معروفة."});
 const id=typeof body?.id==="string"?body.id:"";
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
 return response(400,{error:"معرّف الطلب غير صالح."});
 const {data:application,error:lookupError}=await admin.from("nabt_applications").select("*").eq("id",id).single();
 if(lookupError||!application)return response(404,{error:"الطلب غير موجود أو عولج بالفعل."});
 if(!allowedGroups.includes(application.nabt_group))return response(403,{error:"الطلب خارج نطاق إشرافك."});
 if(action==="reject"){
  const {error}=await admin.from("nabt_applications").delete().eq("id",id);
  if(error)return response(500,{error:"تعذر رفض الطلب."});
  await admin.from("nabt_admin_audit").insert({actor_id:authData.user.id,action:"application_rejected",target_name:application.full_name,nabt_group:application.nabt_group,details:{application_id:id}});
  return response(200,{success:true,message:"رُفض الطلب وحُذف، ويمكن التقديم مرة أخرى."});
 }

 // New requests are separate from accounts. Only an approved request becomes a membership.
 const redirectTo="https://israamin.github.io/NABT/";
 let idUser:string;
 let invitedNow=false;
 let previousAccount=false;
 let emailNote="تمت الموافقة وإرسال دعوة بالبريد لتعيين كلمة المرور.";
 const {data:invited,error:inviteError}=await admin.auth.admin.inviteUserByEmail(application.email,{
  redirectTo,data:{full_name:application.full_name,phone:application.phone,birth_date:application.birth_date,country:application.country,city:application.city,nabt_group:application.nabt_group}
 });
 if(!inviteError&&invited.user){
   idUser=invited.user.id;
   invitedNow=true;
 }else{
   // Legacy signups and partially-completed approvals may already have an Auth identity.
   let existingId:string|undefined;
   for(let page=1;page<=5;page++){
    const {data:pageUsers,error:pageError}=await admin.auth.admin.listUsers({page,perPage:200});
    if(pageError)break;
    const match=pageUsers.users.find(u=>u.email?.toLowerCase()===String(application.email).toLowerCase());
    if(match){existingId=match.id;break;}
    if(pageUsers.users.length<200)break;
   }
   if(!existingId)return response(409,{error:"تعذر إرسال دعوة القبول. تحققّي من إعدادات البريد أو من وجود حساب مسجل بنفس البريد."});
   idUser=existingId;
   previousAccount=true;
 }
 const {data:existingProfile,error:existingError}=await admin.from("profiles")
    .select("id,role,active,approval_status,password_setup_required").eq("id",idUser).single();
 if(existingError||!existingProfile){
  if(invitedNow)await admin.auth.admin.deleteUser(idUser,false);
  return response(500,{error:"تعذر تأكيد بيانات الحساب. الطلب ما زال في الانتظار."});
 }
 if(previousAccount&&existingProfile.role!=="member")
  return response(409,{error:"البريد مرتبط بحساب إداري موجود. لا يمكن إنشاء عضوية مكررة."});
 if(previousAccount&&existingProfile.approval_status==="approved"&&existingProfile.password_setup_required!==true)
  return response(409,{error:"هذا البريد مرتبط بعضوية مفعلة بالفعل. يرجى مراجعة الحساب قبل قبول الطلب."});
 if(previousAccount&&existingProfile.approval_status!=="approved"&&existingProfile.active===true)
  return response(409,{error:"لا يمكن تحويل حساب نشط مسبقًا دون مراجعة المديرة."});
 const {data:changed,error:approveError}=await admin.from("profiles").update({
  full_name:application.full_name,phone:application.phone,birth_date:application.birth_date,
  country:application.country,city:application.city,nabt_group:application.nabt_group,
  role:"member",approval_status:"approved",active:true,password_setup_required:true
 }).eq("id",idUser).select("id").single();
 if(approveError||!changed){
   if(invitedNow)await admin.auth.admin.deleteUser(idUser,false);
   return response(500,{error:"تعذر تفعيل الحساب، وتم الإبقاء على الطلب للمراجعة."});
 }
 if(previousAccount){
  const {error:resendError}=await admin.auth.resetPasswordForEmail(String(application.email),{redirectTo});
  if(resendError)emailNote="تم اعتماد الحساب، لكن تعذر إرسال رسالة كلمة المرور. يمكنك إعادة إرسال الدعوة من قائمة العضوات.";
 }
 const {data:deleted,error:deleteError}=await admin.from("nabt_applications").delete().eq("id",id).select("id").single();
 if(deleteError||!deleted)return response(500,{error:"تم اعتماد الحساب، لكن لم يتأكد حذف الطلب من قائمة الانتظار. يرجى إعادة المحاولة أو مراجعة الإدارة."});
 await admin.from("nabt_admin_audit").insert({actor_id:authData.user.id,action:"application_approved",target_id:idUser,target_name:application.full_name,nabt_group:application.nabt_group,details:{application_id:id,legacy_account:previousAccount}});
 return response(200,{success:true,message:"تم اعتماد الحساب وحذف طلبه من الانتظار. "+emailNote});
 }catch(error){return response(500,{error:"تعذر تنفيذ العملية: "+(error instanceof Error?error.message:"خطأ غير معروف")});}
});