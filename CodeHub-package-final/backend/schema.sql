-- ============================================================
-- Code Hub — قاعدة بيانات المسار الشهري (اختبارات الطلاب)
-- شغّل الملف ده في Supabase: SQL Editor > New query > الصق والصق Run
-- ============================================================

-- جدول الطلاب
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text unique not null,
  email text unique not null,
  password_hash text not null,
  avatar_url text,
  phone_verified boolean not null default false,
  parent_token uuid not null default gen_random_uuid(), -- لينك متابعة ولي الأمر (سري، محدش يعرفه غير الطالب وولي أمره)
  created_at timestamptz default now()
);
create unique index if not exists idx_students_parent_token on students(parent_token);

-- أكواد تحقق رقم الموبايل (SMS OTP)
create table if not exists phone_otps (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  used boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_phone_otp_student on phone_otps(student_id);

-- أكواد استرجاع الباسورد (لما الطالب ينسى باسورده)
create table if not exists password_resets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  used boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_resets_student on password_resets(student_id);

-- جدول الشهور
create table if not exists months (
  id uuid primary key default gen_random_uuid(),
  name text not null,           -- مثال: ديسمبر
  order_index int not null      -- ترتيب الشهر (1 = أول شهر بيفتح)
);

-- جدول الكويزات: 8 كويزات أسبوعية لكل شهر + اختبار نهائي واحد في آخر كل شهر
create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  month_id uuid references months(id) on delete cascade,
  type text not null default 'weekly',  -- 'weekly' (كويز أسبوعي) أو 'final' (اختبار نهائي الشهر)
  week_number int,                   -- 1 إلى 4 (فاضي للاختبار النهائي)
  quiz_number_in_week int,           -- 1 أو 2 (فاضي للاختبار النهائي)
  title text not null,
  order_index int not null           -- ترتيب الكويز جوه الشهر — بيتحكم في الفتح التلقائي بين الكويزات الأسبوعية
);

-- جدول النتائج (كل مرة طالب يخلص كويز بيتسجل هنا سطر)
create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  quiz_id uuid references quizzes(id) on delete cascade,
  score int not null,
  total int not null,
  completed_at timestamptz default now(),
  unique (student_id, quiz_id)   -- الطالب ياخد نتيجة واحدة لكل كويز (آخر محاولة)
);

-- فهارس تسريع
create index if not exists idx_quizzes_month on quizzes(month_id);
create index if not exists idx_results_student on results(student_id);
create index if not exists idx_results_quiz on results(quiz_id);

-- ============================================================
-- لوحة التحكم (Admin Dashboard) — الجداول الجديدة
-- ============================================================

-- أسئلة كل كويز (السؤال، الاختيارات، الإجابة الصح)
create table if not exists quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id) on delete cascade,
  question_text text not null,
  options jsonb not null,        -- مثال: ["اختيار 1", "اختيار 2", "اختيار 3", "اختيار 4"]
  correct_index int not null,    -- رقم الاختيار الصح (0 = الأول)
  order_index int not null default 1,
  created_at timestamptz default now()
);
create index if not exists idx_questions_quiz on quiz_questions(quiz_id);

-- إعدادات الموقع (صف واحد بس: وضع الصيانة + الأقسام المخفية)
create table if not exists site_settings (
  id int primary key default 1,
  maintenance_mode boolean not null default false,
  hidden_sections jsonb not null default '[]',  -- مثال: ["benefits", "monthly-path"]
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);
insert into site_settings (id, maintenance_mode, hidden_sections)
values (1, false, '[]')
on conflict (id) do nothing;

-- الأدمن الإضافي اللي بيدخل بجيميله (إنت بتدخل برقم سري منفصل، مش من هنا)
create table if not exists admin_emails (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  added_at timestamptz default now()
);
-- إيميل محمود متسجل جاهز من الأول، هيقدر يدخل بحساب Google على طول
insert into admin_emails (email) values ('mahmoudibrahim9075@gmail.com')
on conflict (email) do nothing;

-- ============================================================
-- الأدمن الرئيسي (Super Admin) — بيدخل بكود تحقق من 6 أرقام يوصله على إيميله
-- بيقدر يتحكم في كل حاجة في الموقع (زي أي أدمن تاني بالظبط، بس طريقة دخوله مختلفة ومخصصة له)
-- ============================================================
create table if not exists super_admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  added_at timestamptz default now()
);
insert into super_admins (email) values ('mahmoudibrahim9075@gmail.com')
on conflict (email) do nothing;
insert into super_admins (email) values ('mohamed.raslan1022@gmail.com')
on conflict (email) do nothing;

