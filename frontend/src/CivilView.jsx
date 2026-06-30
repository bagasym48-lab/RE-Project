// CivilView.jsx — disiplin Civil: tiga tools (Kalkulator, MTO, Progress).
import CalculatorForm from './CalculatorForm.jsx';
import MtoPage from './MtoPage.jsx';
import ProgressPage from './ProgressPage.jsx';

const TOOLS = [
  { id: 'calc', icon: '🧮', label: 'Kalkulator' },
  { id: 'mto', icon: '📦', label: 'MTO' },
  { id: 'progress', icon: '📊', label: 'Progress' },
];

export default function CivilView({ userId, role, profile, userEmail, tool, onTool }) {
  const t = tool || 'calc';
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
        {t === 'calc' && <CalculatorForm userId={userId} profile={profile} userEmail={userEmail} />}
        {t === 'mto' && <MtoPage />}
        {t === 'progress' && <ProgressPage userId={userId} role={role} />}
      </div>
    </div>
  );
}
