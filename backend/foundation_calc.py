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
    s_ped: float = 700.0     # jarak antar pusat pedestal bila n_pedestal=2 (mm).
                             # Hanya untuk sketsa; uplift sudah pakai n_pedestal.
    cover: float = 75.0      # selimut (mm)
    db: float = 13.0         # Ø tulangan (mm)
    srl: float = 150.0       # spasi tulangan (mm)
    gc: float = 24.0         # berat jenis beton (kN/m3)
    mu_fric: float = 0.5     # koef. gesek dasar
    SF_bc: float = 3.0       # faktor keamanan daya dukung


# ============================================================
# 0. Kombinasi pembebanan (FEED GFW · ASCE 7-16 Ps. 2.4.5 & 2.3.6)
#    ASD LC101–161  → stabilitas, daya dukung, settlement
#    LRFD LC501–558 → desain beton (lentur, geser, tulangan)
#    User hanya memasukkan BEBAN DASAR (reaksi tumpuan per beban primer);
#    kombinasi dibangkitkan otomatis — superposisi linear, terverifikasi
#    terhadap tabel "Kombinasi Beban ASD/LRFD pada Footing" dokumen.
# ============================================================
# Jenis beban dasar yang dikenal (nama = notasi dokumen):
#   DL beban mati struktur · PE/PO/PT pipa empty/operasi/test ·
#   QE/QO/QT beban tambahan empty/operasi/test · TE termal ekspansi ·
#   TF termal friksi · LL hidup · LR hidup atap · CDL/CLL cable tray mati/hidup ·
#   I impact · H tekanan tanah lateral · B buoyancy · WX/WZ angin · VX/VZ gempa.
KNOWN_LOADS = ("DL", "PE", "PO", "PT", "QE", "QO", "QT", "TE", "TF",
               "LL", "LR", "CDL", "CLL", "I", "H", "B", "WX", "WZ", "VX", "VZ")
_COMPS = ("FX", "FY", "FZ", "MX", "MZ")

# Grup beban yang SELALU berbagi faktor yang sama di dokumen:
_G_E = ("DL", "PE", "QE", "CDL")                 # kondisi pipa empty
_G_O = ("DL", "PO", "QO", "TE", "TF", "CDL")     # kondisi operasi (+termal)
_G_T = ("DL", "PT", "QT", "CDL")                 # kondisi test (ASD)
_G_TO = ("DL", "PT", "QT", "TE", "TF", "CDL")    # test + termal (LRFD 553–556)

# Token faktor yang bergantung SDS (dipetakan ke rumus ASCE 7-16):
#   A14 = 1+0.14·SDS  (1.0D+0.7Ev+0.7Eh) · A105 = 1+0.105·SDS (0.525Ev)
#   M14 = 0.6−0.14·SDS (0.6D−0.7Ev)      · B2  = 1.2+0.2·SDS  · B2M = 0.9−0.2·SDS
def _fac(tok, Sds):
    if isinstance(tok, (int, float)):
        return float(tok)
    return {"A14": 1 + 0.14 * Sds, "A105": 1 + 0.105 * Sds,
            "M14": 0.6 - 0.14 * Sds, "B2": 1.2 + 0.2 * Sds,
            "B2M": 0.9 - 0.2 * Sds}[tok]


def _g(group, f):
    return [(n, f) for n in group]


def _seis8(a, b):
    """8 pola arah gempa 100/30: ±a·VX±b·VZ lalu ±b·VX±a·VZ (urutan dokumen)."""
    return [(a, b), (a, -b), (-a, b), (-a, -b),
            (b, a), (b, -a), (-b, a), (-b, -a)]


