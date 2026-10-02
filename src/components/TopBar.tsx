import { useFlowStore } from '../store/useFlowStore';

export default function TopBar() {
  const {
    config, activeDomainId, configs, switchDomain,
    activeTab, setActiveTab, sim, simTick,
    speed, setSpeed, running, toggleRunning, loadDemo, logout, authRole
  } = useFlowStore();

  const formatClock = (min: number) => {
    const h = Math.floor(min / 60);
    const m = Math.floor(min % 60);
    const baseH = 9 + h; // Start at 9:00 AM
    return `${String(baseH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const allTabs = [
    { id: 'customer' as const, label: `🧑 ${config.labels.customer}`, icon: '🧑', roles: ['customer', 'admin'] },
    { id: 'staff' as const, label: '👨‍💼 Staff', icon: '👨‍💼', roles: ['staff', 'admin'] },
    { id: 'admin' as const, label: '📊 Admin', icon: '📊', roles: ['admin'] },
  ];

  const tabs = allTabs.filter(t => t.roles.includes(authRole || 'customer'));

  return (
    <header className="sticky top-0 z-50" style={{
      background: 'rgba(253, 253, 254, 0.85)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid #c8ccd5',
    }}>
      <div className="max-w-[1400px] mx-auto px-4 md:px-6">
        {/* Top row */}
        <div className="flex items-center justify-between py-3 gap-4 flex-wrap">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center text-lg"
              style={{
                background: '#1167f6',
                boxShadow: '0 4px 12px rgba(17, 103, 246, 0.3)',
                color: 'white',
                borderRadius: '12px'
              }}>
              ⚡
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-surface-800">FlowDesk</h1>
              <p className="text-[10px] text-surface-500 -mt-0.5">{config.name}</p>
            </div>
          </div>

          {/* Domain Switcher */}
          <div className="flex items-center gap-3">
            <select
              id="domain-switcher"
              value={activeDomainId}
              onChange={e => switchDomain(e.target.value)}
              className="select-field text-sm"
              aria-label="Select domain"
            >
              {Object.entries(configs).map(([id, cfg]) => (
                <option key={id} value={id}>{cfg.name}</option>
              ))}
            </select>
            <button
              onClick={logout}
              className="btn btn-ghost btn-sm text-surface-500 hover:text-surface-800"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="pb-2 flex justify-center">
          <div className="tab-bar">
            {tabs.map(tab => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
