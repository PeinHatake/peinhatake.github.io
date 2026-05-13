-- Chạy file này trong Supabase Dashboard > SQL Editor.
-- Sau đó vào Authentication > Users để tạo tài khoản admin của bạn.

create extension if not exists "pgcrypto";

create table if not exists public.profile (
  id integer primary key default 1,
  name text not null default 'Tên của bạn',
  headline text default 'Concept Artist / Illustrator / Game UI Designer',
  bio text default 'Viết mô tả cá nhân của bạn tại trang Admin.',
  avatar_url text,
  location text,
  email text,
  socials jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

insert into public.profile (
  id,
  name,
  headline,
  bio,
  avatar_url,
  location,
  email,
  socials
)
values (
  1,
  'Tên của bạn',
  'Concept Artist / Illustrator / Game UI Designer',
  'Viết mô tả cá nhân của bạn tại trang Admin.',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=600&auto=format&fit=crop',
  'Vietnam',
  'your@email.com',
  '{"artstation":"https://artstation.com/","github":"https://github.com/","facebook":"","website":""}'::jsonb
)
on conflict (id) do nothing;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text not null,
  tags text[] not null default '{}',
  external_url text,
  created_at timestamptz not null default now()
);

alter table public.profile enable row level security;
alter table public.projects enable row level security;

drop policy if exists "Public can read profile" on public.profile;
create policy "Public can read profile"
on public.profile
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated can manage profile" on public.profile;
create policy "Authenticated can manage profile"
on public.profile
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read projects" on public.projects;
create policy "Public can read projects"
on public.projects
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated can manage projects" on public.projects;
create policy "Authenticated can manage projects"
on public.projects
for all
to authenticated
using (true)
with check (true);

-- Tạo bucket public để ảnh có thể hiển thị ngoài trang gallery.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'portfolio-images',
  'portfolio-images',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read portfolio images" on storage.objects;
create policy "Public can read portfolio images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'portfolio-images');

drop policy if exists "Authenticated can upload portfolio images" on storage.objects;
create policy "Authenticated can upload portfolio images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'portfolio-images');

drop policy if exists "Authenticated can update portfolio images" on storage.objects;
create policy "Authenticated can update portfolio images"
on storage.objects
for update
to authenticated
using (bucket_id = 'portfolio-images')
with check (bucket_id = 'portfolio-images');

drop policy if exists "Authenticated can delete portfolio images" on storage.objects;
create policy "Authenticated can delete portfolio images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'portfolio-images');