def _asd_specs():
    S = []
    add = lambda n, terms: S.append((n, terms))
    add(101, _g(_G_E, 1) + [("H", 1)])
    for n, (w, f) in zip((102, 103, 104, 105),
                         (("WX", 0.6), ("WX", -0.6), ("WZ", 0.6), ("WZ", -0.6))):
        add(n, _g(_G_E, 1) + [("H", 1), (w, f)])
    n = 106
    for vx, vz in _seis8(0.91, 0.27):
        add(n, _g(_G_E, "A14") + [("H", 1), ("VX", vx), ("VZ", vz)]); n += 1
    for n, (w, f) in zip((114, 115, 116, 117),
                         (("WX", 0.6), ("WX", -0.6), ("WZ", 0.6), ("WZ", -0.6))):
        add(n, _g(_G_E, 0.6) + [("H", 1), (w, f)])
    add(118, _g(_G_O, 1) + [("H", 1)])
    for n, (w, f) in zip((119, 120, 121, 122),
                         (("WX", 0.6), ("WX", -0.6), ("WZ", 0.6), ("WZ", -0.6))):
        add(n, _g(_G_O, 1) + [("H", 1), (w, f)])
    n = 123
    for vx, vz in _seis8(0.91, 0.27):
        add(n, _g(_G_O, "A14") + [("H", 1), ("VX", vx), ("VZ", vz)]); n += 1
    add(131, _g(_G_O, 1) + [("LL", 1), ("CLL", 1), ("I", 1), ("H", 1)])
    add(132, _g(_G_O, 1) + [("LR", 1), ("CLL", 1), ("I", 1), ("H", 1)])
    for n, (w, f) in zip((133, 134, 135, 136),
                         (("WX", 0.45), ("WX", -0.45), ("WZ", 0.45), ("WZ", -0.45))):
        add(n, _g(_G_O, 1) + [("LL", 0.75), ("LR", 0.75), ("CLL", 1), ("I", 1), ("H", 1), (w, f)])
    n = 137
    for vx, vz in _seis8(0.68, 0.2):
        add(n, _g(_G_O, "A105") + [("LL", 0.75), ("CLL", 0.75), ("I", 0.75), ("H", 1),
                                   ("VX", vx), ("VZ", vz)]); n += 1
    for n, (w, f) in zip((145, 146, 147, 148),
                         (("WX", 0.6), ("WX", -0.6), ("WZ", 0.6), ("WZ", -0.6))):
        add(n, _g(_G_O, 0.6) + [(w, f)])          # tanpa H (sesuai dokumen)
    # 149–156: urutan tanda LC149/150 mengikuti dokumen (+0.91VX−0.27VZ dulu)
    ord_149 = [(0.91, -0.27), (0.91, 0.27), (-0.91, 0.27), (-0.91, -0.27),
               (0.27, 0.91), (0.27, -0.91), (-0.27, 0.91), (-0.27, -0.91)]
    n = 149
    for vx, vz in ord_149:
        add(n, _g(_G_O, "M14") + [("H", 1), ("VX", vx), ("VZ", vz)]); n += 1
    for n, (w, f) in zip((157, 158, 159, 160),
                         (("WX", 0.45), ("WX", -0.45), ("WZ", 0.45), ("WZ", -0.45))):
        add(n, _g(_G_T, 1) + [("H", 1), (w, f)])
    add(161, _g(_G_E, 1) + [("H", 1), ("B", 1)])
    return S


