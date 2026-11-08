-- ============================================================
-- NÔNG TRẠI VUI VẺ — Schema Supabase
-- Chạy script này trong Supabase Dashboard → SQL Editor
-- ============================================================

-- Bảng lưu tiến trình game của từng người chơi
create table if not exists public.farm_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Bật Row Level Security: mỗi user chỉ thấy/save đúng save của mình
alter table public.farm_saves enable row level security;

drop policy if exists "farm_saves_select_own" on public.farm_saves;
drop policy if exists "farm_saves_insert_own" on public.farm_saves;
drop policy if exists "farm_saves_update_own" on public.farm_saves;

create policy "farm_saves_select_own" on public.farm_saves
  for select using (auth.uid() = user_id);

create policy "farm_saves_insert_own" on public.farm_saves
  for insert with check (auth.uid() = user_id);

create policy "farm_saves_update_own" on public.farm_saves
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Xác thực bằng email/mật khẩu (tắt confirm email để người chơi vào game ngay)
-- Supabase Dashboard → Authentication → Providers → Email:
--   • Bật "Confirm email" = OFF (khuyến nghị cho game nhỏ)
