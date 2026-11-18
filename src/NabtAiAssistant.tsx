import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Bot,Send,X,Settings2,ShieldCheck,KeyRound,Sparkles,ChevronDown,LoaderCircle,RotateCcw,CheckCircle2,AlertCircle,MessageCircle,Trash2,LockKeyhole} from 'lucide-react';
import {supabase} from './supabase';
import './nabt-ai.css';

type Role='director'|'admin';
type Status={enabled:boolean;configured:boolean;remaining:number;limit:number;model:string};
type AssistantMessage={id:number;role:'assistant'|'user';text:string;values?:Record<string,string|number|null>;scope?:string};
type AiSettings={enabled:boolean;model:string;admin_daily_limit:number;director_daily_limit:number;allow_member_names:boolean;allow_university:boolean;allow_phone:boolean;allow_email:boolean;key1_configured:boolean;key2_configured:boolean};
const starter:AssistantMessage={id:1,role:'assistant',text:'السلام عليكم 🌱 أنا مساعد نَبْت. اسأليني عن الحضور والتعويضات والجلسات والمصادر. إجاباتي من قاعدة بيانات المنصة، وبحسب صلاحياتك.'};
const sampleQuestions=['كم تعويض هذا الشهر؟','كم نسبة الحضور هذا الشهر؟','كم جلسة انتهت؟','كم عضوة نشطة؟'];
async function callAi(body:Record<string,unknown>):Promise<Record<string,unknown>>{
 if(!supabase)throw new Error('الاتصال بقاعدة البيانات غير متاح.');
 const {data,error}=await supabase.functions.invoke('nabt-ai',{body});
 if(error||!data||typeof data!=='object'){
  let message='تعذّر الاتصال بمساعد نَبْت.';
  try{
   const context=(error as {context?:Response}|null)?.context;
   if(context&&typeof context.json==='function'){
    const json=await context.json() as {error?:string};
    if(json.error)message=json.error;
   }
  }catch{/* avoid leaking API details */}
  throw new Error(message);
 }
 if(typeof data.error==='string')throw new Error(data.error);
 return data as Record<string,unknown>;
}
const asInt=(value:unknown,fallback:number)=>typeof value==='number'&&Number.isFinite(value)?value:fallback;
export function NabtAiAssistant({role}:{role:Role}){
 const [open,setOpen]=useState(false),[status,setStatus]=useState<Status|null>(null),[messages,setMessages]=useState<AssistantMessage[]>([starter]);
 const [question,setQuestion]=useState(''),[sending,setSending]=useState(false),[error,setError]=useState('');
 const endRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;let live=true;void callAi({action:'status'}).then(data=>{if(live)setStatus(data as Status)}).catch(e=>{if(live)setError(e instanceof Error?e.message:'تعذر معرفة الحصة.')});return()=>{live=false};},[open]);
 useEffect(()=>{if(open)endRef.current?.scrollIntoView({behavior:'smooth',block:'end'});},[messages,open]);
 async function send(text:string){
  if(sending||text.trim().length<3)return;
  const content=text.trim();setQuestion('');setError('');setSending(true);
  setMessages(m=>[...m,{id:Date.now(),role:'user',text:content}]);
  try{
   const data=await callAi({action:'chat',question:content});
   setMessages(m=>[...m,{id:Date.now()+1,role:'assistant',text:String(data.answer||'لم أجد إجابة محددة.'),values:typeof data.values==='object'&&data.values?data.values as Record<string,string|number|null>:undefined,scope:typeof data.scope==='string'?data.scope:undefined}]);
   setStatus(s=>s?{...s,remaining:asInt(data.remaining,s.remaining)}:s);
  }catch(e){setError(e instanceof Error?e.message:'تعذر الرد على السؤال.');setQuestion(content);setMessages(m=>m.filter(x=>x.id!==0&&!(x.role==='user'&&x.text===content&&x===m[m.length-1])));}
  finally{setSending(false);}
 }
 const exhausted=status!==null&&status.remaining<=0;
 return <div className="nabt-ai-root" dir="rtl">
  {open&&<section className="nabt-ai-pop" aria-label="محادثة مساعد نبت الذكي">
   <header className="nabt-ai-head">
    <div className="nabt-ai-head-avatar"><Bot size={23}/></div>
    <div className="nabt-ai-head-copy"><strong>مساعد نَبْت الذكي</strong><small><span className="nabt-ai-live"/> Gemini · مساعد الإدارة</small></div>
    <button type="button" className="nabt-ai-icon-btn" aria-label="إغلاق المساعد" onClick={()=>setOpen(false)}><X size={20}/></button>
   </header>
   <div className="nabt-ai-limit"><span><ShieldCheck size={15}/> {status?'باقي '+status.remaining+' من '+status.limit+' سؤال اليوم':'التحقق من الحصة...'}</span><span className="nabt-ai-role">{role==='director'?'المديرة':'الأدمن'}</span></div>
   <div className="nabt-ai-thread" role="log" aria-live="polite">
    {messages.map(m=><div key={m.id} className={'nabt-ai-line '+(m.role==='user'?'is-user':'is-assistant')}>
     {m.role==='assistant'&&<div className="nabt-ai-bot-small"><Sparkles size={15}/></div>}
     <div className="nabt-ai-bubble">
      <p>{m.text}</p>
      {m.values&&Object.keys(m.values).length>0&&<div className="nabt-ai-stats">{Object.entries(m.values).slice(0,6).map(([key,val])=><div key={key}><small>{({attendance_rate:'الحضور %',participation_rate:'الالتزام %',attended:'حضور',compensations:'تعويضات',eligible_sessions:'فرص الحضور',sessions:'جلسات',members:'عضوات',active:'نشطة',inactive:'معطلة',books:'كتب',completed:'مكتملة',in_progress:'قيد الدراسة',videos:'مرئيات',published:'منشورة'} as Record<string,string>)[key]||key}</small><b>{val===null?'—':String(val)}</b></div>)}</div>}
      {m.scope&&<small className="nabt-ai-source">المصدر: قاعدة بيانات نَبْت · {m.scope}</small>}
     </div>
    </div>)}
    {sending&&<div className="nabt-ai-typing"><LoaderCircle size={17} className="nabt-ai-spin"/> جاري تحليل السؤال والإحصائيات...</div>}
    <div ref={endRef}/>
   </div>
   {messages.length===1&&<div className="nabt-ai-suggestions">{sampleQuestions.map(q=><button type="button" key={q} disabled={sending||exhausted} onClick={()=>void send(q)}>{q}</button>)}</div>}
   {error&&<p className="nabt-ai-error" role="alert"><AlertCircle size={16}/>{error}</p>}
   {!status?.configured&&status&&<p className="nabt-ai-notice"><KeyRound size={15}/> لم تتم إضافة مفتاح Gemini بعد. تُضاف المفاتيح من إعدادات النظام.</p>}
   <form className="nabt-ai-compose" onSubmit={(e:FormEvent)=>{e.preventDefault();void send(question)}}>
    <input aria-label="سؤالك للمساعد" value={question} maxLength={500} disabled={sending||exhausted} onChange={e=>setQuestion(e.target.value)} placeholder={exhausted?'انتهت أسئلتك لهذا اليوم':'اسألي عن بيانات نَبْت...'}/>
    <button type="submit" title="إرسال السؤال" disabled={sending||exhausted||question.trim().length<3}><Send size={19}/></button>
   </form>
   <footer className="nabt-ai-footer"><LockKeyhole size={12}/> المعلومات حسب صلاحية الحساب · لا تُرسل سجلات العضوات إلى Gemini</footer>
  </section>}
  <button type="button" className={'nabt-ai-fab '+(open?'is-open':'')} onClick={()=>setOpen(v=>!v)} aria-label={open?'إغلاق شات مساعد نبت':'فتح شات مساعد نبت'} aria-expanded={open}>
   {open?<ChevronDown size={25}/>:<><MessageCircle size={26}/><span className="nabt-ai-fab-spark"><Sparkles size={12}/></span></>}
  </button>
 </div>;
}

