// Secure permanent NABT account deletion. Never expose service-role credentials to the browser.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return respond(405, { error: "الطريقة غير مدعومة." });

  const url = Deno.env.get("SUPABASE_URL");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !secret) return respond(500, { error: "إعدادات خادم الحذف غير مكتملة." });

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return respond(401, { error: "يجب تسجيل الدخول." });

  const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const caller = authData.user;
    if (authError || !caller) return respond(401, { error: "الجلسة غير صالحة، يرجى تسجيل الدخول مجددًا." });

    const { data: operator, error: operatorError } = await admin.from("profiles")
      .select("role, active").eq("id", caller.id).single();
    if (operatorError || operator?.role !== "director" || operator.active === false)
      return respond(403, { error: "حذف الحسابات متاح للمديرة فقط." });

    const body = await req.json().catch(() => null) as { userId?: unknown; confirmation?: unknown } | null;
    const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
    const confirmation = typeof body?.confirmation === "string" ? body.confirmation.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId))
      return respond(400, { error: "معرّف الحساب غير صالح." });
    if (userId === caller.id) return respond(403, { error: "لا يمكنك حذف حسابك الحالي." });

    const { data: target, error: targetError } = await admin.from("profiles")
      .select("id, full_name, role").eq("id", userId).single();
    if (targetError || !target) return respond(404, { error: "الحساب غير موجود أو تم حذفه بالفعل." });
    if (target.role === "director") return respond(403, { error: "لا يمكن حذف حساب المديرة من هذه الشاشة." });
    if (!confirmation || confirmation !== (target.full_name || "").trim())
      return respond(400, { error: "اكتبي الاسم الكامل للحساب كما يظهر لتأكيد الحذف." });

    // Delete member-owned avatar files before deleting the auth record.
    // Storage paths use the user's UUID as their first folder.
    const bucket = admin.storage.from("nabt-avatars");
    const { data: objects, error: listError } = await bucket.list(userId, { limit: 1000 });
    if (listError) return respond(500, { error: "تعذر فحص الصور المرتبطة بالحساب: " + listError.message });
    const files = (objects || []).filter(item => item.name && item.id).map(item => userId + "/" + item.name);
    if (files.length) {
      const { error: storageError } = await bucket.remove(files);
      if (storageError) return respond(500, { error: "تعذر حذف الصورة الشخصية: " + storageError.message });
    }

    // auth.users -> profiles -> attendance/session_responses CASCADE.
    // Shared sessions and announcements have nullable creator FKs with ON DELETE SET NULL.
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId, false);
    if (deleteError) return respond(500, { error: "تعذر حذف حساب الدخول: " + deleteError.message });
    return respond(200, { success: true, message: "تم حذف الحساب وبياناته الشخصية وسجلاته المرتبطة نهائيًا." });
  } catch (error) {
    return respond(500, { error: "حدث خطأ أثناء حذف الحساب: " + (error instanceof Error ? error.message : "خطأ غير معروف") });
  }
});
