"""
Modul kalkulasi pondasi dangkal (telapak) — backend-ready.
Metode: SNI 2847:2019, Terzaghi-Krizek, Steinbrenner.
Semua fungsi murni (tanpa I/O); mengembalikan dict siap di-serialize ke JSON.

Cek:
  1. Daya dukung Terzaghi (qall dari parameter tanah)
  2. Daya dukung tanah — per kombinasi beban (sigma_max tertinggi)
  3. Geser satu arah & dua arah (two-way: penampang KRITIS)
  4. Lentur & tulangan minimum
  5. Stabilitas geser, guling, gaya angkat (uplift)
  6. Settlement (Si + Sc1 + Sc2)

ALAT BANTU/EDUKASI — hasil WAJIB diverifikasi insinyur berlisensi.
"""
import math
from dataclasses import dataclass, field
from typing import List, Dict, Optional


# ============================================================
# Struktur data input
# ============================================================
@dataclass
class LoadCase:
    """Reaksi tumpuan ASD dari STAAD untuk satu kombinasi beban."""
    nama: str
    FY: float            # aksial vertikal (kN, + = tekan)
    FX: float = 0.0      # geser arah X (kN)
    FZ: float = 0.0      # geser arah Z (kN)
    MX: float = 0.0      # momen arah X (kNm)
    MZ: float = 0.0      # momen arah Z (kNm)


@dataclass
class Soil:
    phi: float = 30.0        # sudut geser dalam (deg)
    c: float = 0.0           # kohesi (kPa)
    gs: float = 18.0         # berat jenis tanah (kN/m3)
    gw: float = 9.81         # berat jenis air (kN/m3)
    # Faktor bentuk Terzaghi. ξc & ξq DIHITUNG OTOMATIS dari rasio sisi B/L
    # (Terzaghi-Krizek: ξ = 1 + 0.3·B/L) bila None. Isi nilai untuk override.
    # ξγ tetap input — knob kalibrasi dokumen (lihat CLAUDE.md).
    xi_c: Optional[float] = None
    xi_q: Optional[float] = None
    xi_g: float = 0.69
    # settlement
    Es: float = 12000.0      # modulus tanah (kPa)
    mu: float = 0.30         # poisson
    e0: float = 0.50
    Cc: float = 0.12         # indeks kompresi — properti terukur lab (tetap input)
    Cs: Optional[float] = None   # indeks swelling — auto = Cc/10 bila None
    Po: float = 9314.6       # tekanan overburden efektif (kg/m2)
    dP: float = 466.1        # tegangan tambahan (kg/m2)
    h1: float = 1.5          # tebal lapisan (m)
    h2: float = 3.0
    # faktor grafik (dibaca manual dari grafik — bisa diinput engineer)
    I1: float = 0.363        # Steinbrenner
    I2: float = 0.048
    If: float = 0.53         # faktor kedalaman


@dataclass
class Foundation:
    n_pedestal: int = 1
    alphas: float = 20.0     # 20 corner / 30 edge / 40 interior
    fc: float = 28.0
    fy: float = 420.0
    B: float = 1500.0        # Bf lebar (mm)
    L: float = 1500.0        # Lf panjang (mm)
    h: float = 300.0         # Hf tinggi (mm)
    Df: float = 500.0        # kedalaman footing (mm)
    c1: float = 400.0        # Lp panjang pedestal (mm)
    c2: float = 400.0        # Bp lebar pedestal (mm)
    Hp: float = 700.0        # tinggi total pedestal (mm)
    cover: float = 75.0      # selimut (mm)
    db: float = 13.0         # Ø tulangan (mm)
    srl: float = 150.0       # spasi tulangan (mm)
    gc: float = 24.0         # berat jenis beton (kN/m3)
    mu_fric: float = 0.5     # koef. gesek dasar
    SF_bc: float = 3.0       # faktor keamanan daya dukung


# ============================================================
# 1. Daya dukung Terzaghi (Krizek 1965)
# ============================================================
def terzaghi_qall(fd: Foundation, soil: Soil) -> dict:
    phi = soil.phi
    Nc = (228 + 4.3 * phi) / (40 - phi)
    Nq = (40 + 5 * phi) / (40 - phi)
    Ng = (6 * phi) / (40 - phi)
    # Faktor bentuk otomatis dari rasio sisi (Terzaghi-Krizek): ξ = 1 + 0.3·(B/L),
    # B = sisi pendek, L = sisi panjang. Strip (B≪L)→1.0; bujur sangkar (B=L)→1.3.
    # None = auto; nilai eksplisit = override engineer.
    side_ratio = min(fd.B, fd.L) / max(fd.B, fd.L) if max(fd.B, fd.L) else 1.0
    xi_c = soil.xi_c if soil.xi_c is not None else 1 + 0.3 * side_ratio
    xi_q = soil.xi_q if soil.xi_q is not None else 1 + 0.3 * side_ratio
    xi_g = soil.xi_g
    q = (soil.gs - soil.gw) * (fd.Df / 1000)        # surcharge efektif
    qu = (soil.c * Nc * xi_c +
          q * Nq * xi_q +
          0.5 * soil.gs * (fd.B / 1000) * Ng * xi_g)
    qall = qu / fd.SF_bc
    return dict(Nc=Nc, Nq=Nq, Ng=Ng, qu=qu, qall=qall, xi_c=xi_c, xi_q=xi_q, xi_g=xi_g)


