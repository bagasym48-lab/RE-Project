// Shell.jsx — kerangka aplikasi setelah login: top-nav (Kalkulator | Progress),
// info user + tombol keluar, dan switch halaman.
import { useState } from 'react';
import CalculatorForm from './CalculatorForm.jsx';
import ProgressPage from './ProgressPage.jsx';
import { LogoMark } from './Logo.jsx';

export default function Shell({ session, profile, onLogout }) {
  const [tab, setTab] = useState('calc');
  const role = profile?.role || 'viewer';

  return (
    <>
      <div className="topnav">
        <div className="brand"><LogoMark size={44} /></div>
        <nav className="tabs">
          <button className={tab === 'calc' ? 'active' : ''} onClick={() => setTab('calc')}>Kalkulator</button>
          <button className={tab === 'progress' ? 'active' : ''} onClick={() => setTab('progress')}>Progress</button>
        </nav>
        <div className="who">
          <strong>{profile?.nama || session.user.email}</strong>
          <span className={`role role-${role}`}>{role}</span>
          <button className="logout" onClick={onLogout}>Keluar</button>
        </div>
      </div>

      {tab === 'calc'
        ? <CalculatorForm userId={session.user.id} profile={profile} userEmail={session.user.email} />
        : <ProgressPage userId={session.user.id} role={role} />}
    </>
  );
}
