// CivilView.jsx — disiplin Civil: tiga tools (Kalkulator, MTO, Progress).
import { useState } from 'react';
import KalkulatorView from './KalkulatorView.jsx';
import MtoPage from './MtoPage.jsx';
import ProgressPage from './ProgressPage.jsx';
import { def as equipDef } from './equipmentFoundationCalc.js';

const TOOLS = [
  { id: 'calc', icon: '🧮', label: 'Kalkulator' },
  { id: 'mto', icon: '📦', label: 'MTO' },
  { id: 'progress', icon: '📊', label: 'Progress' },
];

// Input pondasi equipment "diangkat" ke sini agar Kalkulator & MTO memakai satu
// sumber yang sama → ubah dimensi di kalkulasi, MTO ikut berubah otomatis.
const EQUIP_KEY = 'equipFoundationInput';
function loadEquip() {
  try {
    const raw = localStorage.getItem(EQUIP_KEY);
    if (raw) return { ...equipDef, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return equipDef;
}

export default function CivilView({ userId, role, profile, userEmail, tool, onTool }) {
  const t = tool || 'calc';
  const [equip, setEquipState] = useState(loadEquip);
  const setEquip = (updater) => setEquipState((prev) => {
    const next = typeof updater === 'function' ? updater(prev) : updater;
    try { localStorage.setItem(EQUIP_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  return (
    <div className="civil fade-in">
      <div className="civil-head">
        <div className="civil-title">
          <span className="civil-ico">🏗️</span>
          <div><h1>Civil Engineering</h1><p>Tools & kalkulasi teknik sipil</p></div>
        </div>
        <div className="civil-tabs">
          {TOOLS.map((x) => (
            <button key={x.id} className={t === x.id ? 'active' : ''} onClick={() => onTool(x.id)}>
              <span className="ci">{x.icon}</span> {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="civil-body">
        {t === 'calc' && <KalkulatorView userId={userId} profile={profile} userEmail={userEmail} equip={equip} setEquip={setEquip} />}
        {t === 'mto' && <MtoPage equip={equip} />}
        {t === 'progress' && <ProgressPage userId={userId} role={role} />}
      </div>
    </div>
  );
}