# ============================================================
# 2-5. Cek struktur & stabilitas
# ============================================================
def cek(fd: Foundation, soil: Soil, lcs: List[LoadCase], qall: float) -> tuple:
    PHI_V, LAM, Es_steel = 0.75, 1.0, 200000.0
    eyt = fd.fy / Es_steel
    beta1 = 0.85 if fd.fc <= 28 else max(0.65, 0.85 - 0.05 * (fd.fc - 28) / 7)
    d = fd.h - fd.cover - 0.5 * fd.db
    Af = (fd.B / 1000) * (fd.L / 1000)
    Sx = (fd.B / 1000) * (fd.L / 1000) ** 2 / 6
    Sz = (fd.L / 1000) * (fd.B / 1000) ** 2 / 6
    H: Dict[str, dict] = {}

    # --- Daya dukung per LC: cari sigma_max tertinggi ---
    worst = None
    for lc in lcs:
        smax = lc.FY / Af + abs(lc.MX) / Sx + abs(lc.MZ) / Sz
        if worst is None or smax > worst[1]:
            worst = (lc, smax)
    lc_bc, smax = worst
    H["daya_dukung"] = dict(demand=smax, kapasitas=qall, rasio=smax / qall,
                            ok=smax <= qall, lc=lc_bc.nama)

    # --- Stabilitas geser (Fr = FY*mu, SF 1.5) ---
    lc_sh = max(lcs, key=lambda l: max(abs(l.FX), abs(l.FZ)))
    Fr = lc_sh.FY * fd.mu_fric
    Flat = max(abs(lc_sh.FX), abs(lc_sh.FZ))
    SFsl = Fr / Flat if Flat else 99
    H["stab_geser"] = dict(demand=Flat, kapasitas=Fr,
                           rasio=(1.5 * Flat) / Fr if Fr else 0, ok=SFsl >= 1.5,
                           lc=lc_sh.nama)

    # --- Guling (Mr = FY*0.5L, SF 2) ---
    minSFov, lc_ov, Mr_gov, M_gov = 99, "", 1, 0
    for lc in lcs:
        MrX = lc.FY * 0.5 * (fd.L / 1000)
        MrZ = lc.FY * 0.5 * (fd.B / 1000)
        sfx = MrX / abs(lc.MX) if lc.MX else 99
        sfz = MrZ / abs(lc.MZ) if lc.MZ else 99
        if min(sfx, sfz) < minSFov:
            minSFov, lc_ov = min(sfx, sfz), lc.nama
            Mr_gov = MrX if sfx < sfz else MrZ
            M_gov = abs(lc.MX) if sfx < sfz else abs(lc.MZ)
    H["guling"] = dict(demand=M_gov, kapasitas=Mr_gov,
                       rasio=(2 * M_gov) / Mr_gov if Mr_gov else 0,
                       ok=minSFov >= 2, lc=lc_ov)

    # --- Gaya angkat (uplift) ---
    Fdb = (fd.Df / 1000) * soil.gw * Af
    Ap = (fd.c1 / 1000) * (fd.c2 / 1000) * fd.n_pedestal
    Wf = fd.gc * Af * (fd.h / 1000)
    Wp = fd.gc * Ap * (fd.Hp / 1000)
    Hpb = max((fd.Df - fd.h) / 1000, 0)
    Wsb = (Af - Ap) * Hpb * soil.gs
    Frbp = Wf + Wp + Wsb
    SFup = Frbp / Fdb if Fdb else 99
    H["uplift"] = dict(demand=Fdb, kapasitas=Frbp,
                       rasio=(1.5 * Fdb) / Frbp if Frbp else 0, ok=SFup >= 1.5)

    # --- Tulangan & lentur (qu = 1.4*qall, strip 1 m) ---
    Bf, qu_f = 1000.0, 1.4 * qall
    qu = qu_f / 1000
    nrl = Bf / fd.srl
    As = nrl * 0.25 * math.pi * fd.db ** 2
    a = As * fd.fy / (0.85 * fd.fc * Bf)
    cna = a / beta1
    et = (d - cna) / cna * 0.003
    phiM = min(0.90, max(0.65, 0.65 + (et - eyt) * 0.25 / (0.005 - eyt)))
    pMn = phiM * As * fd.fy * (d - 0.5 * a) / 1e6
    Lll = 0.5 * fd.B
    Mu = 0.5 * qu * Bf * Lll ** 2 / 1e6
    H["lentur"] = dict(demand=Mu, kapasitas=pMn, rasio=Mu / pMn if pMn else 0, ok=Mu <= pMn)
    Ag = Bf * fd.h
    As_min = max(0.0018 * 420 / fd.fy * Ag, 0.0014 * Ag)
    H["tulangan_min"] = dict(demand=As_min, kapasitas=As,
                             rasio=As_min / As if As else 99, ok=As >= As_min)

    # --- Two-way shear (penampang KRITIS di d/2 dari muka pedestal) ---
    Lps = min(fd.c1 + d, fd.L)
    Bps = min(fd.c2 + d, fd.B)
    bo = 2 * (Lps + Bps)
    betaP = max(fd.c1, fd.c2) / min(fd.c1, fd.c2)
    vc = min(0.33 * LAM * math.sqrt(fd.fc),
             0.17 * (1 + 2 / betaP) * LAM * math.sqrt(fd.fc),
             0.083 * (2 + fd.alphas * d / bo) * LAM * math.sqrt(fd.fc))
    pVn2 = PHI_V * vc * bo * d / 1000
    A_crit = (Lps * Bps) / 1e6
    Vu2 = qu_f * (Af - A_crit)
    H["geser_2arah"] = dict(demand=Vu2, kapasitas=pVn2,
                            rasio=Vu2 / pVn2 if pVn2 else 0, ok=Vu2 <= pVn2)

    # --- One-way shear ---
    Bos = 0.5 * fd.B - (0.5 * fd.c2 + d)
    Aos = (fd.L * max(Bos, 0)) / 1e6
    pVn1 = PHI_V * 0.33 * LAM * math.sqrt(fd.fc) * fd.L * d / 1000
    Vu1 = qu_f * Aos
    H["geser_1arah"] = dict(demand=Vu1, kapasitas=pVn1,
                            rasio=Vu1 / pVn1 if pVn1 else 0,
                            ok=(Bos <= 0) or Vu1 <= pVn1)

    info = dict(d=d, beta1=beta1, phiM=phiM, Frbp=Frbp, Fdb=Fdb, SFup=SFup,
                SFsl=SFsl, smax=smax, qu_f=qu_f, As=As, bo=bo, q0=smax)
    return H, info


