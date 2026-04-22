
-- Enums
create type public.evaluation_type as enum ('chemical', 'noise');
create type public.evaluation_status as enum ('draft', 'in_progress', 'paused', 'completed');

-- Evaluations
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.evaluation_type not null,
  status public.evaluation_status not null default 'draft',
  title text,
  company text,
  worker text,
  estimated_duration_minutes integer not null default 480,
  form_data jsonb not null default '{}'::jsonb,
  worker_signature_url text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index evaluations_user_status_idx on public.evaluations(user_id, status);

alter table public.evaluations enable row level security;

create policy "own select" on public.evaluations for select using (auth.uid() = user_id);
create policy "own insert" on public.evaluations for insert with check (auth.uid() = user_id);
create policy "own update" on public.evaluations for update using (auth.uid() = user_id);
create policy "own delete" on public.evaluations for delete using (auth.uid() = user_id);

-- Time segments
create table public.time_segments (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index time_segments_eval_idx on public.time_segments(evaluation_id);
create index time_segments_open_idx on public.time_segments(evaluation_id) where ended_at is null;

alter table public.time_segments enable row level security;

create policy "ts own select" on public.time_segments for select using (auth.uid() = user_id);
create policy "ts own insert" on public.time_segments for insert with check (auth.uid() = user_id);
create policy "ts own update" on public.time_segments for update using (auth.uid() = user_id);
create policy "ts own delete" on public.time_segments for delete using (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger evaluations_touch before update on public.evaluations
  for each row execute function public.touch_updated_at();

-- Storage bucket for signatures (private)
insert into storage.buckets (id, name, public) values ('signatures', 'signatures', false);

create policy "sig select own" on storage.objects for select
  using (bucket_id = 'signatures' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "sig insert own" on storage.objects for insert
  with check (bucket_id = 'signatures' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "sig update own" on storage.objects for update
  using (bucket_id = 'signatures' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "sig delete own" on storage.objects for delete
  using (bucket_id = 'signatures' and auth.uid()::text = (storage.foldername(name))[1]);
