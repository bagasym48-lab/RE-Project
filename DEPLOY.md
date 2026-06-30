# Deploy — RE-Project (Kalkulasi & Monitoring Pondasi)

Tiga komponen:

- **Supabase** — sudah di cloud (DB + Auth). Tidak perlu deploy.
- **Backend FastAPI** — deploy ke **Vercel** (Python Functions, Hobby tier — gratis, **tanpa verifikasi kartu**).
- **Frontend Vite/React** — deploy ke **Vercel** juga, sebagai project terpisah di akun yang sama.

Dua project Vercel terpisah (bukan satu URL gabungan) — ini paling stabil dan tidak butuh
restrukturisasi folder apa pun, karena Vercel **otomatis mendeteksi** `backend/main.py` sebagai
FastAPI app (nama file `main.py` + variabel `app` sudah sesuai konvensi Vercel Python Runtime).
Konsekuensinya cuma satu: backend & frontend beda domain, jadi **CORS** tetap perlu di-set (sudah
didukung kode lewat env var `CORS_ORIGINS`).

Urutan penting (ada saling-tunjuk URL): **backend dulu** → **frontend** (set `VITE_API_URL`) →
**set `CORS_ORIGINS` backend** = URL frontend → **set Site URL Supabase**.

---

## 0. Push ke GitHub
Vercel deploy dari Git. Dari root proyek:

```bash
git config --global user.name "Nama Anda"
git config --global user.email "email-anda@contoh.com"

git init
git add .
git commit -m "RE-Project: kalkulator + monitoring pondasi"
git branch -M main
git remote add origin https://github.com/USERNAME-ANDA/NAMA-REPO.git
git push -u origin main
```

Ganti `USERNAME-ANDA/NAMA-REPO` dengan repo **asli** yang sudah Anda buat di github.com/new
(jangan centang "Add README" saat membuat, supaya tidak konflik).

`.gitignore` sudah menutup `.env`, `.venv/`, `node_modules/`, `dist/` — kredensial & artefak tidak
ikut ter-push.

## 1. Backend → Vercel
1. [vercel.com](https://vercel.com) → **Add New → Project** → import repo yang sama.
2. **Root Directory:** `backend`. Vercel akan menampilkan preset **FastAPI / Other Python** —
   pakai default yang terdeteksi (jangan pilih preset frontend).
3. **Build & Output:** biarkan kosong/default — tidak perlu Build Command. Vercel otomatis:
   - install dependensi dari `backend/requirements.txt`,
   - mengenali `backend/main.py` (nama file ini ada di daftar entrypoint resmi Vercel) dan
     variabel `app` di dalamnya sebagai Function tunggal yang menangani semua rute FastAPI
     (`/health`, `/calculate`, `/docs`),
   - memakai Python 3.12 (dipin lewat `backend/.python-version`).
4. **Environment Variables:** belum perlu isi apa-apa di langkah ini (`CORS_ORIGINS` diisi nanti
   di langkah 3, setelah tahu URL frontend).
5. Deploy → dapat URL, mis. `https://pondasi-backend.vercel.app`.
6. Cek `…/health` → `{"status":"ok"}` dan `…/docs` untuk Swagger UI.

> Tidak perlu kartu kredit di langkah ini — Hobby tier Vercel gratis penuh untuk pola pakai ini.

## 2. Frontend → Vercel
**Add New → Project** lagi (project kedua, repo yang sama) →
- **Root Directory:** `frontend`
- **Framework:** Vite (terdeteksi otomatis) · **Build:** `npm run build` · **Output:** `dist`
- **Environment Variables:**
  | Key | Value |
  |---|---|
  | `VITE_API_URL` | URL backend dari langkah 1, mis. `https://pondasi-backend.vercel.app` |
  | `VITE_SUPABASE_URL` | `https://lpfxxeranacbdmrapksu.supabase.co` |
  | `VITE_SUPABASE_ANON_KEY` | `<anon key dari frontend/.env>` |

Deploy → dapat URL, mis. `https://re-project.vercel.app`.

> Variabel `VITE_*` di-*bake* saat build. Kalau URL backend berubah → **redeploy** project frontend.

## 3. Sambungkan CORS (backend ← frontend)
Project **backend** di Vercel → **Settings → Environment Variables** → tambah:
- `CORS_ORIGINS` = `https://re-project.vercel.app`
  (boleh banyak, pisah koma: `https://re-project.vercel.app,http://localhost:5173`)

Simpan → buka tab **Deployments** → **Redeploy** deployment terakhir (env var baru tidak otomatis
ter-apply ke deployment lama). Tanpa langkah ini, tombol Hitung kena blok CORS di browser.

## 4. Supabase Auth URL
Supabase → **Authentication → URL Configuration**:
- **Site URL** = `https://re-project.vercel.app`
- **Redirect URLs** = tambah `https://re-project.vercel.app/**`

Agar link verifikasi email mengarah ke situs produksi, bukan localhost. (Atau matikan "Confirm
email" untuk testing cepat.)

## 5. Selesai
Buka URL frontend Vercel di **HP/laptop siapa pun, di mana saja**. Daftar/login → kalkulator,
progress, simpan desain.

---

## Riwayat: Railway & Render (gagal di verifikasi kartu)
Sempat dicoba sebelum pindah ke Vercel — keduanya minta verifikasi kartu (otorisasi kecil,
biasanya tidak ditagih) dan kartu yang dicoba ditolak di kedua platform. Filenya masih ada di
repo (`backend/railway.json`, `backend/Procfile`, `backend/runtime.txt`, `render.yaml` di root)
sebagai fallback terdokumentasi kalau suatu saat ingin dicoba lagi dengan kartu lain — tidak
dipakai oleh jalur Vercel di atas, aman dibiarkan menganggur.

## Kalau ingin satu domain gabungan (opsional, lebih kompleks)
Vercel punya fitur **Services** (`experimentalServices` di `vercel.json`) untuk menjalankan
frontend & backend sebagai satu project, satu domain (mis. `/server/*` → backend Python,
`/` → frontend). Statusnya masih experimental dan butuh toggle manual di Project Settings
("Framework" → Services) yang harus dilakukan lewat dashboard. Dua-project seperti di atas lebih
stabil dan sudah cukup untuk kebutuhan "bisa dibuka di mana saja" — opsi ini hanya relevan kalau
nanti Anda ingin satu URL tunggal tanpa CORS. Tanya saya kalau mau dicoba.

## Catatan
- **Frontend di-pin Vite 6** (stabil). Vite 8 (preview rolldown) hasil `create-vite` gagal saat
  `vite build`, jadi diturunkan ke 6 — `npm run build` sudah terverifikasi menghasilkan `dist/`.
- **Backend di-pin Python 3.12** (`backend/.python-version` untuk Vercel; `backend/runtime.txt`
  untuk fallback Railway/Render) agar wheel pydantic stabil (Python 3.14 memaksa build dari
  source).
- `/calculate` masih **publik** (`get_current_user` stub). Untuk produksi ketat, verifikasi JWT
  Supabase via JWKS (lihat `backend/main.py` & `CLAUDE.md`).
- Supabase sudah global; cukup pastikan Site URL & CORS benar.