# ============================================================
# 6. Settlement (Si + Sc1 + Sc2)
# ============================================================
def settlement(fd: Foundation, soil: Soil, q0: float) -> dict:
    B = fd.B / 1000
    mu = soil.mu
    Is = soil.I1 + (1 - 2 * mu) / (1 - mu) * soil.I2
    Si = q0 * B * (1 - mu ** 2) / soil.Es * Is * soil.If * 4
    Si_mm = Si * 1000

    # Cs otomatis = Cc/10 (rasio baku Cs ≈ Cc/5…Cc/10) bila tidak di-override.
    Cs = soil.Cs if soil.Cs is not None else soil.Cc / 10.0

    H_layer = 0.5 + soil.h1
    Sc1 = (Cs * H_layer) / (1 + soil.e0) * math.log10((soil.Po + soil.dP) / soil.Po)
    Sc2 = (Cs * soil.h2) / (1 + soil.e0) * math.log10((soil.Po + soil.dP) / soil.Po)
    Stot = (Si_mm + Sc1 * 1000 + Sc2 * 1000)
    return dict(Si=Si_mm, Sc1=Sc1 * 1000, Sc2=Sc2 * 1000, Stot=Stot, ok=Stot < 25, Cs=Cs)


# ============================================================
# Orkestrator — satu pintu untuk backend
# ============================================================
def run_full_check(fd: Foundation, soil: Soil, lcs: List[LoadCase]) -> dict:
    """Jalankan semua cek dan kembalikan hasil lengkap siap-JSON."""
    tz = terzaghi_qall(fd, soil)
    checks, info = cek(fd, soil, lcs, tz["qall"])
    st = settlement(fd, soil, info["q0"])
    all_struct_ok = all(c["ok"] for c in checks.values())
    overall_ok = all_struct_ok and st["ok"]
    return dict(
        terzaghi=tz,
        checks=checks,
        settlement=st,
        info=info,
        overall_ok=overall_ok,
    )


if __name__ == "__main__":
    # Smoke test kasus dokumen
    lcs = [
        LoadCase("LC123", FY=60.49, FX=-7.88, FZ=-5.32, MX=-14.23, MZ=20.87),
        LoadCase("LC121", FY=56.64, FX=-6.78, FZ=-5.65, MX=-15.16, MZ=18.31),
        LoadCase("LC105", FY=37.08, FX=0.0, FZ=0.85, MX=2.20, MZ=0.0),
        LoadCase("LC114", FY=22.25, FX=-0.12, FZ=0.0, MX=0.0, MZ=0.22),
    ]
    out = run_full_check(Foundation(), Soil(), lcs)
    print("overall_ok:", out["overall_ok"])
    for k, v in out["checks"].items():
        print(f"  {k:<16} rasio={v['rasio']:.2f}  {'OK' if v['ok'] else 'NG'}")
    print("  settlement:", round(out["settlement"]["Stot"], 2), "mm")
