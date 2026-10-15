import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {supabase} from './supabase';
type Profile={id:string;full_name:string;role:'director'|'admin'|'member'};
type Book={id:string;title:string;author:string|null;status:string};
type Session={id:string;session_date:string;study_type:string;book_id:string|null};
type Attendance={session_id:string;member_id:string;status:'present'|'absent'};
const today=()=>new Date(Date.now()+3*3600_000).toISOString().slice(0,10);
const statusLabel=(s:string)=>({planned:'مخطط لها',in_progress:'قيد الدراسة',completed:'مكتملة'}[s]||s);
export default function App(){
 const [uid,setUid]=useState<string|null>(null),[profile,setProfile]=useState<Profile|null>(null);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[notice,setNotice]=useState('');
 const [members,setMembers]=useState<Profile[]>([]),[books,setBooks]=useState<Book[]>([]),[sessions,setSessions]=useState<Session[]>([]),[attendance,setAttendance]=useState<Attendance[]>([]);
 const [date,setDate]=useState(today()),[studyType,setStudyType]=useState('دراسة'),[bookId,setBookId]=useState('');
 const [selected,setSelected]=useState<Record<string,'present'|'absent'>>({});
 const [bookTitle,setBookTitle]=useState(''),[bookAuthor,setBookAuthor]=useState(''),[saving,setSaving]=useState(false);
 const staff=profile?.role==='admin'||profile?.role==='director',director=profile?.role==='director';
 const reload=useCallback(async()=>{
  if(!supabase)return;
  const [m,b,s,a]=await Promise.all([
   supabase.from('profiles').select('id,full_name,role').eq('active',true).order('full_name'),
   supabase.from('books').select('id,title,author,status').order('created_at',{ascending:false}),
   supabase.from('sessions').select('id,session_date,study_type,book_id').order('session_date',{ascending:false}).limit(120),
   supabase.from('attendance').select('session_id,member_id,status')]);
  if(m.error||b.error||s.error||a.error)setNotice('تعذر تحميل بعض البيانات. تحققي من الاتصال والصلاحيات.');
  setMembers((m.data||[]) as Profile[]);setBooks((b.data||[]) as Book[]);setSessions((s.data||[]) as Session[]);setAttendance((a.data||[]) as Attendance[]);
 },[]);
 useEffect(()=>{if(!supabase)return;supabase.auth.getUser().then(({data})=>setUid(data.user?.id??null));
 const {data}=supabase.auth.onAuthStateChange((_event,session)=>setUid(session?.user.id??null));
 return()=>data.subscription.unsubscribe();},[]);
 useEffect(()=>{if(!uid||!supabase){setProfile(null);return;}supabase.from('profiles').select('id,full_name,role').eq('id',uid).single().then(({data})=>setProfile(data as Profile|null));},[uid]);
 useEffect(()=>{if(profile)void reload();},[profile,reload]);
 async function login(e:FormEvent){e.preventDefault();if(!supabase)return setNotice('لم يكتمل إعداد الاتصال');setSaving(true);const {error}=await supabase.auth.signInWithPassword({email,password});setNotice(error?'تعذر تسجيل الدخول: تحققي من البريد وكلمة المرور':'');setSaving(false);}
 async function saveAttendance(e:FormEvent){e.preventDefault();if(!supabase||!staff)return;
 const activeMembers=members.filter(x=>x.role==='member');if(!activeMembers.length)return setNotice('لا توجد عضوات مسجلات');
 if(activeMembers.some(m=>!selected[m.id]))return setNotice('حددي حضور أو غياب لجميع العضوات قبل الحفظ');
 if(date>today())return setNotice('لا يمكن تسجيل جلسة مستقبلية');
 setSaving(true);setNotice('');
 const existing=sessions.find(s=>s.session_date===date&&s.study_type===studyType&&s.book_id===(bookId||null));
 if(existing){setNotice('هذه الجلسة مسجلة مسبقًا. يلزم فتحها للتعديل من شاشة السجلات لاحقًا.');setSaving(false);return;}
 const {data:session,error}=await supabase.from('sessions').insert({session_date:date,study_type:studyType,book_id:bookId||null,created_by:uid}).select('id').single();
 if(error||!session){setNotice('تعذر إنشاء الجلسة: '+(error?.message||''));setSaving(false);return;}
 const rows=activeMembers.map(m=>({session_id:session.id,member_id:m.id,status:selected[m.id],marked_by:uid}));
 const {error:attendanceError}=await supabase.from('attendance').insert(rows);
 if(attendanceError){setNotice('أُنشئت الجلسة ولكن تعذر حفظ بعض الحضور. لا تعيدي إنشاءها؛ تواصلي مع الإدارة. '+attendanceError.message);}else{setNotice('تم تسجيل حضور الجلسة بنجاح');setSelected({});}
 await reload();setSaving(false);
 }
 async function addBook(e:FormEvent){e.preventDefault();if(!supabase||!director)return;setSaving(true);
 const {error}=await supabase.from('books').insert({title:bookTitle.trim(),author:bookAuthor.trim()||null,status:'planned'});
 setNotice(error?'تعذرت إضافة الكتاب: '+error.message:'تمت إضافة الكتاب');if(!error){setBookTitle('');setBookAuthor('');await reload();}setSaving(false);}
 const recorded=sessions.length,attendanceCount=attendance.filter(a=>a.status==='present').length;
 const percent=attendance.length?Math.round(attendanceCount/attendance.length*100):null;
 if(!supabase)return <main className="login"><section className="card"><h1>نَبْت</h1><p>يرجى ضبط متغيرات Supabase قبل التشغيل.</p></section></main>;
 if(!uid)return <main className="login"><section className="card login-card"><div className="brand-symbol">🌱</div><h1>أهلًا بكِ في نَبْت</h1><p>منصة الحضور والمعرفة والإنجاز</p><form onSubmit={login}><label>البريد الإلكتروني<input required type="email" dir="ltr" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>كلمة المرور<input required type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={saving}>تسجيل الدخول</button></form><p role="alert">{notice}</p></section></main>;
 if(!profile)return <main className="login"><section className="card"><h2>تعذر تحميل ملف الحساب</h2><p>تحققي من تفعيل الحساب أو تواصلي مع المديرة.</p><button onClick={()=>supabase.auth.signOut()}>تسجيل الخروج</button></section></main>;
 return <div className="layout"><aside><div className="brand-symbol">🌱</div><h2>نَبْت</h2><p>للمعرفة أثر ينمو</p><nav><a href="#overview">الرئيسية</a>{staff&&<a href="#record">تسجيل الحضور</a>}<a href="#history">السجلات</a><a href="#library">المكتبة المعرفية</a></nav><button className="ghost" onClick={()=>supabase.auth.signOut()}>تسجيل الخروج</button></aside><main className="main"><header className="welcome"><h1>مرحبًا، {profile.full_name||'عضوة نَبْت'} 🌱</h1><p>معًا ننمو بالعلم والاستمرارية</p></header>{notice&&<p role="status" className="notice">{notice}</p>}<section id="overview"><h2>لوحة المتابعة</h2><div className="stats"><article className="card"><span>الجلسات المسجلة</span><strong>{recorded}</strong></article><article className="card"><span>حالات الحضور</span><strong>{attendanceCount}</strong></article><article className="card"><span>نسبة الحضور {staff?'للمجموعة':'الخاصة بكِ'}</span><strong>{percent===null?'—':percent+'%'}</strong></article><article className="card"><span>الكتب</span><strong>{books.length}</strong></article></div></section>{staff&&<section id="record" className="card"><h2>تسجيل الحضور اليومي</h2><form onSubmit={saveAttendance}><div className="fields"><label>تاريخ الجلسة<input type="date" max={today()} value={date} onChange={e=>setDate(e.target.value)} required/></label><label>نوع الدراسة<input value={studyType} onChange={e=>setStudyType(e.target.value)} required/></label><label>الكتاب<select value={bookId} onChange={e=>setBookId(e.target.value)}><option value="">غير مرتبط بكتاب</option>{books.map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select></label></div><div className="roster">{members.filter(m=>m.role==='member').map(m=><div className="member-row" key={m.id}><strong>{m.full_name||'عضوة'}</strong><div className="choice"><label><input type="radio" name={'status-'+m.id} checked={selected[m.id]==='present'} onChange={()=>setSelected(v=>({...v,[m.id]:'present'}))}/> حضرت</label><label><input type="radio" name={'status-'+m.id} checked={selected[m.id]==='absent'} onChange={()=>setSelected(v=>({...v,[m.id]:'absent'}))}/> غابت</label></div></div>)}</div><button disabled={saving||!members.some(m=>m.role==='member')}>حفظ سجل الحضور</button></form></section>}<section id="history" className="card"><h2>الجلسات السابقة</h2>{sessions.length===0?<p>لم تُسجل أي جلسات بعد.</p>:<div className="table-wrap"><table><thead><tr><th>التاريخ</th><th>نوع الدراسة</th><th>الكتاب</th><th>حضرت</th><th>غابت</th></tr></thead><tbody>{sessions.map(s=>{const rows=attendance.filter(a=>a.session_id===s.id);return <tr key={s.id}><td>{s.session_date}</td><td>{s.study_type}</td><td>{books.find(b=>b.id===s.book_id)?.title||'—'}</td><td>{rows.filter(a=>a.status==='present').length}</td><td>{rows.filter(a=>a.status==='absent').length}</td></tr>})}</tbody></table></div>}</section><section id="library" className="card"><h2>المكتبة المعرفية</h2>{director&&<form className="fields" onSubmit={addBook}><label>اسم الكتاب<input required value={bookTitle} onChange={e=>setBookTitle(e.target.value)}/></label><label>المؤلف<input value={bookAuthor} onChange={e=>setBookAuthor(e.target.value)}/></label><button disabled={saving}>إضافة كتاب</button></form>}<div className="book-grid">{books.map(b=><article className="book" key={b.id}><div>📗</div><h3>{b.title}</h3><p>{b.author||'المؤلف غير محدد'}</p><small>{statusLabel(b.status)}</small></article>)}</div>{books.length===0&&<p>لم تتم إضافة كتب بعد.</p>}</section></main></div>;
}
