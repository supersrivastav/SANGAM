import { useState } from 'react';
import { useFlowStore } from '../../store/useFlowStore';

export default function AdminDashboard() {
  const {
    config, sim, simTick, injectDelay,
    addRandomCustomer, running, toggleRunning,
    speed, setSpeed, loadDemo, setAutoArrivals
  } = useFlowStore();

  const [delayResource, setDelayResource] = useState(config.resources[0]?.id || '');
  const [autoArrivals, setAutoArrivalsLocal] = useState(sim.autoArrivals);

  const resourceStats = sim.getResourceStats();
  const recentEvents = [...sim.events].reverse().slice(0, 30);

  const toggleAutoArrivals = () => {
    const next = !autoArrivals;
    setAutoArrivalsLocal(next);
    setAutoArrivals(next);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Add Counter */}
        <div className="glass-card p-4 flex flex-col justify-center">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-bold text-primary-300 uppercase tracking-wider mr-auto">
              ➕ Add Counter
            </h2>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const nameInput = form.elements.namedItem('counterName') as HTMLInputElement;
                const countInput = form.elements.namedItem('counterCount') as HTMLInputElement;
                if (nameInput.value && countInput.value) {
                  useFlowStore.getState().addResource(nameInput.value, parseInt(countInput.value));
                  nameInput.value = '';
                  countInput.value = '1';
                }
              }}
              className="flex items-center gap-2"
            >
              <input type="text" name="counterName" placeholder="Counter Name" className="input-field text-sm w-40 py-1" required />
              <input type="number" name="counterCount" defaultValue="1" min="1" className="input-field text-sm w-20 py-1" required />
              <button type="submit" className="btn btn-primary btn-sm">Add</button>
            </form>
            <button id="add-customer-btn" onClick={addRandomCustomer} className="btn btn-ghost btn-sm ml-2">
              ➕ Add Random {config.labels.customer}
            </button>
          </div>
        </div>

        {/* Register Staff */}
        <div className="glass-card p-4">
          <h2 className="text-sm font-bold text-primary-300 uppercase tracking-wider mb-3">
            👨‍💼 Register Staff
          </h2>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const name = (form.elements.namedItem('staffName') as HTMLInputElement).value;
              const role = (form.elements.namedItem('staffRole') as HTMLSelectElement).value;
              alert(`Success! Staff member ${name} registered for role ${role}. (Demo mode: credentials sent)`);
              form.reset();
            }}
            className="flex items-center gap-2 flex-wrap"
          >
            <input type="text" name="staffName" placeholder="Staff Name" className="input-field text-sm flex-1 py-1 min-w-[120px]" required />
            <select name="staffRole" className="select-field text-sm flex-1 py-1 min-w-[120px]" required>
              {config.resources.map((r: any) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary btn-sm">Register</button>
          </form>
        </div>
      </div>

      {/* Resource Cards */}
      <div>
        <h2 className="text-sm font-bold text-primary-300 uppercase tracking-wider mb-3">
          📊 {config.labels.resource} Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resourceStats.map(stat => {
            const isBottleneck = stat.predictedWait > stat.threshold;
            const isWarning = stat.predictedWait > stat.threshold * 0.5 && !isBottleneck;
            const statusClass = isBottleneck ? 'bottleneck' : isWarning ? 'warning' : '';

            return (
              <div
                key={stat.resourceId}
                id={`resource-card-${stat.resourceId}`}
                className={`glass-card-sm p-4 resource-card-status ${statusClass}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-surface-800">{stat.resourceName}</h3>
                  {isBottleneck && <span className="badge badge-red">🔴 Bottleneck</span>}
                  {isWarning && <span className="badge badge-amber">🟡 Watch</span>}
                  {!isBottleneck && !isWarning && <span className="badge badge-green">🟢 OK</span>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-surface-500">Queue</div>
                    <div className="text-xl font-bold text-surface-800">{stat.queueLength}</div>
                  </div>
                  <div>
                    <div className="text-xs text-surface-500">Wait</div>
                    <div className={`text-xl font-bold ${isBottleneck ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-green-400'}`}>
                      {stat.predictedWait}m
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-surface-500">Utilization</div>
                    <div className="text-xl font-bold text-surface-800">{stat.utilization}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-surface-500">Servers</div>
                    <div className="text-xl font-bold text-surface-800">
                      {stat.busyServers}/{stat.totalServers}
                    </div>
                  </div>
                </div>

                {/* Serving info */}
                {stat.currentCustomers.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-surface-700/50">
                    <div className="text-xs text-surface-500 mb-1">Currently serving:</div>
                    {stat.currentCustomers.map((c, i) => {
                      const cust = c.customerId ? sim.customers.get(c.customerId) : undefined;
                      return cust ? (
                        <div key={i} className="text-xs text-surface-700">{cust.name}</div>
                      ) : null;
                    })}
                  </div>
                )}

                {/* Progress bar */}
                <div className="mt-3 h-1.5 rounded-full bg-surface-700/50 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${stat.utilization}%`,
                      background: isBottleneck
                        ? 'linear-gradient(90deg, #ef4444, #f87171)'
                        : isWarning
                        ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                        : 'linear-gradient(90deg, #10b981, #34d399)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Delay Injector + Suggestions */}
        <div className="space-y-4">
          {/* Delay Injector */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-bold text-primary-300 uppercase tracking-wider mb-3">
              ⚡ Inject Delay
            </h2>
            <div className="space-y-3">
              <select
                value={delayResource}
                onChange={e => setDelayResource(e.target.value)}
                className="select-field w-full"
              >
                {config.resources.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                {[10, 20, 30].map(min => (
                  <button
                    key={min}
                    id={`inject-delay-${min}`}
                    onClick={() => injectDelay(delayResource, min)}
                    className="btn btn-danger btn-sm flex-1"
                  >
                    +{min} min
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* AI Copilot */}
          <div className="glass-card ai-copilot-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="text-xl">✨</span>
              <span className="ai-gradient-text">FlowDesk AI Copilot</span>
            </h2>
            <div className="space-y-3 min-h-[100px]">
              {sim.suggestions.length > 0 ? (
                sim.suggestions.slice(0, 4).map((s: string, i: number) => (
                  <div key={`${s}-${i}`} className="ai-bubble">
                    <span className="typewriter-text font-mono inline-block">{s}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <div className="w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin mx-auto mb-3"></div>
                  <p className="text-surface-500 text-sm italic">Monitoring floor activity...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Event Log */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-bold text-primary-300 uppercase tracking-wider mb-3">
            📜 Event Log
          </h2>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {recentEvents.length > 0 ? (
              recentEvents.map((evt, i) => {
                const formatTime = (min: number) => {
                  const h = Math.floor(min / 60);
                  const m = Math.floor(min % 60);
                  return `${String(9 + h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                };
                const logClass = evt.type === 'delay-injected' ? 'delay' :
                  evt.type === 'replan' ? 'replan' :
                  evt.type === 'suggestion' ? 'suggestion' : '';
                return (
                  <div key={i} className={`event-log-entry ${logClass}`}>
                    <span className="font-mono text-surface-500 mr-2">{formatTime(evt.time)}</span>
                    {evt.message}
                  </div>
                );
              })
            ) : (
              <p className="text-surface-500 text-sm text-center py-6">No events yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
