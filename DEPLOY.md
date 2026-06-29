# Deploy — RE-Project (Kalkulasi & Monitoring Pondasi)

Tiga komponen:

- **Supabase** — sudah di cloud (DB + Auth). Tidak perlu deploy.
- **Backend FastAPI** — deploy ke **Render** (atau Railway).
- **Frontend Vite/React** — deploy ke **Vercel**.

Urutan penting (ada saling-tunjuk URL): **backend dulu** → **frontend** (set `VITE_API_URL`) → **set `CORS_ORIGINS` backend** = URL Vercel → **set Site URL Supabase**.

---

## 0. Push ke GitHub
Vercel & Render deploy dari Git. Dari root proyek:

```bash
git init
git add .
git commit -m "RE-Project: kalkulator + monitoring pondasi"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

`.gitignore` sudah menutup `.env`, `.venv/`, `node_modules/`, `dist/` — kredensial & artefak tidak ikut ter-push. (Kunci Supabase di-set sebagai env di Vercel, bukan dari file.)

## 1. Backend → Render
**Opsi A — Blueprint:** repo sudah punya `render.yaml`. Render → **New → Blueprint** → pilih repo → Apply.

**Opsi B — manual:** **New → Web Service** → pilih repo, lalu:
- **Root Directory:** `backend`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`

Setelah live, catat URL-nya, mis. `https://pondasi-backend.onrender.com`. Cek `…/health` → `{"status":"ok"}` dan `…/docs`.

> `CORS_ORIGINS` diisi di langkah 3.
> Free tier Render "tidur" setelah idle → request pertama bisa lambat ±30 dtk.

## 2. Frontend → Vercel
**Add New → Project** → import repo, lalu:
- **Root Directory:** `frontend`
- **Framework:** Vite (terdeteksi otomatis) · **Build:** `npm run build` · **Output:** `dist`
- **Environment Variables:**
  | Key | Value |
  |---|---|
  | `VITE_API_URL` | `https://pondasi-backend.onrender.com` (URL backend langkah 1) |
  | `VITE_SUPABASE_URL` | `https://lpfxxeranacbdmrapksu.supabase.co` |
  | `VITE_SUPABASE_ANON_KEY` | `<anon key dari frontend/.env>` |

Deploy → dapat URL, mis. `https://re-project.vercel.app`.

> Variabel `VITE_*` di-*bake* saat build. Kalau URL backend berubah → **redeploy** Vercel.

## 3. Sambungkan CORS (backend ← frontend)
Render → service backend → **Environment** → set:
- `CORS_ORIGINS` = `https://re-project.vercel.app`
  (boleh banyak, pisah koma: `https://re-project.vercel.app,http://localhost:5173`)

Simpan → Render redeploy. Tanpa ini, tombol Hitung kena blok CORS.

## 4. Supabase Auth URL
Supabase → **Authentication → URL Configuration**:
- **Site URL** = `https://re-project.vercel.app`
- **Redirect URLs** = tambah `https://re-project.vercel.app/**`

Agar link verifikasi email mengarah ke situs produksi, bukan localhost. (Atau matikan "Confirm email" untuk testing cepat.)

## 5. Selesai
Buka URL Vercel di **HP/laptop siapa pun**. Daftar/login → kalkulator, progress, simpan desain.

---

## Alternatif backend: Railway
- New Project → Deploy from repo → **Root Directory** = `backend`.
- Railway membaca `backend/Procfile` + `backend/runtime.txt`.
- Tambah variable `CORS_ORIGINS` = URL Vercel; ambil domain publik di **Settings → Networking → Generate Domain**.

## Catatan
- **Frontend di-pin Vite 6** (stabil). Vite 8 (preview rolldown) hasil `create-vite` gagal saat `vite build`, jadi diturunkan ke 6 — `npm run build` sudah terverifikasi menghasilkan `dist/`.
- **Backend di-pin Python 3.12** (`backend/runtime.txt`) agar wheel pydantic stabil (Python 3.14 memaksa build dari source).
- `/calculate` masih **publik** (`get_current_user` stub). Untuk produksi ketat, verifikasi JWT Supabase via JWKS (lihat `backend/main.py` & `CLAUDE.md`).
- Supabase sudah global; cukup pastikan Site URL & CORS benar.
