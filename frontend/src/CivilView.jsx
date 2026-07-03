// CivilView.jsx — disiplin Civil: tiga tools (Kalkulator, MTO, Progress).
import { useState } from 'react';
import KalkulatorView from './KalkulatorView.jsx';
import MtoPage from './MtoPage.jsx';
import ProgressPage from './ProgressPage.jsx';
import { defaultFoundation } from './CalculatorForm.jsx';
import { def as pipeDef } from './PipeSupportForm.jsx';
import { def as equipDef } from './equipmentFoundationCalc.js';
import { defProject } from './reportKit.jsx';

const TOOLS = [
  { id: 'calc', icon: '🧮', label: 'Kalkulator' },
  { id: 'mto', icon: '📦', label: 'MTO' },
  { id: 'progress', icon: '📊', label: 'Progress' },
];

// Input tiap kalkulasi "diangkat" ke sini agar Kalkulator & MTO memakai satu sumber
// yang sama → ubah dimensi di kalkulasi, MTO ikut berubah otomatis. Persist ke localStorage.
function usePersistedState(key, initial) {
  const [state, setState] = useState(() => {
    try { const raw = localStorage.getItem(key); if (raw) return { ...initial, ...JSON.parse(raw) }; } catch { /* ignore */ }
    return initial;
  });
  const set = (updater) => setState((prev) => {
    const next = typeof updater === 'function' ? updater(prev) : updater;
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  return [state, set];
}

export default function CivilView({ userId, role, profile, userEmail, tool, onTool }) {
  const t = tool || 'calc';
  const [pondasi, setPondasi] = usePersistedState('pondasiInput', defaultFoundation);
  const [equip, setEquip] = usePersistedState('equipFoundationInput', equipDef);
  const [pipe, setPipe] = usePersistedState('pipeInput', pipeDef);
  const [project, setProject] = usePersistedState('projectInfo', defProject);
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
        {t === 'calc' && <KalkulatorView userId={userId} profile={profile} userEmail={userEmail} pondasi={pondasi} setPondasi={setPondasi} equip={equip} setEquip={setEquip} pipe={pipe} setPipe={setPipe} project={project} setProject={setProject} />}
        {t === 'mto' && <MtoPage pondasi={pondasi} equip={equip} pipe={pipe} />}
        {t === 'progress' && <ProgressPage userId={userId} role={role} />}
      </div>
    </div>
  );
}
