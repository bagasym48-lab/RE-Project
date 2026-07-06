-- ============================================================
-- Skema database Supabase — Aplikasi Pondasi Dangkal
-- Jalankan di Supabase SQL Editor (urut dari atas).
-- Mencakup: profiles (role), work_items, progress_logs + RLS.
-- ============================================================

-- ---------- 1. Profil pengguna + role ----------
create type user_role as enum ('engineer', 'qc', 'viewer', 'leader');
-- leader = sama seperti engineer + boleh MENGHAPUS project.

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

-- ============================================================
-- 5. Project & dokumen (langkah 7)
-- Alur: engineer membuat project (otomatis 5 dokumen) → engineer "kirim"
-- tiap dokumen → QC "ACC"/"revisi". Progress project = jumlah dokumen ACC
-- dibagi total dokumen × 100%.
-- ============================================================
create table projects (
  id          uuid primary key default gen_random_uuid(),
  nama        text not null,
  deskripsi   text,
  target_date date,                              -- deadline project (untuk garis rencana kurva-S)
  created_by  uuid references profiles(id) default auth.uid(),
  created_at  timestamptz not null default now()
);
-- Bila tabel projects sudah pernah dibuat tanpa kolom ini, jalankan:
--   alter table projects add column if not exists target_date date;