def _lrfd_specs():
    S = []
    add = lambda n, terms: S.append((n, terms))
    add(501, _g(_G_E, 1.4) + [("H", 1.6)])
    for n, (w, f) in zip((502, 503, 504, 505),
                         (("WX", 1), ("WX", -1), ("WZ", 1), ("WZ", -1))):
        add(n, _g(_G_E, 0.9) + [("H", 1.6), (w, f)])
    n = 506
    for vx, vz in _seis8(1.3, 0.39):
        add(n, _g(_G_E, "B2") + [("H", 1.6), ("VX", vx), ("VZ", vz)]); n += 1
    n = 514
    for vx, vz in _seis8(1.3, 0.39):
        add(n, _g(_G_E, "B2M") + [("H", 1.6), ("VX", vx), ("VZ", vz)]); n += 1
    add(522, _g(_G_O, 1.4) + [("H", 1.6)])
    add(523, _g(_G_O, 1.2) + [("LL", 1.6), ("LR", 0.5), ("CLL", 1.6), ("I", 1.6), ("H", 1.6)])
    add(524, _g(_G_O, 1.2) + [("LL", 1), ("LR", 1.6), ("CLL", 1), ("I", 1), ("H", 1.6)])
    for n, (w, f) in zip((525, 526, 527, 528),
                         (("WX", 0.5), ("WX", -0.5), ("WZ", 0.5), ("WZ", -0.5))):
        add(n, _g(_G_O, 1.2) + [("LR", 1.6), ("CLL", 1), ("I", 1), ("H", 1.6), (w, f)])
    for n, (w, f) in zip((529, 530, 531, 532),
                         (("WX", 1), ("WX", -1), ("WZ", 1), ("WZ", -1))):
        add(n, _g(_G_O, 1.2) + [("LR", 0.5), ("CLL", 1), ("I", 1), ("H", 1.6), (w, f)])
    for n, (w, f) in zip((533, 534, 535, 536),
                         (("WX", 1), ("WX", -1), ("WZ", 1), ("WZ", -1))):
        add(n, _g(_G_O, 0.9) + [("H", 1.6), (w, f)])
    n = 537
    for vx, vz in _seis8(1.3, 0.39):
        add(n, _g(_G_O, "B2") + [("LL", 1), ("CLL", 1), ("I", 1), ("H", 1.6),
                                 ("VX", vx), ("VZ", vz)]); n += 1
    n = 545
    for vx, vz in _seis8(1.3, 0.39):
        add(n, _g(_G_O, "B2M") + [("H", 1.6), ("VX", vx), ("VZ", vz)]); n += 1
    for n, (w, f) in zip((553, 554, 555, 556),
                         (("WX", 0.5), ("WX", -0.5), ("WZ", 0.5), ("WZ", -0.5))):
        add(n, _g(_G_TO, 1.2) + [("LR", 1.6), ("H", 1.6), (w, f)])
    add(557, [(x, 1.2) for x in ("DL", "PT", "QT", "TE", "TF")] +
             [("LL", 1), ("LR", 1.6), ("H", 1.6)])
    add(558, _g(_G_E, 0.9) + [("H", 1.6), ("B", 1.3)])
    return S


def _fmt_factor(v):
    s = f"{abs(v):.3f}".rstrip("0").rstrip(".")
    return s or "0"


def _formula(terms, Sds):
    """String kombinasi gaya dokumen, mis. '1.068DL+1.068PE+1H-0.91VX+0.27VZ'."""
    order = {n: i for i, n in enumerate(KNOWN_LOADS)}
    parts = []
    for name, tok in sorted(terms, key=lambda t: order[t[0]]):
        v = _fac(tok, Sds)
        sign = "-" if v < 0 else ("+" if parts else "")
        parts.append(f"{sign}{_fmt_factor(v)}{name}")
    return "".join(parts)


def generate_combinations(loads: Dict[str, dict], Sds: float = 0.0) -> tuple:
    """Bangkitkan kombinasi ASD (101–161) & LRFD (501–558) dari beban dasar.

    loads: {nama_beban: {FX, FY, FZ, MX, MZ}} — reaksi tumpuan per beban primer
    (kN, kNm). Nama harus subset KNOWN_LOADS; komponen yang hilang dianggap 0.
    Return: (asd, lrfd) — list dict {lc, formula, FX, FY, FZ, MX, MY, MZ}.
    """
    unknown = [k for k in loads if k not in KNOWN_LOADS]
    if unknown:
        raise ValueError(f"Beban tidak dikenal: {', '.join(unknown)}. "
                         f"Gunakan salah satu dari: {', '.join(KNOWN_LOADS)}")

    def build(specs):
        rows = []
        for num, terms in specs:
            comp = dict.fromkeys(_COMPS, 0.0)
            for name, tok in terms:
                ld = loads.get(name)
                if not ld:
                    continue
                fv = _fac(tok, Sds)
                for c in _COMPS:
                    comp[c] += fv * float(ld.get(c, 0) or 0)
            rows.append(dict(lc=num, formula=_formula(terms, Sds), MY=0.0, **comp))
        return rows

    return build(_asd_specs()), build(_lrfd_specs())


