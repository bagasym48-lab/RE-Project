// Shell.jsx — kerangka aplikasi: dashboard + sidebar disiplin.
// Dashboard = landing setelah login. Sidebar: Dashboard + disiplin (Civil,
// Mechanical, Process, Piping). Civil membuka tools (Kalkulator/MTO/Progress);
// disiplin lain = placeholder "segera hadir".
import { useState } from 'react';
import Dashboard from './Dashboard.jsx';
import CivilView from './CivilView.jsx';
import { LogoMark } from './Logo.jsx';

const DISCIPLINES = [
  { id: 'civil', label: 'Civil', icon: '🏗️' },
  { id: 'mechanical', label: 'Mechanical', icon: '⚙️' },
  { id: 'process', label: 'Process', icon: '⚗️' },
  { id: 'piping', label: 'Piping', icon: '🚰' },
];

const DISC_INFO = {
  mechanical: { label: 'Mechanical Engineering', icon: '⚙️', desc: 'Tools & utilitas teknik mesin' },
  process: { label: 'Process Engineering', icon: '⚗️', desc: 'Kalkulasi teknik proses' },
  piping: { label: 'Piping Engineering', icon: '🚰', desc: 'Tools & kalkulasi perpipaan' },
};

function DisciplinePlaceholder({ id, onBack }) {
  const info = DISC_INFO[id] || { label: id, icon: '🚧', desc: '' };
  return (
    <div className="disc-empty fade-in">
      <div className="disc-empty-ico">{info.icon}</div>
      <h1>{info.label}</h1>
      <p>{info.desc}</p>
      <div className="disc-empty-badge">🚧 Segera hadir</div>
      <p className="disc-empty-note">Modul untuk disiplin ini belum tersedia. Saat ini tools aktif ada di disiplin <b>Civil</b>.</p>
      <button className="btn" onClick={onBack}>← Kembali ke Dashboard</button>
    </div>
  );
}

export default function Shell({ session, profile, onLogout }) {
  const [view, setView] = useState('dashboard');
  const [civilTool, setCivilTool] = useState('calc');
  const role = profile?.role || 'viewer';
  const nama = profile?.nama || session.user.email;
  const initial = (nama || '?').trim().charAt(0).toUpperCase();

  const open = (v, tool) => { setView(v); if (tool) setCivilTool(tool); };

  return (
    <div className="ds">
      <aside className="ds-side">
        <div className="ds-brand">
          <LogoMark size={34} />
          <div className="ds-brand-txt"><b>RE-PROJECT</b><span>Engineering Suite</span></div>
        </div>

        <nav className="ds-nav">
          <button className={`ds-link ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>
            <span className="ico">🏠</span> Dashboard
          </button>
          <div className="ds-nav-label">Disiplin</div>
          {DISCIPLINES.map((d) => (
            <button key={d.id} className={`ds-link ${view === d.id ? 'active' : ''}`} onClick={() => setView(d.id)}>
              <span className="ico">{d.icon}</span> {d.label}
            </button>
          ))}
        </nav>

        <div className="ds-user">
          <div className="ds-user-av">{initial}</div>
          <div className="ds-user-info">
            <b title={nama}>{nama}</b>
            <span className={`role role-${role}`}>{role}</span>
          </div>
          <button className="ds-logout" onClick={onLogout} title="Keluar">⎋</button>
        </div>
      </aside>

      <main className="ds-main">
        {view === 'dashboard' && <Dashboard nama={nama} onOpen={open} />}
        {view === 'civil' && (
          <CivilView
            userId={session.user.id} role={role} profile={profile} userEmail={session.user.email}
            tool={civilTool} onTool={setCivilTool}
          />
        )}
        {(view === 'mechanical' || view === 'process' || view === 'piping') && (
          <DisciplinePlaceholder id={view} onBack={() => setView('dashboard')} />
        )}
      </main>
    </div>
  );
}