create table project_documents (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  nama           text not null,
  urutan         int  not null default 0,
  status         text not null default 'todo'
                   check (status in ('todo','submitted','acc','revisi')),
  submit_catatan text,                                        -- catatan/link dokumen (engineer)
  design_id      uuid references foundation_designs(id) on delete set null,
  submitted_by   uuid references profiles(id),
  submitted_at   timestamptz,
  qc_catatan     text,                                        -- catatan QC
  qc_by          uuid references profiles(id),
  qc_at          timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_pdoc_project on project_documents(project_id);

alter table projects          enable row level security;
alter table project_documents enable row level security;

-- projects: semua login baca; HANYA LEAD yang boleh membuat/mengubah/menghapus
-- project. Engineer hanya: update progress (submit dokumen), catatan kendala.
-- CATATAN MIGRASI (DB live): jalankan ulang blok policy ini di Supabase SQL
-- Editor — drop policy lama (nama engineer/leader) sudah disertakan di bawah.
drop policy if exists "semua login baca projects" on projects;
create policy "semua login baca projects"
  on projects for select using (auth.uid() is not null);
drop policy if exists "buat projects (engineer/leader)" on projects;
drop policy if exists "buat projects (leader)" on projects;
create policy "buat projects (leader)"
  on projects for insert with check (my_role() = 'leader');
drop policy if exists "ubah projects (engineer/leader)" on projects;
drop policy if exists "ubah projects (leader)" on projects;
create policy "ubah projects (leader)"
  on projects for update
  using (my_role() = 'leader') with check (my_role() = 'leader');
drop policy if exists "hapus projects (leader)" on projects;
create policy "hapus projects (leader)"
  on projects for delete using (my_role() = 'leader');

-- project_documents: dokumen dibuat/dihapus bersama project (hak lead).
-- Engineer tetap boleh UPDATE (submit laporan); QC tetap ACC/revisi.
drop policy if exists "semua login baca pdoc" on project_documents;
create policy "semua login baca pdoc"
  on project_documents for select using (auth.uid() is not null);
drop policy if exists "insert pdoc (engineer/leader)" on project_documents;
drop policy if exists "insert pdoc (leader)" on project_documents;
create policy "insert pdoc (leader)"
  on project_documents for insert with check (my_role() = 'leader');
drop policy if exists "update pdoc (engineer/leader)" on project_documents;
create policy "update pdoc (engineer/leader)"
  on project_documents for update
  using (my_role() in ('engineer','leader')) with check (my_role() in ('engineer','leader'));
drop policy if exists "hapus pdoc (engineer/leader)" on project_documents;
drop policy if exists "hapus pdoc (leader)" on project_documents;
create policy "hapus pdoc (leader)"
  on project_documents for delete using (my_role() = 'leader');
drop policy if exists "qc update pdoc" on project_documents;
create policy "qc update pdoc"
  on project_documents for update
  using (my_role() = 'qc') with check (my_role() = 'qc');

-- Pembatasan per-role lewat trigger (mirip enforce_progress_columns):
--   • engineer TIDAK boleh meng-ACC/revisi atau mengubah kolom QC
--   • qc TIDAK boleh mengubah isi/submission dokumen, hanya ACC/revisi + catatan
create or replace function enforce_pdoc_columns()
returns trigger language plpgsql as $$
declare r user_role := my_role();
begin
  if r in ('engineer','leader') then
    if new.status in ('acc','revisi') and new.status is distinct from old.status then
      raise exception 'Engineer/leader tidak boleh meng-ACC/revisi dokumen (hak QC).';
    end if;
    if new.qc_catatan is distinct from old.qc_catatan
    or new.qc_by      is distinct from old.qc_by
    or new.qc_at      is distinct from old.qc_at then
      raise exception 'Engineer tidak boleh mengubah kolom QC.';
    end if;
  elsif r = 'qc' then
    if new.status not in ('acc','revisi') and new.status is distinct from old.status then
      raise exception 'QC hanya boleh meng-ACC atau revisi dokumen.';
    end if;
    if new.nama           is distinct from old.nama
    or new.submit_catatan is distinct from old.submit_catatan
    or new.design_id      is distinct from old.design_id
    or new.submitted_by   is distinct from old.submitted_by
    or new.submitted_at   is distinct from old.submitted_at
    or new.project_id     is distinct from old.project_id then
      raise exception 'QC tidak boleh mengubah isi/submission dokumen.';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_enforce_pdoc on project_documents;
create trigger trg_enforce_pdoc
  before update on project_documents
  for each row execute function enforce_pdoc_columns();

-- ============================================================
-- 6. Riwayat dokumen + komentar/kendala project (langkah 8)
-- Jalankan blok ini di Supabase SQL Editor (aman diulang / idempotent).
--   6a. project_document_events — jejak tiap transisi status dokumen
--       (kirim → ACC/revisi) agar terlihat "sudah direvisi berapa kali".
--   6b. project_comments — catatan kendala per project untuk kurva-S,
--       ditulis engineer/leader, dibaca semua (khususnya leader).
-- ============================================================

-- ---------- 6a. Riwayat/log dokumen ----------
create table if not exists project_document_events (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references project_documents(id) on delete cascade,
  project_id   uuid references projects(id) on delete cascade,
  status       text not null check (status in ('submitted','acc','revisi')),
  catatan      text,                                   -- submit_catatan / qc_catatan saat itu
  actor        uuid references profiles(id),           -- yang melakukan aksi
  created_at   timestamptz not null default now()
);
create index if not exists idx_pdoc_events_doc on project_document_events(document_id);
create index if not exists idx_pdoc_events_project on project_document_events(project_id);

alter table project_document_events enable row level security;
drop policy if exists "semua login baca pdoc events" on project_document_events;
create policy "semua login baca pdoc events"
  on project_document_events for select using (auth.uid() is not null);
-- Catatan: insert HANYA lewat trigger security-definer di bawah (tak ada policy insert
-- langsung), supaya riwayat tak bisa dipalsukan dari klien.

-- Trigger: catat event otomatis saat status dokumen berubah.
create or replace function log_pdoc_event()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'UPDATE'
     and new.status is distinct from old.status
     and new.status in ('submitted','acc','revisi') then
    insert into public.project_document_events(document_id, project_id, status, catatan, actor)
    values (
      new.id, new.project_id, new.status,
      case when new.status = 'submitted' then new.submit_catatan else new.qc_catatan end,
      case when new.status = 'submitted' then new.submitted_by  else new.qc_by end
    );
  end if;
  return new;
end; $$;

drop trigger if exists trg_log_pdoc_event on project_documents;
create trigger trg_log_pdoc_event
  after update on project_documents
  for each row execute function log_pdoc_event();

-- ---------- 6b. Komentar/kendala per project (untuk kurva-S) ----------
create table if not exists project_comments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  catatan     text not null,
  kategori    text not null default 'umum'
                check (kategori in ('umum','tunggu_disiplin','data_vendor','kendala_teknis','lainnya')),
  created_by  uuid references profiles(id) default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists idx_pcomments_project on project_comments(project_id);

alter table project_comments enable row level security;
drop policy if exists "semua login baca komentar" on project_comments;
create policy "semua login baca komentar"
  on project_comments for select using (auth.uid() is not null);
drop policy if exists "engineer/leader tulis komentar" on project_comments;
create policy "engineer/leader tulis komentar"
  on project_comments for insert
  with check (my_role() in ('engineer','leader') and auth.uid() = created_by);
drop policy if exists "hapus komentar sendiri" on project_comments;
create policy "hapus komentar sendiri"
  on project_comments for delete using (auth.uid() = created_by);
