import { useState, useEffect } from 'react';
import { useFlowStore } from '../../store/useFlowStore';

export default function CustomerView() {
  const { config, sim, simTick, selectedCustomerId, setSelectedCustomerId, addCustomer } = useFlowStore();
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>(config.priorityClasses[config.priorityClasses.length - 1]?.id || '');
  const [checkedReqs, setCheckedReqs] = useState<Record<string, boolean>>({});
  const [showJourney, setShowJourney] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResponse, setAiResponse] = useState('');

  // Reset when domain changes
  useEffect(() => {
    setSelectedServiceId('');
    setSelectedPriority(config.priorityClasses[config.priorityClasses.length - 1]?.id || '');
    setCheckedReqs({});
    setShowJourney(false);
  }, [config.id]);

  const service = config.services.find(s => s.id === selectedServiceId);
  const allCriticalChecked = service ?
    service.requirements.filter(r => r.critical).every(r => checkedReqs[r.id]) : false;
  const missingCritical = service ?
    service.requirements.filter(r => r.critical && !checkedReqs[r.id]) : [];

  const handleJoin = () => {
    if (!service) return;
    const missingReqs = service.requirements
      .filter(r => r.critical && !checkedReqs[r.id])
      .map(r => r.id);
    addCustomer(selectedServiceId, selectedPriority, missingReqs);
    setShowJourney(true);
  };

  const handleAiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    setIsAnalyzing(true);
    setAiResponse('');
    
    setTimeout(() => {
      setIsAnalyzing(false);
      const text = chatInput.toLowerCase();
      let foundService = null;
      
      // Smart heuristic matching
      const intentMap: Record<string, string[]> = {
        'opd': ['sick', 'pain', 'doctor', 'checkup', 'fever', 'headache', 'hurt'],
        'blood test': ['blood', 'test', 'lab', 'sample'],
        'x-ray': ['bone', 'break', 'xray', 'x-ray', 'scan'],
        'haircut': ['hair', 'cut', 'trim', 'fade', 'style'],
        'facial': ['facial', 'skin', 'face', 'acne', 'glow'],
        'hair color': ['color', 'dye', 'bleach', 'highlights'],
        'cash deposit': ['deposit', 'money', 'cash', 'save'],
        'loan application': ['loan', 'borrow', 'credit', 'mortgage'],
        'birth certificate': ['birth', 'born', 'child'],
        'income certificate': ['income', 'salary', 'tax'],
      };

      for (const svc of config.services) {
        const nameLower = svc.name.toLowerCase();
        // Check direct name match
        if (text.includes(nameLower)) {
          foundService = svc;
          break;
        }
        
        // Check intent map
        for (const [key, words] of Object.entries(intentMap)) {
          if (nameLower.includes(key)) {
            if (words.some(w => text.includes(w))) {
              foundService = svc;
              break;
            }
          }
        }
        
        // Check generic long words in service name
        if (!foundService) {
           const keywords = nameLower.split(' ').filter((w: string) => w.length > 4);
           if (keywords.length > 0 && keywords.some((kw: string) => text.includes(kw))) {
             foundService = svc;
             break;
           }
        }
        if (foundService) break;
      }
      
      if (!foundService) {
        setAiResponse(`I'm not quite sure which service you need based on that. Could you provide a bit more detail about what you'd like to do today at ${config.name}?`);
        return;
      }
      
      setSelectedServiceId(foundService.id);
      setCheckedReqs({});
      setShowJourney(false);
      
      const counters = [...new Set(foundService.steps.map((s: any) => {
        const resource = config.resources.find((r: any) => r.id === s.resourceId);
        return resource ? resource.name : s.resourceId;
      }))];
      
      const responses = [
        `Based on your needs, I recommend the **${foundService.name}** service. This will require visiting: ${counters.join(' → ')}. I've selected it for you!`,
        `It sounds like you need a **${foundService.name}**. I've set that up for you below. You'll need to go to ${counters.join(' and then ')}.`,
        `I can help with that! The best option is **${foundService.name}**. Please check the requirements below before joining the queue for ${counters[0]}.`
      ];
      
      setAiResponse(responses[Math.floor(Math.random() * responses.length)]);
    }, 1500 + Math.random() * 1000); // Random delay between 1.5s - 2.5s for realism
  };

  // Get active customers for the sidebar
  const activeCustomers = Array.from(sim.customers.values())
    .filter(c => !c.completedAt)
    .sort((a, b) => b.arrivalTime - a.arrivalTime)
    .slice(0, 20);

  const completedCustomers = Array.from(sim.customers.values())
    .filter(c => c.completedAt)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
    .slice(0, 5);

  const journey = selectedCustomerId ? sim.getCustomerJourney(selectedCustomerId) : null;

  // Notifications for selected customer
  const customerNotifs = selectedCustomerId
    ? sim.notifications.filter(n => n.customerId === selectedCustomerId).slice(-3)
    : [];

  return (
    <div className="flex flex-col-reverse lg:grid lg:grid-cols-3 gap-6">
      {/* Left panel: Service picker + Requirements */}
      <div className="lg:col-span-1 space-y-4">
        {/* AI Receptionist */}
        <div className="glass-card ai-copilot-card p-4 lg:p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="text-lg">✨</span>
            <span className="ai-gradient-text">AI Receptionist</span>
          </h2>
          <p className="text-xs text-surface-500 mb-4">Not sure what you need? Tell me what you're here for and I'll route you.</p>
          <form onSubmit={handleAiSubmit} className="flex flex-col gap-3">
            <textarea
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder={`e.g., "I need a haircut" or "I want to deposit money"`}
              className="input-field text-sm resize-none h-20"
              required
            />
            <button type="submit" className="btn btn-primary btn-sm w-full" disabled={isAnalyzing || !chatInput.trim()}>
              {isAnalyzing ? 'Thinking...' : 'Ask AI'}
            </button>
          </form>

          {(aiResponse || isAnalyzing) && (
            <div className="mt-4 pt-4 border-t border-purple-500/20">
              {isAnalyzing ? (
                <div className="flex items-center gap-3 py-2">
                  <div className="w-5 h-5 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin"></div>
                  <span className="text-sm text-surface-500 italic">Analyzing requirements...</span>
                </div>
              ) : (
                <div className="ai-bubble mb-0">
                  <span className="text-sm whitespace-normal" style={{ animation: 'fadeUpIn 0.5s ease-out' }}>
                    {aiResponse.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="text-primary-600">{part}</strong> : part)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Service Picker */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-bold text-primary-300 uppercase tracking-wider mb-3">
            Select {config.labels.service}
          </h2>
          <div className="space-y-2">
            {config.services.map(svc => (
              <button
                key={svc.id}
                id={`service-${svc.id}`}
                onClick={() => {
                  setSelectedServiceId(svc.id);
                  setCheckedReqs({});
                  setShowJourney(false);
                }}
                className={`w-full text-left p-3 rounded-xl transition-all ${selectedServiceId === svc.id
                    ? 'bg-primary-600/20 border border-primary-500/30 text-primary-200'
                    : 'bg-surface-800/30 border border-transparent hover:border-surface-600/50 text-surface-700'
                  }`}
              >
                <div className="font-semibold text-sm">{svc.name}</div>
                <div className="text-xs text-surface-500 mt-1">
                  {svc.steps.length} steps · {svc.requirements.filter(r => r.critical).length} required docs
                </div>
              </button>
            ))}
          </div>

          {/* Priority */}
          {selectedServiceId && (
            <div className="mt-4">
              <label className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Priority</label>
              <select
                value={selectedPriority}
                onChange={e => setSelectedPriority(e.target.value)}
                className="select-field w-full mt-1"
              >
                {config.priorityClasses.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Requirements Checklist */}
        {service && (
          <div className="glass-card p-5">
            <h2 className="text-sm font-bold text-primary-300 uppercase tracking-wider mb-3">
              📋 Requirements Checklist
            </h2>
            <div className="space-y-2.5">
              {service.requirements.map(req => (
                <label
                  key={req.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-800/30 cursor-pointer transition"
                >
                  <input
                    type="checkbox"
                    className="checkbox-custom"
                    checked={!!checkedReqs[req.id]}
                    onChange={e => setCheckedReqs(prev => ({ ...prev, [req.id]: e.target.checked }))}
                  />
                  <div className="flex-1">
                    <span className="text-sm">{req.label}</span>
                    {req.critical && (
                      <span className="badge badge-red ml-2 text-[10px]">Required</span>
                    )}
                  </div>
                </label>
              ))}
            </div>

            {/* Warning / Ready Badge */}
            <div className="mt-4">
              {missingCritical.length > 0 ? (
                <div className="p-3 rounded-xl bg-status-red border border-red-500/30">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">⚠️</span>
                    <div>
                      <p className="text-sm font-semibold text-red-300">Missing Required Documents</p>
                      <p className="text-xs text-red-400/80 mt-1">
                        Missing: {missingCritical.map(r => r.label).join(', ')}.
                        You may need a second visit. Estimated extra time: {config.settings.returnVisitPenaltyMin} min.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-status-green border border-green-500/30 flex items-center gap-2">
                  <span className="text-lg">✅</span>
                  <div>
                    <p className="text-sm font-semibold text-green-300">Ready to Go!</p>
                    <p className="text-xs text-green-400/80">All requirements met</p>
                  </div>
                </div>
              )}
            </div>

            <button
              id="join-queue-btn"
              onClick={handleJoin}
              className="btn btn-primary w-full mt-4"
              disabled={!selectedServiceId}
            >
              Join {config.labels.service}
            </button>
          </div>
        )}

        {/* Customer List */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-bold text-primary-300 uppercase tracking-wider mb-3">
            Active {config.labels.customer}s ({activeCustomers.length})
          </h2>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {activeCustomers.map(c => {
              const svc = config.services.find(s => s.id === c.serviceId);
              const currentStep = svc?.steps.find(s =>
                c.stepState[s.id]?.status === 'in-service' || c.stepState[s.id]?.status === 'waiting'
              );
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCustomerId(c.id)}
                  className={`w-full text-left p-2.5 rounded-lg text-sm transition-all ${selectedCustomerId === c.id
                      ? 'bg-primary-600/20 border border-primary-500/30'
                      : 'hover:bg-surface-800/30 border border-transparent'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{c.name}</span>
                    <span className={`badge ${currentStep && c.stepState[currentStep.id]?.status === 'in-service'
                        ? 'badge-green'
                        : 'badge-amber'
                      }`}>
                      {currentStep?.name || 'routing...'}
                    </span>
                  </div>
                  <div className="text-xs text-surface-500 mt-0.5">{svc?.name}</div>
                </button>
              );
            })}
            {activeCustomers.length === 0 && (
              <p className="text-surface-500 text-sm text-center py-4">No active {config.labels.customer.toLowerCase()}s. Add one or load demo.</p>
            )}
          </div>
        </div>
      </div>

      {/* Right panel: Journey */}
      <div className="lg:col-span-2">
        {journey ? (
          <JourneyView 
            journey={journey} 
            config={config} 
            sim={sim} 
            notifications={customerNotifs} 
            simTick={simTick} 
            onClose={() => setSelectedCustomerId(null)} 
          />
        ) : (
          <div className="glass-card p-10 hidden lg:flex flex-col items-center justify-center text-center min-h-[400px]">
            <div className="text-5xl mb-4">🗺️</div>
            <h3 className="text-xl font-bold text-surface-800 mb-2">Journey Planner</h3>
            <p className="text-surface-500 text-sm max-w-md">
              Select a {config.labels.service.toLowerCase()} and join, or select an active {config.labels.customer.toLowerCase()} to see their journey plan with live ETAs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function JourneyView({ journey, config, sim, notifications, simTick, onClose }: {
  journey: NonNullable<ReturnType<typeof import('../../engine/liveSim').LiveSimulation.prototype.getCustomerJourney>>;
  config: any;
  sim: any;
  notifications: any[];
  simTick: number;
  onClose?: () => void;
}) {
  const { customer, service, steps } = journey;
  const isCompleted = !!customer.completedAt;

  // Find current step
  const currentStepInfo = steps.find(s => s.state.status === 'in-service');
  const waitingStepInfo = steps.find(s => s.state.status === 'waiting');
  const activeStep = currentStepInfo || waitingStepInfo;

  const formatTime = (min: number | undefined) => {
    if (min === undefined) return '--:--';
    const h = Math.floor(min / 60);
    const m = Math.floor(min % 60);
    return `${String(9 + h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4 relative">
      {/* Mobile Back Button */}
      {onClose && (
        <button 
          onClick={onClose}
          className="lg:hidden flex items-center gap-1 text-sm font-semibold text-surface-500 mb-2 hover:text-primary-500"
        >
          ← Back to Services
        </button>
      )}
      {/* Alert Banner */}
      {!isCompleted && activeStep && (
        <div className={`glass-card p-4 animate-pulse-glow ${activeStep.state.status === 'in-service' ? 'bg-status-green' : 'bg-status-amber'
          }`} style={{ borderColor: activeStep.state.status === 'in-service' ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{activeStep.state.status === 'in-service' ? '🟢' : '📍'}</span>
            <div className="flex-1">
              {activeStep.state.status === 'in-service' ? (
                <>
                  <p className="font-bold text-green-300">Currently at: {activeStep.step.name}</p>
                  <p className="text-sm text-green-400/80">
                    At {activeStep.resource?.name} · Est. done by {formatTime(activeStep.state.etaEnd)}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-bold text-amber-300">
                    Go to {activeStep.resource?.name} now!
                  </p>
                  <p className="text-sm text-amber-400/80">
                    Next: {activeStep.step.name} · Est. start: {formatTime(activeStep.state.etaStart)}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="glass-card p-3 bg-primary-600/10 border-primary-500/30">
          {notifications.slice(-2).map((n, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-primary-300 py-1">
              <span>🔔</span>
              <span>{n.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Remote waiting */}
      {!isCompleted && waitingStepInfo && waitingStepInfo.state.status === 'waiting' && (
        <div className="glass-card-sm p-3 flex items-center gap-2 text-sm">
          <span>📱</span>
          <span className="text-surface-700">
            You can wait anywhere. We'll alert you. Estimated call in ~
            <strong className="text-primary-300">
              {Math.max(0, Math.round((waitingStepInfo.state.etaStart || sim.clock) - sim.clock))} min
            </strong>
          </span>
        </div>
      )}

      {/* Journey Header */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-surface-800">{customer.name}'s Journey</h2>
            <p className="text-sm text-surface-500">{service.name}</p>
          </div>
          <div className="text-right">
            {isCompleted ? (
              <div className="badge badge-green text-sm">✅ Completed</div>
            ) : (
              <div className="badge badge-blue text-sm">
                {steps.filter(s => s.state.status === 'done').length}/{steps.length} done
              </div>
            )}
          </div>
        </div>

        {/* Stepper */}
        <div className="space-y-0">
          {steps.map((stepInfo, idx) => {
            const { step, state, resource } = stepInfo;
            const statusClass = state.status === 'done' ? 'done' :
              state.status === 'in-service' ? 'in-service' :
                state.status === 'waiting' ? 'waiting' : '';
            const statusLabel = state.status === 'done' ? '✅ Done' :
              state.status === 'in-service' ? '🔄 In Service' :
                state.status === 'waiting' ? '⏳ Waiting' : '⏸ Pending';
            const statusBadgeClass = state.status === 'done' ? 'badge-green' :
              state.status === 'in-service' ? 'badge-blue' :
                state.status === 'waiting' ? 'badge-amber' : 'badge-gray';

            return (
              <div key={step.id} className="flex gap-4">
                {/* Stepper line + dot */}
                <div className="flex flex-col items-center">
                  <div className={`stepper-dot ${statusClass}`}></div>
                  {idx < steps.length - 1 && (
                    <div className="stepper-line flex-1 min-h-[40px]"></div>
                  )}
                </div>
                {/* Content */}
                <div className={`flex-1 pb-4 ${state.status === 'in-service' ? 'animate-eta-update' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-surface-800">{step.name}</p>
                      <p className="text-xs text-surface-500">{resource?.name} · {step.duration.min}-{step.duration.max} min</p>
                    </div>
                    <span className={`badge ${statusBadgeClass}`}>{statusLabel}</span>
                  </div>
                  {/* ETA */}
                  {(state.status === 'waiting' || state.status === 'in-service') && (
                    <div className="mt-1.5 text-xs">
                      <span className="text-primary-300 font-mono font-bold">
                        {formatTime(state.etaStart)} – {formatTime(state.etaEnd)}
                      </span>
                    </div>
                  )}
                  {state.status === 'done' && state.startedAt !== undefined && state.finishedAt !== undefined && (
                    <div className="mt-1 text-xs text-surface-500">
                      Took {Math.round(state.finishedAt - state.startedAt)} min
                      ({formatTime(state.startedAt)} → {formatTime(state.finishedAt)})
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Total time */}
        {isCompleted && (
          <div className="mt-4 p-3 rounded-xl bg-status-green border border-green-500/30 text-center">
            <p className="text-sm text-green-300">
              Total time: <strong>{Math.round(customer.completedAt! - customer.arrivalTime)} min</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