const toggles:[keyof AiSettings,string,string][]=[
 ['allow_member_names','عرض أسماء العضوات','داخل الإجابات فقط، دون إرسالها إلى Gemini'],
 ['allow_university','إتاحة بيانات الجامعة','من ملف العضوة المسموح لها فقط'],
 ['allow_phone','إتاحة أرقام الهواتف','مغلقة افتراضياً لحماية الخصوصية'],
 ['allow_email','إتاحة البريد الإلكتروني','مغلقة افتراضياً لحماية الخصوصية']
];
export function NabtAiSettings(){
 const [settings,setSettings]=useState<AiSettings|null>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [key1,setKey1]=useState(''),[key2,setKey2]=useState(''),[show1,setShow1]=useState(false),[show2,setShow2]=useState(false);
 const [message,setMessage]=useState(''),[problem,setProblem]=useState('');
 async function refresh(){setLoading(true);try{const result=await callAi({action:'get_settings'});setSettings(result as AiSettings);setProblem('');}catch(e){setProblem(e instanceof Error?e.message:'تعذر تحميل الإعدادات.');}finally{setLoading(false)}}
 useEffect(()=>{void refresh();},[]);
 const edit=<K extends keyof AiSettings>(name:K,value:AiSettings[K])=>setSettings(s=>s?{...s,[name]:value}:s);
 async function save(){if(!settings)return;setSaving(true);setMessage('');setProblem('');
  try{
   const {key1_configured:_a,key2_configured:_b,...payload}=settings;
   await callAi({action:'save_settings',...payload});setMessage('تم حفظ إعدادات المساعد بنجاح.');
  }catch(e){setProblem(e instanceof Error?e.message:'تعذر الحفظ.');}finally{setSaving(false)}
 }
 async function saveKey(slot:1|2){const key=slot===1?key1:key2;if(key.trim().length<12)return setProblem('أدخلي مفتاحاً صالحاً أولاً.');
  setSaving(true);setMessage('');setProblem('');
  try{await callAi({action:'save_key',slot,key:key.trim()});if(slot===1){setKey1('');setShow1(false)}else{setKey2('');setShow2(false)};setSettings(s=>s?{...s,[slot===1?'key1_configured':'key2_configured']:true}:s);setMessage('تم تخزين المفتاح '+slot+' مشفراً بنجاح.');}
  catch(e){setProblem(e instanceof Error?e.message:'تعذر حفظ المفتاح.');}finally{setSaving(false)}
 }
 async function clearKey(slot:1|2){if(!window.confirm('هل تريدين حذف المفتاح '+slot+' من الخادم؟'))return;setSaving(true);setProblem('');setMessage('');
  try{await callAi({action:'clear_key',slot});setSettings(s=>s?{...s,[slot===1?'key1_configured':'key2_configured']:false}:s);setMessage('تم حذف المفتاح '+slot+'.');}
  catch(e){setProblem(e instanceof Error?e.message:'تعذر حذف المفتاح.');}finally{setSaving(false)}
 }
 return <section className="nabt-ai-settings" dir="rtl">
  <div className="nabt-ai-settings-heading"><div className="nabt-ai-settings-badge"><Bot size={24}/></div><div><span>النظام · الذكاء الاصطناعي</span><h2>إعدادات مساعد نَبْت</h2><p>تحكّمي في Gemini، حدود الأسئلة، ومستوى الوصول للمعلومات دون تعديل الكود.</p></div></div>
  {loading?<div className="nabt-ai-settings-loading"><LoaderCircle className="nabt-ai-spin" size={18}/> جاري تحميل الإعدادات...</div>:settings&&<>
   <div className="nabt-ai-settings-card">
    <div className="nabt-ai-section-row"><div><h3>تشغيل المساعد</h3><p>إظهار وإتاحة الشات للإدارة</p></div><label className="nabt-ai-switch"><input type="checkbox" checked={settings.enabled} onChange={e=>edit('enabled',e.target.checked)}/><span/></label></div>
    <div className="nabt-ai-settings-fields">
     <label>نموذج Gemini<input dir="ltr" value={settings.model} onChange={e=>edit('model',e.target.value)} placeholder="gemini-3.5-flash-lite"/></label>
     <label>عدد أسئلة الأدمن يومياً<input type="number" min={1} max={300} value={settings.admin_daily_limit} onChange={e=>edit('admin_daily_limit',Number(e.target.value))}/></label>
     <label>عدد أسئلة السوبر أدمن يومياً<input type="number" min={1} max={300} value={settings.director_daily_limit} onChange={e=>edit('director_daily_limit',Number(e.target.value))}/></label>
    </div>
    <small className="nabt-ai-helper">يبدأ اليوم الجديد بتوقيت السودان. الحد من 1 إلى 300 سؤال لكل حساب؛ والقيمة الابتدائية 10.</small>
   </div>
   <div className="nabt-ai-settings-card">
    <div className="nabt-ai-card-title"><ShieldCheck size={18}/><div><h3>صلاحيات معلومات المساعد</h3><p>تُطبّق الصلاحيات في الخادم، ولا تُرسل الأسماء أو السجلات الشخصية إلى Gemini.</p></div></div>
    {toggles.map(([field,label,description])=><div className="nabt-ai-section-row" key={field}><div><strong>{label}</strong><p>{description}</p></div><label className="nabt-ai-switch"><input type="checkbox" checked={Boolean(settings[field])} onChange={e=>edit(field,e.target.checked as AiSettings[typeof field])}/><span/></label></div>)}
   </div>
   <div className="nabt-ai-settings-card">
    <div className="nabt-ai-card-title"><KeyRound size={18}/><div><h3>مفاتيح Gemini API</h3><p>يُحفظ المفتاح مشفّراً في Supabase Vault، ولا يُعرض مرة أخرى.</p></div></div>
    {([1,2] as const).map(slot=>{
     const value=slot===1?key1:key2,visible=slot===1?show1:show2,configured=slot===1?settings.key1_configured:settings.key2_configured;
     return <div className="nabt-ai-key-field" key={slot}>
      <div className="nabt-ai-key-label"><strong>{slot===1?'المفتاح الأساسي':'المفتاح الاحتياطي'}</strong><span className={configured?'nabt-ai-tag ready':'nabt-ai-tag'}>{configured?'محفوظ بأمان':'غير مُضاف'}</span></div>
      <div className="nabt-ai-key-input"><input dir="ltr" type={visible?'text':'password'} autoComplete="off" spellCheck={false} value={value} placeholder={configured?'أدخلي مفتاحاً جديداً للاستبدال':'الصقي مفتاح Gemini هنا'} onChange={e=>(slot===1?setKey1:setKey2)(e.target.value)}/><button type="button" className="nabt-ai-show" onClick={()=>slot===1?setShow1(v=>!v):setShow2(v=>!v)}>{visible?'إخفاء':'إظهار'}</button></div>
      <div className="nabt-ai-key-actions"><button type="button" onClick={()=>void saveKey(slot)} disabled={saving||value.trim().length<12}>{configured?'استبدال المفتاح':'حفظ المفتاح'}</button>{configured&&<button type="button" className="nabt-ai-remove" disabled={saving} onClick={()=>void clearKey(slot)}><Trash2 size={14}/> حذف</button>}</div>
     </div>;
    })}
    <p className="nabt-ai-helper">عند خطأ في المفتاح الأول أو بلوغ حدّه تحاول الخدمة المفتاح الاحتياطي. مفتاحان من نفس مشروع Google لا يمنحان حصتين مستقلتين. لا تضعي المفاتيح في GitHub أو المحادثات.</p>
   </div>
   <div className="nabt-ai-settings-actions"><button type="button" className="nabt-ai-save" disabled={saving} onClick={()=>void save()}>{saving?<LoaderCircle size={17} className="nabt-ai-spin"/>:<CheckCircle2 size={17}/>} حفظ إعدادات المساعد</button><button type="button" className="nabt-ai-reload" disabled={saving} onClick={()=>void refresh()}><RotateCcw size={16}/> تحديث</button></div>
  </>}
  {problem&&<p className="nabt-ai-settings-error" role="alert"><AlertCircle size={17}/>{problem}</p>}
  {message&&<p className="nabt-ai-settings-success" role="status"><CheckCircle2 size={17}/>{message}</p>}
 </section>;
}