-- أكواد تسجيل دخول الأدمن الرئيسي (كود مؤقت، صالح 10 دقايق)
create table if not exists super_admin_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,
  expires_at timestamptz not null,
  used boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_super_otp_email on super_admin_otps(email);

-- ============================================================
-- سجل تدقيق الأدمن (Audit Log) — مين عدّل إيه ومتى
-- ============================================================
create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_identity text not null,   -- إيميل الأدمن، أو "PIN" لو دخل بالرقم السري
  action text not null,           -- مثال: 'update_settings', 'add_question', 'delete_question'
  details jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_audit_time on admin_audit_log(created_at);

-- تتبّع محاولات الدخول الغلط (بالرقم السري للأدمن، أو باسورد الطالب) عشان نمنع التخمين العشوائي
create table if not exists login_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  context text not null default 'admin_pin', -- 'admin_pin' أو 'student_login'
  attempted_at timestamptz default now()
);
create index if not exists idx_login_attempts_ip on login_attempts(ip, context, attempted_at);
create table if not exists page_visits (
  id uuid primary key default gen_random_uuid(),
  page text not null,             -- مثال: 'home', 'monthly-path', 'about-me'
  ip text,                        -- عشان نمنع تكرار التسجيل بسرعة من نفس الجهاز
  visited_at timestamptz default now()
);
create index if not exists idx_visits_page on page_visits(page);
create index if not exists idx_visits_time on page_visits(visited_at);

-- ============================================================
-- تعبئة الشهور (8 شهور بالظبط زي ما طلبت)
-- ============================================================
insert into months (name, order_index) values
  ('أكتوبر', 1),
  ('نوفمبر', 2),
  ('ديسمبر', 3),
  ('يناير', 4),
  ('فبراير', 5),
  ('مارس', 6),
  ('أبريل', 7),
  ('مايو', 8)
on conflict do nothing;

-- ============================================================
-- تعبئة الكويزات: 8 كويزات أسبوعية + اختبار نهائي واحد لكل شهر
-- ============================================================
do $$
declare
  m record;
  w int;
  q int;
  ord int;
begin
  for m in select id, name from months loop
    ord := 1;
    for w in 1..4 loop
      for q in 1..2 loop
        insert into quizzes (month_id, type, week_number, quiz_number_in_week, title, order_index)
        values (
          m.id,
          'weekly',
          w,
          q,
          'كويز الأسبوع ' || w || ' - رقم ' || q || ' (' || m.name || ')',
          ord
        )
        on conflict do nothing;
        ord := ord + 1;
      end loop;
    end loop;
    -- الاختبار النهائي للشهر — بيتفتح بعد ما الطالب يخلّص كل الكويزات الأسبوعية
    insert into quizzes (month_id, type, title, order_index)
    values (m.id, 'final', 'الاختبار النهائي - ' || m.name, 99)
    on conflict do nothing;
  end loop;
end $$;

-- ============================================================
-- نسبة النجاح المطلوبة في الاختبار النهائي عشان الشهر اللي بعده يتفتح
-- ============================================================
alter table site_settings add column if not exists final_exam_pass_percent int not null default 70;

-- ============================================================
-- إدارة نصوص الموقع (Content Management) — من لوحة التحكم
-- ============================================================

-- النصوص الحالية (كل نص ليه مفتاح ثابت، وقسم يتبع له عشان ينعرض مرتّب في اللوحة)
create table if not exists site_content (
  key text primary key,           -- مثال: 'hero-title', 'benefits-1-title'
  section text not null,          -- مثال: 'hero', 'benefits', 'footer'
  label text not null,            -- اسم واضح يبان في اللوحة، مثال: "عنوان الهيرو الرئيسي"
  value text not null,
  updated_at timestamptz default now()
);

-- سجل كل تعديل حصل، عشان تقدر ترجع لنسخة قديمة لو غلطت
create table if not exists site_content_history (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  old_value text,
  new_value text,
  changed_by text,               -- إيميل الأدمن أو "PIN"
  changed_at timestamptz default now()
);
create index if not exists idx_content_history_key on site_content_history(key, changed_at);

-- ============================================================
-- المساعد الذكي (الشات) — قاعدة المعرفة + سجل الأسئلة
-- ============================================================