def _maxmin(rows) -> dict:
    """Nilai maks/min tiap komponen + LC penyebabnya (tabel rekap dokumen)."""
    out = {}
    for c in ("FX", "FY", "FZ", "MX", "MY", "MZ"):
        mx = max(rows, key=lambda r: r[c])
        mn = min(rows, key=lambda r: r[c])
        out[c] = dict(max=mx[c], lc_max=mx["lc"], min=mn[c], lc_min=mn["lc"])
    return out


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
def cek(fd: Foundation, soil: Soil, lcs: List[LoadCase], qall: float,
        lrfd_lcs: Optional[List[LoadCase]] = None) -> tuple:
    PHI_V, LAM, Es_steel = 0.75, 1.0, 200000.0
    eyt = fd.fy / Es_steel
    beta1 = 0.85 if fd.fc <= 28 else max(0.65, 0.85 - 0.05 * (fd.fc - 28) / 7)
    d = fd.h - fd.cover - 0.5 * fd.db
    Af = (fd.B / 1000) * (fd.L / 1000)
    Sx = (fd.B / 1000) * (fd.L / 1000) ** 2 / 6
    Sz = (fd.L / 1000) * (fd.B / 1000) ** 2 / 6
    # Model 2 pedestal (n_pedestal=2): asumsi beban terbagi rata 50/50 ke tiap
    # pedestal, dan pedestal bergeser ±s_ped/2 dari pusat footing. Cek lokal
    # (geser pons, geser 1-arah, lentur) dihitung per pedestal / posisi terluar.
    # n_pedestal=1 → n_ped=1, x_off=0 → IDENTIK kalibrasi dokumen.
    n_ped = max(1, int(getattr(fd, "n_pedestal", 1) or 1))
    x_off = (fd.s_ped / 2.0) if n_ped >= 2 else 0.0   # offset pedestal terluar (mm)
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

    # --- Stabilitas geser (Fr = FY*mu, SF 1.5) — SF minimum di seluruh LC ---
    worst_sl = None
    for lc in lcs:
        Flat_i = max(abs(lc.FX), abs(lc.FZ))
        Fr_i = lc.FY * fd.mu_fric
        sf_i = (Fr_i / Flat_i) if Flat_i else 99
        if worst_sl is None or sf_i < worst_sl[0]:
            worst_sl = (sf_i, lc.nama, Fr_i, Flat_i)
    SFsl, sl_nama, Fr, Flat = worst_sl
    H["stab_geser"] = dict(demand=Flat, kapasitas=Fr,
                           rasio=(1.5 * Flat) / Fr if Fr else 0, ok=SFsl >= 1.5,
                           lc=sl_nama)

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

    # --- Tulangan & lentur (strip 1 m) ---
    # Tekanan ultimit: bila kombinasi LRFD tersedia, pakai σu,max riil dari
    # LC501–558 (metode dokumen); jalur legacy tetap 1.4·qall.
    lrfd_gov = None
    if lrfd_lcs:
        worst_u = None
        for lc in lrfd_lcs:
            su = lc.FY / Af + abs(lc.MX) / Sx + abs(lc.MZ) / Sz
            if worst_u is None or su > worst_u[1]:
                worst_u = (lc, su)
        qu_f, lrfd_gov = worst_u[1], worst_u[0].nama
    else:
        qu_f = 1.4 * qall
    Bf = 1000.0
    qu = qu_f / 1000
    nrl = Bf / fd.srl
    As = nrl * 0.25 * math.pi * fd.db ** 2
    a = As * fd.fy / (0.85 * fd.fc * Bf)
    cna = a / beta1
    et = (d - cna) / cna * 0.003
    phiM = min(0.90, max(0.65, 0.65 + (et - eyt) * 0.25 / (0.005 - eyt)))
    pMn = phiM * As * fd.fy * (d - 0.5 * a) / 1e6
    Lll = max(0.5 * fd.B - x_off, 0.0)   # kantilever dari pedestal terluar ke tepi
    Mu = 0.5 * qu * Bf * Lll ** 2 / 1e6
    H["lentur"] = dict(demand=Mu, kapasitas=pMn, rasio=Mu / pMn if pMn else 0, ok=Mu <= pMn)
    if lrfd_gov:
        H["lentur"]["lc"] = lrfd_gov
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
    # Demand pons per pedestal: reaksi tanah pada area tributari (Af/n_ped) di luar
    # penampang kritis. n_ped=1 → Af - A_crit (identik); n_ped=2 → tiap pedestal ½ beban.
    Vu2 = qu_f * max(Af / n_ped - A_crit, 0.0)
    H["geser_2arah"] = dict(demand=Vu2, kapasitas=pVn2,
                            rasio=Vu2 / pVn2 if pVn2 else 0, ok=Vu2 <= pVn2)
    if lrfd_gov:
        H["geser_2arah"]["lc"] = lrfd_gov

    # --- One-way shear ---
    Bos = 0.5 * fd.B - (x_off + 0.5 * fd.c2 + d)
    Aos = (fd.L * max(Bos, 0)) / 1e6
    pVn1 = PHI_V * 0.33 * LAM * math.sqrt(fd.fc) * fd.L * d / 1000
    Vu1 = qu_f * Aos
    H["geser_1arah"] = dict(demand=Vu1, kapasitas=pVn1,
                            rasio=Vu1 / pVn1 if pVn1 else 0,
                            ok=(Bos <= 0) or Vu1 <= pVn1)
    if lrfd_gov:
        H["geser_1arah"]["lc"] = lrfd_gov

    info = dict(d=d, beta1=beta1, phiM=phiM, Frbp=Frbp, Fdb=Fdb, SFup=SFup,
                SFsl=SFsl, smax=smax, qu_f=qu_f, As=As, bo=bo, q0=smax,
                lrfd_gov=lrfd_gov)
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
def run_full_check(fd: Foundation, soil: Soil, lcs: Optional[List[LoadCase]] = None,
                   loads: Optional[Dict[str, dict]] = None, Sds: float = 0.0) -> dict:
    """Jalankan semua cek dan kembalikan hasil lengkap siap-JSON.

    Dua mode input:
    - loads + Sds (baru): beban dasar → kombinasi ASD/LRFD dibangkitkan otomatis.
      ASD (101–161) untuk stabilitas/daya dukung/settlement; LRFD (501–558)
      untuk cek beton via σu,max. Hasil menyertakan blok `combos` untuk laporan.
    - lcs (legacy): daftar kombinasi ASD manual — perilaku lama utuh (beton
      memakai 1.4·qall).
    """
    tz = terzaghi_qall(fd, soil)
    combos_out, lrfd_lcs = None, None
    if loads is not None:
        asd, lrfd = generate_combinations(loads, Sds)
        as_lc = lambda rows: [LoadCase(nama=f"LC{r['lc']}", FY=r["FY"], FX=r["FX"],
                                       FZ=r["FZ"], MX=r["MX"], MZ=r["MZ"]) for r in rows]
        lcs, lrfd_lcs = as_lc(asd), as_lc(lrfd)
        combos_out = dict(Sds=Sds, asd=asd, lrfd=lrfd,
                          maxmin_asd=_maxmin(asd), maxmin_lrfd=_maxmin(lrfd))
    if not lcs:
        raise ValueError("Berikan `loads` (beban dasar) atau `lcs` (kombinasi manual).")
    checks, info = cek(fd, soil, lcs, tz["qall"], lrfd_lcs)
    st = settlement(fd, soil, info["q0"])
    all_struct_ok = all(c["ok"] for c in checks.values())
    overall_ok = all_struct_ok and st["ok"]
    out = dict(
        terzaghi=tz,
        checks=checks,
        settlement=st,
        info=info,
        overall_ok=overall_ok,
    )
    if combos_out is not None:
        out["combos"] = combos_out
    return out


