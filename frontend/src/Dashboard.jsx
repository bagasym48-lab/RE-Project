// Dashboard.jsx — landing setelah login: sapaan + kartu disiplin + akses cepat Civil.
const CARDS = [
  { id: 'civil', label: 'Civil', desc: 'Kalkulasi & tools teknik sipil', tools: '3 Tools', icon: '🏗️', acc: 'civil', live: true },
  { id: 'mechanical', label: 'Mechanical', desc: 'Tools & utilitas teknik mesin', tools: 'Segera', icon: '⚙️', acc: 'mech', live: false },
  { id: 'process', label: 'Process', desc: 'Kalkulasi teknik proses', tools: 'Segera', icon: '⚗️', acc: 'process', live: false },
  { id: 'piping', label: 'Piping', desc: 'Tools & kalkulasi perpipaan', tools: 'Segera', icon: '🚰', acc: 'piping', live: false },
];

const CIVIL_TOOLS = [
  { tool: 'calc', icon: '🧮', label: 'Kalkulator Pondasi', desc: 'Hitung pondasi dangkal & cek keamanan' },
  { tool: 'mto', icon: '📦', label: 'MTO', desc: 'Volume & harga material (beton, besi, pipa)' },
  { tool: 'progress', icon: '📊', label: 'Progress', desc: 'Project, dokumen & kurva-S' },
];

export default function Dashboard({ nama, onOpen }) {
  return (
    <div className="dash fade-in">
      <header className="dash-head">
        <h1>Selamat datang kembali, {nama}! 👋</h1>
        <p>Pilih disiplin atau akses tools Anda di bawah.</p>
      </header>

      <h2 className="dash-sec">Disiplin</h2>
      <div className="disc-grid">
        {CARDS.map((c, i) => (
          <div key={c.id} className={`disc-card acc-${c.acc}`} style={{ animationDelay: `${i * 70}ms` }}>
            <div className="disc-ico">{c.icon}</div>
            <h3>{c.label}</h3>
            <p>{c.desc}</p>
            <span className="disc-tools">{c.tools}</span>
            <button className="disc-open" onClick={() => onOpen(c.id)}>{c.live ? 'Buka' : 'Lihat'}</button>
          </div>
        ))}
      </div>

      <div className="dash-quick">
        <div className="quick-head">
          <h2>Civil Engineering</h2>
          <button className="link-btn" onClick={() => onOpen('civil')}>Ke Civil Dashboard →</button>
        </div>
        <div className="quick-grid">
          {CIVIL_TOOLS.map((t, i) => (
            <button key={t.tool} className="quick-card" style={{ animationDelay: `${300 + i * 70}ms` }} onClick={() => onOpen('civil', t.tool)}>
              <span className="quick-ico">{t.icon}</span>
              <span className="quick-txt"><b>{t.label}</b><small>{t.desc}</small></span>
              <span className="quick-arrow">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
