-- =================================================================
-- SUPABASE SCHEMA CHO ỨNG DỤNG QUẢN LÝ CÔNG VIỆC (TODO APP)
-- Hướng dẫn: Mở Supabase Dashboard -> SQL Editor -> Dán đoạn mã này -> Nhấn "Run"
-- =================================================================

-- 1. Tạo bảng todos
create table if not exists public.todos (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    title text not null,
    description text,
    priority int default 2 check (priority in (1, 2, 3)), -- 1: Thấp, 2: TB, 3: Cao
    status text default 'todo' check (status in ('todo', 'in_progress', 'done')),
    image_url text,
    due_date timestamptz,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- 2. Đánh Index tối ưu truy vấn
create index if not exists todos_user_id_idx on public.todos(user_id);
create index if not exists todos_status_idx on public.todos(status);
create index if not exists todos_priority_idx on public.todos(priority);
create index if not exists todos_created_at_idx on public.todos(created_at desc);

-- 3. Bật Row Level Security (Bảo mật theo từng người dùng)
alter table public.todos enable row level security;

-- 4. Tạo các chính sách (Policies) để mỗi user chỉ thấy và thao tác trên việc của mình
drop policy if exists "Users can view own todos" on public.todos;
create policy "Users can view own todos"
    on public.todos for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert own todos" on public.todos;
create policy "Users can insert own todos"
    on public.todos for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update own todos" on public.todos;
create policy "Users can update own todos"
    on public.todos for update
    using (auth.uid() = user_id);

drop policy if exists "Users can delete own todos" on public.todos;
create policy "Users can delete own todos"
    on public.todos for delete
    using (auth.uid() = user_id);

-- 5. Bật tính năng Realtime (an toàn không báo lỗi nếu đã bật)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'todos'
  ) then
    alter publication supabase_realtime add table public.todos;
  end if;
end $$;

-- 6. Tạo Bucket lưu trữ ảnh công việc 'todo-images' (Supabase Storage miễn phí 1GB, không cần thẻ tín dụng)
insert into storage.buckets (id, name, public)
values ('todo-images', 'todo-images', true)
on conflict (id) do update set public = true;

-- Cho phép mọi người xem ảnh công khai
drop policy if exists "Public Access to todo-images" on storage.objects;
create policy "Public Access to todo-images"
    on storage.objects for select
    using (bucket_id = 'todo-images');

-- Cho phép người dùng tải ảnh lên bucket
drop policy if exists "Allow Upload to todo-images" on storage.objects;
create policy "Allow Upload to todo-images"
    on storage.objects for insert
    with check (bucket_id = 'todo-images');

