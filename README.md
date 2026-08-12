# احسم — مساعد القرارات الذكي والمرح

أداة تساعدك تحسم قراراتك اليومية الصغيرة (أكل، ترفيه، تسوق، إدارة وقت) بسرعة وبطريقة ذكية، مع لمسة مرحة — ومع وضع **قرار جماعي** يصوّت فيه أصدقاؤك عبر رابط والنتائج تظهر لحظياً.

📄 التفاصيل الكاملة للفكرة في [PRD.md](PRD.md) · توزيع المهام في [TASKS.md](TASKS.md)

---

## التقنيات

| الطبقة | التقنية |
|---|---|
| الواجهة | React + Vite |
| قاعدة البيانات والحسابات | Supabase (PostgreSQL + Auth) |
| تخزين الصور | Supabase Storage |
| التحديث اللحظي | Supabase Realtime |
| المنطق الخلفي | Supabase Edge Functions |
| النشر | Vercel |

---

## التشغيل من الصفر

### 1. تجهيز Supabase

أنشئ مشروعاً على [supabase.com](https://supabase.com)، ثم افتح **SQL Editor** والصق محتوى [schema.sql](schema.sql) كاملاً واضغط Run. هذا ينشئ:

- الجداول الستة (`profiles`, `decisions`, `options`, `answers`, `votes`, `feedback`)
- سياسات الأمان (RLS)
- تفعيل Realtime على `votes` و `decisions`
- bucket الصور `option-images`

### 2. تشغيل المشروع محلياً

```bash
npm install
```

```bash
npm run dev
```

### 3. متغيرات البيئة

أنشئ ملف `.env` في جذر المشروع (لا يُرفع على Git):

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

تجدها في Supabase → **Settings → API**.

---

## بنية المشروع

```
src/
  supabaseClient.js     تهيئة الاتصال بـ Supabase
  pages/                الشاشات (دخول، إنشاء قرار، نتيجة، تصويت جماعي)
  components/           المكوّنات المشتركة
  lib/scoring.js        خوارزمية الـ Weighted Scoring
supabase/functions/     الـ Edge Functions
schema.sql              الجداول وسياسات RLS
```

---

## المساهمة

لا يُرفع أي شي مباشرة على `main`. كل ميزة على فرع مستقل ثم Pull Request يراجعه شخص آخر من الفريق:

```bash
git checkout -b feature/اسم-الميزة
```

التفاصيل في [TASKS.md](TASKS.md).
