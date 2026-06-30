"""
Backend FastAPI untuk aplikasi pondasi dangkal.
- POST /calculate : jalankan kalkulasi (publik/terproteksi sesuai kebutuhan)
- Endpoint progress menggunakan Supabase langsung dari frontend (lihat README),
  tetapi disediakan contoh verifikasi token di get_current_user.

Jalankan: uvicorn main:app --reload --port 8000
"""
import os
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from foundation_calc import (
    Foundation, Soil, LoadCase, run_full_check,
)

app = FastAPI(title="Pondasi Dangkal API", version="1.0.0")

# CORS — sesuaikan origin frontend di produksi.
# Pisah koma + buang spasi/elemen kosong, supaya "a, b" atau "a," tidak diam-diam
# membuat origin yang tak pernah cocok (penyebab umum blok CORS yang membingungkan).
_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Schema request (Pydantic) ----------
class LoadCaseIn(BaseModel):
    nama: str
    FY: float
    FX: float = 0.0
    FZ: float = 0.0
    MX: float = 0.0
    MZ: float = 0.0


class SoilIn(BaseModel):
    phi: float = 30.0
    c: float = 0.0
    gs: float = 18.0
    gw: float = 9.81
    xi_c: float = 1.30
    xi_q: float = 1.30
    xi_g: float = 0.69
    Es: float = 12000.0
    mu: float = 0.30
    e0: float = 0.50
    Cc: float = 0.12
    Cs: float = 0.0116
    Po: float = 9314.6
    dP: float = 466.1
    h1: float = 1.5
    h2: float = 3.0
    I1: float = 0.363
    I2: float = 0.048
    If: float = 0.53


class FoundationIn(BaseModel):
    n_pedestal: int = Field(1, ge=1, le=2)
    alphas: float = 20.0
    fc: float = 28.0
    fy: float = 420.0
    B: float = 1500.0
    L: float = 1500.0
    h: float = 300.0
    Df: float = 500.0
    c1: float = 400.0
    c2: float = 400.0
    Hp: float = 700.0
    cover: float = 75.0
    db: float = 13.0
    srl: float = 150.0
    gc: float = 24.0
    mu_fric: float = 0.5
    SF_bc: float = 3.0


class CalcRequest(BaseModel):
    foundation: FoundationIn
    soil: SoilIn
    load_cases: List[LoadCaseIn]


# ---------- Auth (verifikasi JWT Supabase, opsional) ----------
async def get_current_user(authorization: Optional[str] = Header(None)):
    """
    Verifikasi sederhana token Supabase. Untuk produksi gunakan
    library python-jose memvalidasi JWT terhadap JWKS Supabase.
    Di sini hanya memastikan header ada; kalkulasi bisa dibuat publik.
    """
    if authorization is None:
        return None  # endpoint calculate dibiarkan publik
    # contoh: token = authorization.replace("Bearer ", "")
    # decode & verifikasi di sini bila perlu role-gating
    return {"token": authorization}


# ---------- Endpoint ----------
@app.get("/")
def root():
    """Halaman root — biar URL polos tidak terlihat seperti error 'Not Found'."""
    return {
        "service": "Pondasi Dangkal API",
        "status": "ok",
        "docs": "/docs",
        "endpoints": ["/health", "/calculate"],
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/calculate")
def calculate(req: CalcRequest, user=Depends(get_current_user)):
    if not req.load_cases:
        raise HTTPException(400, "Minimal satu load case diperlukan.")
    fd = Foundation(**req.foundation.model_dump())
    soil = Soil(**req.soil.model_dump())
    lcs = [LoadCase(**lc.model_dump()) for lc in req.load_cases]
    result = run_full_check(fd, soil, lcs)
    return result
