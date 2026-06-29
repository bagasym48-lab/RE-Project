# Aplikasi Pondasi Dangkal — Kalkulator + Progress Tracking

Paket fondasi proyek. Berisi backend kalkulasi yang sudah tervalidasi
terhadap dokumen perhitungan nyata (FEED Pipa GFW, SNI 2847:2019),
skema database Supabase, dan contoh frontend.

> **Alat bantu/edukasi.** Semua hasil kalkulasi WAJIB diverifikasi
> insinyur berlisensi sebelum dipakai untuk keputusan nyata.

## Struktur

```
pondasi-app/
├── backend/
│   ├── foundation_calc.py   # modul kalkulasi (8 cek + Terzaghi + settlement)
│   ├── main.py              # FastAPI: POST /calculate
│   └── requirements.txt
├── supabase/
│   └── schema.sql           # tabel + RLS untuk role engineer/qc/viewer
├── frontend-snippet/
│   └── CalculatorForm.jsx   # contoh komponen React
└── .env.example
```

## Cek yang diimplementasikan

Daya dukung Terzaghi-Krizek · daya dukung tanah (per kombinasi beban,
σmax tertinggi otomatis) · geser satu arah · geser dua arah (penampang
kritis) · lentur · tulangan minimum (SNI 8.6.1.1) · stabilitas geser ·
guling · gaya angkat (uplift) · settlement (Si + Sc1 + Sc2).

## Setup cepat

### 1. Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # win: .venv\Scripts\activate
pip install -r requirements.txt
python foundation_calc.py        # smoke test — harus overall_ok: True
uvicorn main:app --reload --port 8000
# cek: http://localhost:8000/docs
```

### 2. Supabase
1. Buat proyek di supabase.com
2. SQL Editor → tempel & jalankan `supabase/schema.sql`
3. Daftarkan user, lalu set role manual di tabel `profiles`
   (`update profiles set role='engineer' where id='...'`)
4. Salin URL + anon key ke `.env` frontend

### 3. Frontend (Vite + React)
```bash
npm create vite@latest frontend -- --template react
cd frontend && npm install @supabase/supabase-js
# salin CalculatorForm.jsx ke src/, isi .env, npm run dev
```

## Rencana lanjutan (kerjakan di Claude Code)

1. **Frontend kalkulator** — form lengkap + sketsa SVG otomatis (tampak
   atas + potongan) + input multi load-case
2. **Auth** — halaman login Supabase, simpan sesi, tampilkan role
3. **Progress tracking**
   - Engineer: input % progress, tanggal target vs aktual
   - QC: isi status (lolos/tidak) + catatan
   - Semua: dashboard (kurva-S, grafik harian, tabel)
4. **Pembatasan kolom** — trigger SQL agar engineer tak bisa ubah kolom
   QC dan sebaliknya (RLS hanya per-baris)
5. **Simpan desain** — tabel `foundation_designs` untuk menyimpan input +
   hasil kalkulasi, ditautkan ke work_items
6. **Deploy** — frontend → Vercel, backend → Railway/Render

## Catatan teknis (untuk validasi engineer)

- Faktor bentuk Terzaghi `xi_g=0.69` dikalibrasi agar qu ≈ dokumen;
  faktor grafik settlement (I1, I2, If) diambil dari pembacaan grafik
  dokumen. Keduanya dibuat **bisa diinput** (lihat `SoilIn`), tidak
  di-hardcode — engineer dapat menyesuaikan ke standar yang dipakai.
- Two-way shear memakai penampang kritis (d/2 dari muka pedestal).
- Daya dukung dievaluasi per load-case; σmax tertinggi yang dipakai.
