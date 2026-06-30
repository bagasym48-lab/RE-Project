// Shell.jsx — kerangka aplikasi: dashboard EPC + sidebar (Disiplin/Project/Tools).
// Hanya Civil yang fungsional; disiplin lain & beberapa item = placeholder.
import { useState } from 'react';
import Dashboard from './Dashboard.jsx';
import CivilView from './CivilView.jsx';
import { LogoMark } from './Logo.jsx';
import Ic from './Icons.jsx';

const DISCIPLINES = [
  { id: 'civil', label: 'Civil', icon: 'civil', count: 3, soon: false },
  { id: 'mechanical', label: 'Mechanical', icon: 'mechanical', count: 4, soon: true },
  { id: 'process', label: 'Process', icon: 'process', count: 3, soon: true },
  { id: 'piping', label: 'Piping', icon: 'piping', count: 4, soon: true },
];

const DISC_INFO = {
  mechanical: { label: 'Mechanical Engineering', icon: 'mechanical', desc: 'Tools & utilitas teknik mesin' },
  process: { label: 'Process Engineering', icon: 'process', desc: 'Kalkulasi teknik proses' },
  piping: { label: 'Piping Engineering', icon: 'piping', desc: 'Tools & kalkulasi perpipaan' },
};

function Placeholder({ icon, label, desc, onBack }) {
  return (
    <div className="disc-empty fade-in">
      <div className="disc-empty-ico"><Ic name={icon} size={40} /></div>
      <h1>{label}</h1>
      <p>{desc}</p>
      <div className="disc-empty-badge">🚧 Segera hadir</div>
      <p className="disc-empty-note">Modul ini belum tersedia. Tools aktif saat ini ada di disiplin <b>Civil</b>.</p>
      <button className="btn" onClick={onBack}>← Kembali ke Dashboard</button>
    </div>
  );
}

export default function Shell({ session, profile, onLogout }) {
  const [view, setView] = useState('dashboard');
  const [civilTool, setCivilTool] = useState('calc');
  const [soon, setSoon] = useState(null);
  const role = profile?.role || 'viewer';
  const nama = profile?.nama || session.user.email;
  const initial = (nama || '?').trim().charAt(0).toUpperCase();

  const open = (v, tool) => {
    setView(v);
    if (tool) { setCivilTool(tool); try { localStorage.setItem('lastTool', tool); } catch { /* ignore */ } }
  };
  const goSoon = (label) => { setSoon(label); setView('soon'); };

  const NavLink = ({ id, icon, label, count, soonTag, onClick }) => (
    <button className={`ds-link ${view === id ? 'active' : ''}`} onClick={onClick}>
      <span className="ico"><Ic name={icon} size={17} /></span>
      <span className="lbl">{label}</span>
      {count != null && <span className="ds-badge">{count}</span>}
      {soonTag && <span className="ds-soon">Soon</span>}
    </button>
  );

  return (
    <div className="ds">
      <aside className="ds-side">
        <div className="ds-brand">
          <LogoMark size={32} />
          <div className="ds-brand-txt"><b>RE-PROJECT</b><span>Engineering Suite</span></div>
        </div>

        <nav className="ds-nav">
          <NavLink id="dashboard" icon="dashboard" label="Dashboard" onClick={() => setView('dashboard')} />

          <div className="ds-nav-label">Disiplin</div>
          {DISCIPLINES.map((d) => (
            <NavLink key={d.id} id={d.id} icon={d.icon} label={d.label} count={d.count} soonTag={d.soon} onClick={() => setView(d.id)} />
          ))}

          <div className="ds-nav-label">Project</div>
          <NavLink icon="folder" label="Project Saya" onClick={() => open('civil', 'progress')} />
          <NavLink icon="clock" label="Recent Project" onClick={() => open('civil', 'progress')} />
          <NavLink icon="template" label="Template Project" onClick={() => goSoon('Template Project')} />

          <div className="ds-nav-label">Tools</div>
          <NavLink icon="tools" label="Semua Tools" onClick={() => open('civil', 'calc')} />
          <NavLink icon="star" label="Favorites" onClick={() => goSoon('Favorites')} />
          <NavLink icon="trash" label="Recycle Bin" onClick={() => goSoon('Recycle Bin')} />
        </nav>

        <div className="ds-user">
          <div className="ds-user-av">{initial}</div>
          <div className="ds-user-info">
            <b title={nama}>{nama}</b>
            <span className={`role role-${role}`}>{role}</span>
          </div>
          <button className="ds-logout" onClick={onLogout} title="Keluar"><Ic name="settings" size={16} /></button>
        </div>
      </aside>

      <main className="ds-main">
        {view === 'dashboard' && <Dashboard nama={nama} userId={session.user.id} onOpen={open} />}
        {view === 'civil' && (
          <CivilView
            userId={session.user.id} role={role} profile={profile} userEmail={session.user.email}
            tool={civilTool} onTool={(t) => open('civil', t)}
          />
        )}
        {(view === 'mechanical' || view === 'process' || view === 'piping') && (
          <Placeholder {...DISC_INFO[view]} onBack={() => setView('dashboard')} />
        )}
        {view === 'soon' && (
          <Placeholder icon="flame" label={soon} desc="Fitur ini sedang dikembangkan." onBack={() => setView('dashboard')} />
        )}
      </main>
    </div>
  );
}
