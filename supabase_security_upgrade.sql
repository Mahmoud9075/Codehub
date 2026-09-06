-- CODE HUB: student grade + parent phone + safe student management
-- Run this once in Supabase SQL Editor before deploying the matching code.

begin;

alter table public.students add column if not exists parent_phone text;
alter table public.students add column if not exists grade_level text;
alter table public.students add column if not exists is_active boolean not null default true;
alter table public.students add column if not exists updated_at timestamptz default now();

alter table public.months add column if not exists grade_level text;

-- Keep legacy rows valid until the admin assigns a grade. New registrations/new months
-- are validated by the server and must use one of these two values.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'students_grade_level_check'
  ) then
    alter table public.students
      add constraint students_grade_level_check
      check (grade_level is null or grade_level in ('first_secondary','second_secondary'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'months_grade_level_check'
  ) then
    alter table public.months
      add constraint months_grade_level_check
      check (grade_level is null or grade_level in ('first_secondary','second_secondary'));
  end if;
end $$;

create index if not exists idx_students_grade_active on public.students(grade_level, is_active);
create index if not exists idx_students_parent_phone on public.students(parent_phone);
create index if not exists idx_months_grade_order on public.months(grade_level, order_index);

commit;

-- IMPORTANT AFTER RUNNING:
-- 1) Open Admin > الطلاب and assign a grade to any old student whose grade is "غير محدد".
-- 2) Open Admin > الشهور والاختبارات and assign a grade to every old month.
-- Unassigned legacy months are intentionally hidden from students to prevent cross-grade access.