-- قاعدة المعرفة: كل قطعة منهج (درس/جزء) بيضيفها الأدمن، والمساعد بيستخدمها كمرجع أساسي
create table if not exists ai_knowledge (
  id uuid primary key default gen_random_uuid(),
  title text not null,        -- مثال: "دراسة المعلومات - الدرس الأول"
  content text not null,      -- نص الدرس (يقدر الأدمن يلزق فيه أي محتوى)
  order_index int not null default 0,
  updated_at timestamptz default now()
);

-- سجل أسئلة الطلاب — عشان اللوحة توريك أكتر الأسئلة تكرارًا (فكرة رقم 8)
create table if not exists ai_chat_log (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete set null,
  question text not null,
  answer_source text,          -- 'knowledge_base' أو 'general_knowledge'
  created_at timestamptz default now()
);
create index if not exists idx_ai_chat_log_created on ai_chat_log(created_at);

-- محادثات المساعد الذكي المحفوظة — عشان الطالب يقدر يرجع لأي محادثة قديمة
create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  title text not null default 'محادثة جديدة',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_ai_conversations_student on ai_conversations(student_id, updated_at desc);

-- تعبئة أولية بأهم نصوص الموقع (عشان اللوحة تبقى شغالة من أول لحظة)
insert into site_content (key, section, label, value) values
  ('hero-title', 'hero', 'العنوان الرئيسي (الجزء العادي)', 'اتعلّم البرمجة والذكاء الاصطناعي'),
  ('hero-title-mark', 'hero', 'العنوان الرئيسي (الجزء المظلّل)', 'من الصفر للاحتراف'),
  ('hero-subtitle', 'hero', 'الوصف تحت العنوان', 'Code Hub هي منصة تعليمية خاصة متخصصة في تدريس مادة البرمجة والذكاء الاصطناعي لطلاب الصف الأول والثاني الثانوي، بطريقة مبسطة وعملية تساعد الطالب على الفهم والتطبيق وتحقيق أعلى الدرجات.'),
  ('free-badge', 'hero', 'بادچ الحصص المجانية', 'أول حصتين مجانًا تمامًا لكل الطلاب'),
  ('benefits-heading', 'benefits', 'عنوان قسم المميزات', 'ماذا ستحصل عليه؟'),
  ('cta-eyebrow', 'cta', 'السطر الصغير فوق عنوان الاشتراك', 'ابدأ النهارده · تقدر تلغي في أي وقت'),
  ('cta-heading', 'cta', 'عنوان قسم الاشتراك', 'مستقبلك بيبدأ بكود واحد. مع Code Hub هتكون في أمان.'),
  ('prize-badge', 'cta', 'بادچ الجوائز الشهرية', 'جوائز شهرية للطلاب المتفوقين'),
  ('countdown-label', 'cta', 'نص عداد الترم', 'الترم الجديد يبدأ خلال'),
  ('mp-teaser-heading', 'monthly-path', 'عنوان كارت المسار الشهري', 'مسار الشهر'),
  ('mp-teaser-text', 'monthly-path', 'وصف كارت المسار الشهري', 'كويزاتك مرتبة شهر شهر، كل ما تخلّص كويز اللي بعده يفتح تلقائي.'),
  ('about-tagline', 'about', 'شعار قسم عن المنصة', 'مستقبل التعليم يبدأ من هنا'),
  ('about-paragraph-1', 'about', 'الفقرة الأولى', 'Code Hub هي أول منصة تعليمية متخصصة في تدريس مادة البرمجة والذكاء الاصطناعي لطلاب الصف الأول والثاني الثانوي في مصر، برؤية تجمع بين جودة التعليم، والتكنولوجيا الحديثة، والذكاء الاصطناعي، لتقديم تجربة تعليمية تفاعلية تساعد الطالب على تحقيق التفوق الحقيقي.'),
  ('reviews-heading', 'reviews', 'عنوان قسم التقييمات', 'آراء طلابنا'),
  ('footer-address', 'footer', 'العنوان', 'البحيرة - أبو حمص - شارع 10 - المدخل الثالث شمال - الطابق الثاني فوق سمارت أكاديمي'),
  ('footer-tagline', 'footer', 'شعار الفوتر', 'بنعلّم البرمجة والذكاء الاصطناعي بشغف.'),
  ('footer-credit', 'footer', 'سطر الحقوق', 'صُنع بشغف بواسطة Code Hub © 2026')
on conflict (key) do nothing;