if __name__ == "__main__":
    # ============================================================
    # Harness validasi vs dokumen FEED GFW (pondasi dangkal Type-1C,
    # DURI-RDNL05GS40N-CIV-CAL-PHR-2001-00).
    # ============================================================
    # --- 1) Jalur legacy (kombinasi manual) — kalibrasi lama harus utuh ---
    lcs = [
        LoadCase("LC123", FY=60.49, FX=-7.88, FZ=-5.32, MX=-14.23, MZ=20.87),
        LoadCase("LC121", FY=56.64, FX=-6.78, FZ=-5.65, MX=-15.16, MZ=18.31),
        LoadCase("LC105", FY=37.08, FX=0.0, FZ=0.85, MX=2.20, MZ=0.0),
        LoadCase("LC114", FY=22.25, FX=-0.12, FZ=0.0, MX=0.0, MZ=0.22),
    ]
    out = run_full_check(Foundation(), Soil(), lcs)
    print("[legacy] overall_ok:", out["overall_ok"])
    assert out["overall_ok"], "jalur legacy harus tetap AMAN (kalibrasi dokumen)"

    # --- 2) Jalur baru: beban dasar dokumen → kombinasi otomatis ---
    # Reaksi tumpuan per beban primer, diturunkan dari tabel "Kombinasi Beban
    # ASD pada Footing" dokumen (superposisi linear; momen = gaya × lengan).
    doc_loads = {
        "DL": dict(FY=29.611),
        "PE": dict(FY=7.47), "PO": dict(FY=27.03), "PT": dict(FY=28.93),
        "TE": dict(FZ=-4.80, MX=-12.96),
        "TF": dict(FX=-6.78, MZ=18.306),
        "WX": dict(FX=-0.1917, MZ=0.3733),
        "WZ": dict(FZ=-1.4117, MX=-3.6667),
        "VX": dict(FX=-0.7054, MZ=1.4462),
        "VZ": dict(FZ=-0.7054, MX=-1.4462),
    }
    # Tabel ASD dokumen konsisten dgn (1+0.14·SDS)=1.068 → SDS = 0.4857.
    # (Tabel LRFD dokumen memakai pembulatan 1.3/0.8 → SDS=0.5; inkonsistensi
    # internal dokumen — diuji terpisah di bawah.)
    Sds_asd = 0.068 / 0.14
    asd, lrfd = generate_combinations(doc_loads, Sds_asd)
    amap = {r["lc"]: r for r in asd}

    def cek_lc(lc, fx, fy, fz, mx, mz, tol=0.006):
        r = amap[lc]
        for key, exp in zip(("FX", "FY", "FZ", "MX", "MZ"), (fx, fy, fz, mx, mz)):
            assert abs(r[key] - exp) <= tol, \
                f"LC{lc} {key}: {r[key]:.4f} ≠ dokumen {exp} (tol {tol})"

    # Baris tabel dokumen (hal. 13–15):
    cek_lc(101, 0.000, 37.081, 0.000, 0.000, 0.000)
    cek_lc(102, -0.115, 37.081, 0.000, 0.000, 0.224)
    cek_lc(104, 0.000, 37.081, -0.847, -2.200, 0.000)
    cek_lc(106, -0.642, 39.602, -0.190, -0.390, 1.316)
    cek_lc(110, -0.190, 39.602, -0.642, -1.316, 0.390)
    cek_lc(114, -0.115, 22.248, 0.000, 0.000, 0.224)
    cek_lc(118, -6.780, 56.641, -4.800, -12.960, 18.306)
    cek_lc(121, -6.780, 56.641, -5.647, -15.160, 18.306)
    cek_lc(123, -7.883, 60.492, -5.317, -14.232, 20.866)
    cek_lc(127, -7.431, 60.492, -5.768, -15.157, 19.941)
    cek_lc(131, -6.780, 56.641, -4.800, -12.960, 18.306)
    cek_lc(159, 0.000, 58.541, -0.635, -1.650, 0.000)
    cek_lc(161, 0.000, 37.081, 0.000, 0.000, 0.000)
    # LC137: dokumen memakai faktor DIBULATKAN 1.05 (bukan 1.051) → tol longgar.
    cek_lc(137, -7.599, 59.473, -5.181, -13.897, 20.204, tol=0.1)

    # Rekap maks/min ASD (hal. 15) — nilai & LC penyebab:
    mm = _maxmin(asd)
    exp_mm = dict(
        FX=dict(max=0.642, lc_max=108, min=-7.883, lc_min=123),
        FY=dict(max=60.492, lc_max=123, min=22.248, lc_min=114),
        FZ=dict(max=0.847, lc_max=105, min=-5.768, lc_min=127),
        MX=dict(max=2.200, lc_max=105, min=-15.160, lc_min=121),
        MZ=dict(max=20.866, lc_max=123, min=-1.316, lc_min=108),
    )
    for c, e in exp_mm.items():
        assert abs(mm[c]["max"] - e["max"]) <= 0.006 and mm[c]["lc_max"] == e["lc_max"], \
            f"maxmin {c} max: {mm[c]}"
        assert abs(mm[c]["min"] - e["min"]) <= 0.006 and mm[c]["lc_min"] == e["lc_min"], \
            f"maxmin {c} min: {mm[c]}"

    # LRFD vs dokumen (hal. 15) — dokumen memakai SDS=0.5 utk set LRFD:
    _, lrfd05 = generate_combinations(doc_loads, 0.5)
    lmap = {r["lc"]: r for r in lrfd05}
    for lc, exp_fy in ((501, 51.913), (502, 33.373), (506, 48.205), (514, 29.664)):
        assert abs(lmap[lc]["FY"] - exp_fy) <= 0.006, \
            f"LC{lc} FY: {lmap[lc]['FY']:.4f} ≠ {exp_fy}"
    assert abs(lmap[502]["FX"] - (-0.192)) <= 0.006 and abs(lmap[502]["MZ"] - 0.373) <= 0.006
    assert abs(lmap[506]["FX"] - (-0.917)) <= 0.006 and abs(lmap[506]["MZ"] - 1.880) <= 0.006
    assert len(asd) == 61 and len(lrfd) == 58, f"jumlah kombinasi: {len(asd)}/{len(lrfd)}"

    # --- 3) Full check jalur baru harus AMAN dgn input dokumen ---
    out2 = run_full_check(Foundation(), Soil(), loads=doc_loads, Sds=Sds_asd)
    print("[loads]  overall_ok:", out2["overall_ok"])
    for k, v in out2["checks"].items():
        tag = f" ({v['lc']})" if v.get("lc") else ""
        print(f"  {k:<16} rasio={v['rasio']:.2f}  {'OK' if v['ok'] else 'NG'}{tag}")
    print("  settlement:", round(out2["settlement"]["Stot"], 2), "mm")
    print("  sigma_u max LRFD:", round(out2["info"]["qu_f"], 2), "kPa -",
          out2["info"]["lrfd_gov"])
    assert out2["overall_ok"], "jalur beban dasar harus AMAN utk kasus dokumen"
    print("SEMUA COCOK DENGAN DOKUMEN")
