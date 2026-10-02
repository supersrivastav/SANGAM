import { useState, useEffect } from 'react';
import { useFlowStore } from '../../store/useFlowStore';

export default function StaffPanel() {
  const { config, sim, simTick, selectedResourceId, setSelectedResourceId, staffMarkDone, injectDelay } = useFlowStore();
  const [localResource, setLocalResource] = useState(selectedResourceId || config.resources[0]?.id || '');

  useEffect(() => {
    setLocalResource(config.resources[0]?.id || '');
  }, [config.id]);

  const staffView = sim.getStaffView(localResource);

  const formatTime = (min: number | undefined) => {
    if (min === undefined) return '--:--';
    const h = Math.floor(min / 60);
    const m = Math.floor(min % 60);
    return `${String(9 + h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Resource selector */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-bold text-primary-300 uppercase tracking-wider mb-3">
          👨‍💼 I am at:
        </h2>
        <select
          id="staff-resource-select"
          value={localResource}
          onChange={e => setLocalResource(e.target.value)}
          className="select-field w-full text-lg"
        >
          {config.resources.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {staffView && (
        <>
          {/* Now Serving */}
          {staffView.nowServing.map((serving, idx) => (
            <div key={idx} className="glass-card p-6 bg-status-green border-green-500/30">
              <div className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">
                Now Serving {staffView.resource.count > 1 ? `(Server ${serving.serverIndex + 1})` : ''}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-green-200">{serving.customer.name}</h3>
                  <p className="text-sm text-green-300/70 mt-1">
                    {config.services.find(s => s.id === serving.customer.serviceId)?.steps.find(s => s.id === serving.stepId)?.name}
                  </p>
                  <p className="text-xs text-green-400/60 mt-1">
                    Est. done by {formatTime(serving.busyUntil)}
                  </p>
                </div>
                <button
                  id={`mark-done-${serving.serverIndex}`}
                  onClick={() => staffMarkDone(localResource, serving.serverIndex)}
                  className="btn btn-success text-lg px-6 py-3"
                >
                  ✅ Mark Done
                </button>
              </div>
            </div>
          ))}

          {staffView.nowServing.length === 0 && (
            <div className="glass-card p-8 text-center">
              <div className="text-4xl mb-3">💤</div>
              <h3 className="text-xl font-bold text-surface-500">No one being served</h3>
              <p className="text-surface-500 text-sm mt-1">Waiting for next {config.labels.customer.toLowerCase()}</p>
            </div>
          )}

          {/* Next Up */}
          <div className="glass-card p-5">
            <div className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-3">
              Next Up
            </div>
            {staffView.nextUp ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-800/40">
                <div>
                  <h4 className="font-bold text-surface-800">{staffView.nextUp.customer.name}</h4>
                  <p className="text-xs text-surface-500">
                    {config.services.find(s => s.id === staffView.nextUp!.customer.serviceId)?.steps.find(s => s.id === staffView.nextUp!.stepId)?.name}
                  </p>
                </div>
                <span className="badge badge-amber">Waiting</span>
              </div>
            ) : (
              <p className="text-surface-500 text-sm text-center py-3">No one waiting</p>
            )}

            <div className="mt-3 text-right text-sm text-surface-500">
              Queue: <strong className="text-surface-700">{staffView.queueLength}</strong> {config.labels.customer.toLowerCase()}(s)
            </div>
          </div>

          {/* Report Delay */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-bold text-primary-300 uppercase tracking-wider mb-3">
              ⚠️ Report Delay
            </h2>
            <div className="flex gap-2">
              {[10, 20, 30].map(min => (
                <button
                  key={min}
                  onClick={() => injectDelay(localResource, min)}
                  className="btn btn-danger btn-sm flex-1"
                >
                  +{min} min
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
