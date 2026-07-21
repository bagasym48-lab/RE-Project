// Dashboard.jsx — landing EPC: statistik, quick actions, kartu disiplin interaktif,
// recent project & recent calculation (data nyata dari Supabase), footer.
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Ic from './Icons.jsx';

const TOOL_LABEL = { calc: 'Kalkulator Pondasi', mto: 'MTO', progress: 'Progress' };

// Urutan kartu mengikuti sidebar: Process, Mechanical, Piping, Electrical, Instrument, Civil.
const DISC_CARDS = [
  { id: 'process', label: 'Process', desc: 'Kalkulasi teknik proses', acc: 'process', icon: 'process', live: false,
    feats: ['- Tools', '- Calculator', '- Reference Module'], cta: 'Lihat Process' },
  { id: 'mechanical', label: 'Mechanical', desc: 'Tools & utilitas teknik mesin', acc: 'mech', icon: 'mechanical', live: false,
    feats: ['- Tools', '- Calculator', '- Helper Module'], cta: 'Lihat Mechanical' },
  { id: 'piping', label: 'Piping', desc: 'Tools & kalkulasi perpipaan', acc: 'piping', icon: 'piping', live: false,
    feats: ['- Tools', '- Calculator', '- Helper Module'], cta: 'Lihat Piping' },
  { id: 'electrical', label: 'Electrical', desc: 'Tools & kalkulasi teknik elektro', acc: 'elec', icon: 'electrical', live: false,
    feats: ['- Tools', '- Calculator', '- Helper Module'], cta: 'Lihat Electrical' },
  { id: 'instrument', label: 'Instrument', desc: 'Tools & kalkulasi instrumentasi', acc: 'inst', icon: 'instrument', live: false,
    feats: ['- Tools', '- Calculator', '- Reference Module'], cta: 'Lihat Instrument' },
  { id: 'civil', label: 'Civil', desc: 'Kalkulasi & tools teknik sipil', acc: 'civil', icon: 'civil', live: true,
    feats: ['3 Tools', '3 Calculator', '1 Progress Module'], cta: 'Buka Civil Dashboard' },
];

const CIVIL_TOOLS = [
  { tool: 'calc', icon: 'calc', label: 'Kalkulator Pondasi', desc: 'Pondasi dangkal, equipment & pipe support', use: '25 penggunaan minggu ini' },
  { tool: 'mto', icon: 'box', label: 'MTO', desc: 'Volume & harga material (beton, besi, pipa)', use: '18 penggunaan minggu ini' },
  { tool: 'progress', icon: 'chart', label: 'Progress', desc: 'Project, dokumen & kurva-S', use: '12 update minggu ini' },
];

function relTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso); const now = new Date();
  const days = Math.floor((now - d) / 86400000);
  if (days <= 0) return 'Hari ini, ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Kemarin';
  if (days < 7) return `${days} hari lalu`;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function Dashboard({ nama, userId, onOpen }) {
  const [projects, setProjects] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [counts, setCounts] = useState({ proj: 0, design: 0 });
  const [q, setQ] = useState('');
  const [pop, setPop] = useState(null); // 'notif' | 'help' | null

  useEffect(() => {
    (async () => {
      const { data: pr } = await supabase.from('projects').select('id, nama, deskripsi, target_date, created_at').order('created_at', { ascending: false }).limit(4);
      setProjects(pr || []);
      const { data: dg } = await supabase.from('foundation_designs').select('id, nama, overall_ok, created_at').order('created_at', { ascending: false }).limit(4);
      setDesigns(dg || []);
      const { count: pc } = await supabase.from('projects').select('*', { count: 'exact', head: true });
      const { count: dc } = await supabase.from('foundation_designs').select('*', { count: 'exact', head: true });
      setCounts({ proj: pc || 0, design: dc || 0 });
    })();
  }, [userId]);

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  let lastTool = 'Pondasi Dangkal';
  try { const lt = localStorage.getItem('lastTool'); if (lt && TOOL_LABEL[lt]) lastTool = TOOL_LABEL[lt]; } catch { /* ignore */ }

  const stats = [
    { icon: 'tools', acc: 'civil', val: 3, label: 'Total Tools', sub: 'Semua modul tersedia' },
    { icon: 'folder', acc: 'mech', val: counts.proj, label: 'Project Aktif', sub: counts.proj ? 'Tersinkron Supabase' : 'Belum ada project' },
    { icon: 'calc', acc: 'process', val: counts.design, label: 'Desain Tersimpan', sub: 'Total perhitungan' },
    { icon: 'clock', acc: 'piping', val: lastTool, label: 'Tool Terakhir', sub: 'Lanjutkan pekerjaan', small: true },
  ];

  const quick = [
    { icon: 'plus', label: 'Kalkulasi Baru', onClick: () => onOpen('civil', 'calc') },
    { icon: 'folder', label: 'Project Baru', onClick: () => onOpen('civil', 'progress') },
    { icon: 'box', label: 'MTO', onClick: () => onOpen('civil', 'mto') },
    { icon: 'clock', label: 'Buka Terakhir', onClick: () => onOpen('civil', 'calc') },
  ];

  const ql = q.trim().toLowerCase();
  const match = (s) => !ql || (s || '').toLowerCase().includes(ql);
  const tools = CIVIL_TOOLS.filter((t) => match(t.label + ' ' + t.desc));
  const fProjects = projects.filter((p) => match(p.nama + ' ' + (p.deskripsi || '')));
  const fDesigns = designs.filter((d) => match(d.nama));

  function onSearchKey(e) {
    if (e.key === 'Enter' && tools[0]) onOpen('civil', tools[0].tool);
    if (e.key === 'Escape') setQ('');
  }

  return (
    <div className="dash fade-in">
      {/* Top bar */}
      <header className="dash-top">
        <div>
          <h1>Selamat datang kembali, {nama}! <span className="wave">👋</span></h1>
          <p className="dash-date">{today} · Tetap semangat hari ini!</p>
        </div>
        <div className="dash-actions">
          <div className="dash-search">
            <Ic name="search" size={17} />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearchKey} placeholder="Cari tools, project, kalkulasi…" />
            {q && <button className="search-clear" title="Hapus" onClick={() => setQ('')}>✕</button>}
          </div>

          <div className="icon-pop-wrap">
            <button className={`icon-btn ${pop === 'notif' ? 'active' : ''}`} title="Notifikasi" onClick={() => setPop(pop === 'notif' ? null : 'notif')}>
              <Ic name="bell" size={18} /><span className="dot">3</span>
            </button>
            {pop === 'notif' && (
              <div className="pop" onClick={(e) => e.stopPropagation()}>
                <div className="pop-head"><Ic name="bell" size={16} /> Notifikasi</div>
                <p>Kita akan memberitahumu ketika ada informasi baru.</p>
              </div>
            )}
          </div>

          <div className="icon-pop-wrap">
            <button className={`icon-btn ${pop === 'help' ? 'active' : ''}`} title="Bantuan" onClick={() => setPop(pop === 'help' ? null : 'help')}>
              <Ic name="help" size={18} />
            </button>
            {pop === 'help' && (
              <div className="pop" onClick={(e) => e.stopPropagation()}>
                <div className="pop-head"><Ic name="help" size={16} /> Bantuan</div>
                <p>Jika ada kendala hubungi admin: <b>Bagas Yoga Mahendra</b></p>
                <p>email: <a href="mailto:bagasym48@gmail.com">bagasym48@gmail.com</a></p>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Stats + Quick Actions */}
      <div className="stat-row">
        <div className="stats-card">
          {stats.map((s, i) => (
            <div key={i} className={`stat acc-${s.acc}`} style={{ animationDelay: `${i * 60}ms` }}>
              <div className="stat-ico"><Ic name={s.icon} size={20} /></div>
              <div className="stat-txt">
                <span className="stat-label">{s.label}</span>
                <b className={s.small ? 'sm' : ''}>{s.val}</b>
                <small>{s.sub}</small>
              </div>
            </div>
          ))}
        </div>
        <div className="quick-actions">
          <h3>Quick Actions</h3>
          <div className="qa-grid">
            {quick.map((a, i) => (
              <button key={i} className="qa-btn" onClick={a.onClick}><Ic name={a.icon} size={16} /> {a.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Discipline cards */}
      <div className="disc-grid">
        {DISC_CARDS.map((c, i) => (
          <div key={c.id} className={`disc-card acc-${c.acc}`} style={{ animationDelay: `${i * 70}ms` }}>
            <div className="disc-card-top">
              <div className="disc-ico"><Ic name={c.icon} size={26} /></div>
              {!c.live && <span className="disc-soon">Soon</span>}
            </div>
            <h3>{c.label}</h3>
            <p>{c.desc}</p>
            <ul className="disc-feats">
              {c.feats.map((f, j) => <li key={j}><Ic name="check" size={15} /> {f}</li>)}
            </ul>
            <button className="disc-open" onClick={() => onOpen(c.id)}>{c.cta} <Ic name="arrow" size={15} /></button>
          </div>
        ))}
      </div>

      {/* Bottom: Civil tools + Recent project + Recent calculation */}
      <div className="dash-bottom">
        <section className="dash-panel">
          <div className="panel-head"><h2><Ic name="civil" size={17} /> Civil Engineering Tools</h2><button className="link-btn" onClick={() => onOpen('civil')}>Lihat Semua →</button></div>
          <div className="ct-grid">
            {tools.map((t) => (
              <button key={t.tool} className="ct-card" onClick={() => onOpen('civil', t.tool)}>
                <span className={`ct-ico ico-${t.tool}`}><Ic name={t.icon} size={20} /></span>
                <b>{t.label}</b>
                <small>{t.desc}</small>
                <span className="ct-foot"><i>{t.use}</i><span className="ct-open">Buka</span></span>
              </button>
            ))}
            {tools.length === 0 && <p className="role-hint">Tidak ada tool cocok "{q}".</p>}
          </div>
          <div className="fav-row">
            <span className="fav-label">Favorit saya</span>
            <span className="fav-chip"><Ic name="calc" size={13} /> Kalkulator Pondasi</span>
            <span className="fav-chip"><Ic name="box" size={13} /> MTO</span>
            <span className="fav-chip"><Ic name="chart" size={13} /> Progress</span>
          </div>
        </section>

        <section className="dash-panel">
          <div className="panel-head"><h2><Ic name="folder" size={17} /> Recent Project</h2><button className="link-btn" onClick={() => onOpen('civil', 'progress')}>Lihat Semua →</button></div>
          <div className="rp-list">
            {fProjects.length === 0 ? <p className="role-hint">{projects.length ? `Tidak ada project cocok "${q}".` : 'Belum ada project. Buat di tab Progress.'}</p> : fProjects.map((p) => {
              const overdue = p.target_date && new Date(p.target_date) < new Date();
              return (
                <button key={p.id} className="rp-item" onClick={() => onOpen('civil', 'progress')}>
                  <span className="rp-ico"><Ic name="civil" size={18} /></span>
                  <span className="rp-txt"><b>{p.nama}</b><small>{p.deskripsi || 'Project'} · {relTime(p.created_at)}</small></span>
                  <span className={`rp-stat ${overdue ? 'ov' : 'ok'}`}>{overdue ? 'Overdue' : 'Aktif'}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="dash-panel">
          <div className="panel-head"><h2><Ic name="calc" size={17} /> Recent Calculation</h2><button className="link-btn" onClick={() => onOpen('civil', 'calc')}>Lihat Semua →</button></div>
          <div className="rp-list">
            {fDesigns.length === 0 ? <p className="role-hint">{designs.length ? `Tidak ada kalkulasi cocok "${q}".` : 'Belum ada desain tersimpan.'}</p> : fDesigns.map((d) => (
              <button key={d.id} className="rp-item" onClick={() => onOpen('civil', 'calc')}>
                <span className="rp-ico"><Ic name="calc" size={18} /></span>
                <span className="rp-txt"><b>{d.nama}</b><small>{fmtDate(d.created_at)}</small></span>
                {d.overall_ok != null && <span className={`rp-stat ${d.overall_ok ? 'ok' : 'ov'}`}>{d.overall_ok ? 'AMAN' : 'TIDAK'}</span>}
              </button>
            ))}
          </div>
        </section>
      </div>

      <footer className="dash-foot">
        <span><b>RE-PROJECT</b> Engineering Suite <em>v1.0.0</em></span>
        <span>© 2026 RE-Project · Smarter Engineering Starts Here.</span>
      </footer>

      {pop && <div className="pop-backdrop" onClick={() => setPop(null)} />}
    </div>
  );
}
