-- ============================================================
-- Skema database Supabase — Aplikasi Pondasi Dangkal
-- Jalankan di Supabase SQL Editor (urut dari atas).
-- Mencakup: profiles (role), work_items, progress_logs + RLS.
-- ============================================================

-- ---------- 1. Profil pengguna + role ----------
create type user_role as enum ('engineer', 'qc', 'viewer');

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nama        text not null,
  role        user_role not null default 'viewer',
  created_at  timestamptz not null default now()
);

-- Otomatis buat profil saat user baru mendaftar
create function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nama, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'nama', new.email), 'viewer');
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- 2. Item pekerjaan ----------
create table work_items (
  id            uuid primary key default gen_random_uuid(),
  nama          text not null,
  deskripsi     text,
  target_date   date,                       -- tanggal target
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now()
);

-- ---------- 3. Log progress harian ----------
create table progress_logs (
  id              uuid primary key default gen_random_uuid(),
  work_item_id    uuid not null references work_items(id) on delete cascade,
  tanggal         date not null default current_date,
  persen_progress numeric(5,2) check (persen_progress between 0 and 100),
  actual_date     date,                                  -- tanggal aktual
  qc_status       text check (qc_status in ('lolos','tidak','pending')) default 'pending',
  qc_catatan      text,
  created_by      uuid references profiles(id),
  qc_by           uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_progress_work_item on progress_logs(work_item_id);
create index idx_progress_tanggal on progress_logs(tanggal);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
alter table profiles      enable row level security;
alter table work_items    enable row level security;
alter table progress_logs enable row level security;

-- Helper: ambil role user saat ini
create function my_role() returns user_role language sql stable as $$
  select role from profiles where id = auth.uid();
$$;

-- ---------- Policy: profiles ----------
create policy "baca profil sendiri & semua (login)"
  on profiles for select using (auth.uid() is not null);
create policy "update profil sendiri"
  on profiles for update using (auth.uid() = id);

-- ---------- Policy: work_items ----------
-- Semua yang login boleh baca
create policy "semua login baca work_items"
  on work_items for select using (auth.uid() is not null);
-- Engineer boleh buat/ubah work item
create policy "engineer kelola work_items"
  on work_items for all
  using (my_role() = 'engineer')
  with check (my_role() = 'engineer');

-- ---------- Policy: progress_logs ----------
-- Semua yang login boleh baca progress
create policy "semua login baca progress"
  on progress_logs for select using (auth.uid() is not null);

-- Engineer boleh insert progress (% progress, tanggal aktual)
create policy "engineer insert progress"
  on progress_logs for insert
  with check (my_role() = 'engineer');

-- Engineer boleh update baris yang ia buat (kecuali kolom QC)
create policy "engineer update progress sendiri"
  on progress_logs for update
  using (my_role() = 'engineer' and created_by = auth.uid());

-- QC boleh update (mengisi qc_status & qc_catatan) baris mana pun
create policy "qc update status"
  on progress_logs for update
  using (my_role() = 'qc')
  with check (my_role() = 'qc');

-- ============================================================
-- Pembatasan kolom (langkah 4)
-- RLS hanya per-baris, jadi izin per-kolom ditegakkan lewat trigger
-- BEFORE UPDATE berikut:
--   • engineer TIDAK boleh mengubah kolom QC (qc_status, qc_catatan, qc_by)
--   • qc TIDAK boleh mengubah kolom progress milik engineer
--     (persen_progress, tanggal, actual_date, work_item_id, created_by)
-- Role diambil via my_role(); service_role (auth.uid() NULL) tidak dibatasi.
-- ============================================================
create or replace function enforce_progress_columns()
returns trigger language plpgsql as $$
declare
  r user_role := my_role();
begin
  if r = 'engineer' then
    if new.qc_status  is distinct from old.qc_status
    or new.qc_catatan is distinct from old.qc_catatan
    or new.qc_by      is distinct from old.qc_by then
      raise exception 'Engineer tidak boleh mengubah kolom QC (qc_status/qc_catatan).';
    end if;
  elsif r = 'qc' then
    if new.persen_progress is distinct from old.persen_progress
    or new.tanggal         is distinct from old.tanggal
    or new.actual_date     is distinct from old.actual_date
    or new.work_item_id    is distinct from old.work_item_id
    or new.created_by      is distinct from old.created_by then
      raise exception 'QC hanya boleh mengisi qc_status & qc_catatan, bukan kolom progress.';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_enforce_progress_columns on progress_logs;
create trigger trg_enforce_progress_columns
  before update on progress_logs
  for each row execute function enforce_progress_columns();

-- ============================================================
-- 4. Desain pondasi tersimpan (langkah 5)
-- Menyimpan input (foundation/soil/load_cases) + snapshot hasil,
-- opsional ditautkan ke work_items. JSONB agar fleksibel terhadap
-- penambahan parameter (lihat skema dataclass di backend).
-- ============================================================
create table foundation_designs (
  id           uuid primary key default gen_random_uuid(),
  nama         text not null,
  work_item_id uuid references work_items(id) on delete set null,
  foundation   jsonb not null,
  soil         jsonb not null,
  load_cases   jsonb not null,
  result       jsonb,
  overall_ok   boolean,
  created_by   uuid references profiles(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_designs_created_by on foundation_designs(created_by);
create index idx_designs_work_item on foundation_designs(work_item_id);

alter table foundation_designs enable row level security;

-- Semua yang login boleh membaca desain
create policy "semua login baca designs"
  on foundation_designs for select using (auth.uid() is not null);
-- User mengelola desain miliknya sendiri (simpan/ubah/hapus)
create policy "user simpan design sendiri"
  on foundation_designs for insert with check (auth.uid() = created_by);
create policy "user ubah design sendiri"
  on foundation_designs for update using (auth.uid() = created_by) with check (auth.uid() = created_by);
create policy "user hapus design sendiri"
  on foundation_designs for delete using (auth.uid() = created_by);
