// KalkulatorView.jsx — sub-tab kalkulator Civil:
// Pondasi Dangkal | Pondasi Equipment | Pipe Support.
import { useState } from 'react';
import CalculatorForm from './CalculatorForm.jsx';
import EquipmentFoundationForm from './EquipmentFoundationForm.jsx';
import PipeSupportForm from './PipeSupportForm.jsx';

const SUBS = [
  { id: 'pondasi', label: 'Pondasi Dangkal' },
  { id: 'equipment', label: 'Pondasi Equipment' },
  { id: 'pipe', label: 'Pipe Support' },
];

export default function KalkulatorView({ userId, profile, userEmail, equip, setEquip, pondasi, setPondasi, pipe, setPipe }) {
  const [sub, setSub] = useState('pondasi');
  return (
    <div className="kalk">
      <div className="kalk-subtabs">
        {SUBS.map((x) => (
          <button key={x.id} className={sub === x.id ? 'active' : ''} onClick={() => setSub(x.id)}>{x.label}</button>
        ))}
      </div>
      {sub === 'pondasi' && <CalculatorForm userId={userId} profile={profile} userEmail={userEmail} fd={pondasi} setFd={setPondasi} />}
      {sub === 'equipment' && <EquipmentFoundationForm s={equip} setS={setEquip} />}
      {sub === 'pipe' && <PipeSupportForm s={pipe} setS={setPipe} />}
    </div>
  );
}
