# بنية نَبْت

- React 19 + TypeScript + Vite، واجهات عربية RTL.
- Supabase Auth وPostgreSQL وRLS، أدوار director/admin/member.
- جلسات وحضور كامل بحالتي present/absent دون تكرار.
- مكتبة معرفية؛ إحصائيات تعتمد على بيانات فعلية.
- PWA قابل للتثبيت وتخزين مؤقت للأصول؛ لا يوجد تسجيل حضور دون اتصال.
- Web Push مخطط لاحقًا عبر VAPID وEdge Functions؛ غير مفعّل حاليًا.
- ممنوع تخزين service_role أو مفاتيح VAPID الخاصة في الواجهة.

## التشغيل

`npm install` ثم `npm run dev` بعد تعيين متغيرات Supabase العامة.

## مراحل تالية

إنشاء العضوات بأمان، تعديل السجلات مع Audit Log، التقارير والتصدير، المهام، إشعارات الأجهزة.
