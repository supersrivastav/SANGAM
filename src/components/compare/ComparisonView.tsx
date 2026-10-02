import { useState, useMemo } from 'react';
import { useFlowStore } from '../../store/useFlowStore';
import { runComparison, ComparisonOptions } from '../../engine/comparison';
import { ComparisonResult } from '../../engine/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

export default function ComparisonView() {
  const { config } = useFlowStore();
  const [numCustomers, setNumCustomers] = useState(100);
  const [seed, setSeed] = useState(42);
  const [withDisruption, setWithDisruption] = useState(false);
  const [missingDocPercent, setMissingDocPercent] = useState(20);
  const [preVisitFixRate, setPreVisitFixRate] = useState(0.7);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runCompare = () => {
    setIsRunning(true);
    setTimeout(() => {
      const opts: ComparisonOptions = {
        config,
        numCustomers,
        seed,
        arrivalRate: 10,
        missingDocPercent,
        preVisitFixRate,
        withDisruption,
      };
      const res = runComparison(opts);
      setResult(res);
      setIsRunning(false);
    }, 50);
  };

  const chartData = useMemo(() => {
    if (!result) return [];
    return [
      { metric: 'Avg Total Time', FIFO: result.fifo.avgTotalTime, FlowDesk: result.flowdesk.avgTotalTime, unit: 'min' },
      { metric: 'P90 Total Time', FIFO: result.fifo.p90TotalTime, FlowDesk: result.flowdesk.p90TotalTime, unit: 'min' },
      { metric: 'Avg Wait Time', FIFO: result.fifo.avgWaitTime, FlowDesk: result.flowdesk.avgWaitTime, unit: 'min' },
    ];
  }, [result]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-bold text-primary-300 uppercase tracking-wider mb-4">
          ⚡ FIFO vs FlowDesk Comparison
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-xs text-surface-500 block mb-1">{config.labels.customer}s</label>
            <input
              type="number"
              value={numCustomers}
              onChange={e => setNumCustomers(Number(e.target.value))}
              className="input-field w-full"
              min={10}
              max={500}
            />
          </div>
          <div>
            <label className="text-xs text-surface-500 block mb-1">Seed</label>
            <input
              type="number"
              value={seed}
              onChange={e => setSeed(Number(e.target.value))}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="text-xs text-surface-500 block mb-1">Missing docs (%)</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={missingDocPercent}
                onChange={e => setMissingDocPercent(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-mono text-surface-700 w-10 text-right">{missingDocPercent}%</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-surface-500 block mb-1">Pre-visit fix rate</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={preVisitFixRate * 100}
                onChange={e => setPreVisitFixRate(Number(e.target.value) / 100)}
                className="flex-1"
              />
              <span className="text-sm font-mono text-surface-700 w-10 text-right">{Math.round(preVisitFixRate * 100)}%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox-custom"
              checked={withDisruption}
              onChange={e => setWithDisruption(e.target.checked)}
            />
            <span className="text-sm text-surface-700">Run with delay disruption (+20 min mid-run)</span>
          </label>
          <button
            id="run-comparison-btn"
            onClick={runCompare}
            className="btn btn-primary ml-auto"
            disabled={isRunning}
          >
            {isRunning ? '⏳ Running...' : '🚀 Run Comparison'}
          </button>
        </div>
      </div>

      {result && (
        <>
          {/* Improvement Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ImprovementCard
              label="Avg Total Time"
              value={result.improvements.avgTotalTime}
              fifoVal={`${result.fifo.avgTotalTime}m`}
              fdVal={`${result.flowdesk.avgTotalTime}m`}
            />
            <ImprovementCard
              label="P90 Total Time"
              value={result.improvements.p90TotalTime}
              fifoVal={`${result.fifo.p90TotalTime}m`}
              fdVal={`${result.flowdesk.p90TotalTime}m`}
            />
            <ImprovementCard
              label="Avg Wait Time"
              value={result.improvements.avgWaitTime}
              fifoVal={`${result.fifo.avgWaitTime}m`}
              fdVal={`${result.flowdesk.avgWaitTime}m`}
            />
            <ImprovementCard
              label="Return Visits"
              value={result.improvements.avgReturnVisits}
              fifoVal={`${result.fifo.avgReturnVisits}`}
              fdVal={`${result.flowdesk.avgReturnVisits}`}
            />
          </div>

          {/* Chart */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-bold text-primary-300 uppercase tracking-wider mb-4">
              📊 Time Comparison (minutes)
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
                  <XAxis
                    dataKey="metric"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={{ stroke: 'rgba(99,102,241,0.2)' }}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={{ stroke: 'rgba(99,102,241,0.2)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(99,102,241,0.3)',
                      borderRadius: '12px',
                      color: '#e2e8f0',
                    }}
                    formatter={(value: unknown) => [`${value} min`]}
                  />
                  <Legend wrapperStyle={{ color: '#94a3b8' }} />
                  <Bar dataKey="FIFO" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={60} />
                  <Bar dataKey="FlowDesk" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="glass-card p-5 overflow-x-auto">
            <h3 className="text-sm font-bold text-primary-300 uppercase tracking-wider mb-4">
              📋 Detailed Metrics
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700/50">
                  <th className="text-left py-2 px-3 text-surface-500 font-semibold">Metric</th>
                  <th className="text-right py-2 px-3 text-red-400 font-semibold">FIFO</th>
                  <th className="text-right py-2 px-3 text-green-400 font-semibold">FlowDesk</th>
                  <th className="text-right py-2 px-3 text-primary-400 font-semibold">Improvement</th>
                </tr>
              </thead>
              <tbody>
                <MetricRow label="Avg Total Time" fifo={`${result.fifo.avgTotalTime} min`} fd={`${result.flowdesk.avgTotalTime} min`} pct={result.improvements.avgTotalTime} />
                <MetricRow label="Median Total Time" fifo={`${result.fifo.medianTotalTime} min`} fd={`${result.flowdesk.medianTotalTime} min`} />
                <MetricRow label="P90 Total Time" fifo={`${result.fifo.p90TotalTime} min`} fd={`${result.flowdesk.p90TotalTime} min`} pct={result.improvements.p90TotalTime} />
                <MetricRow label="Avg Wait Time" fifo={`${result.fifo.avgWaitTime} min`} fd={`${result.flowdesk.avgWaitTime} min`} pct={result.improvements.avgWaitTime} />
                <MetricRow label="Max Wait" fifo={`${result.fifo.maxWait} min`} fd={`${result.flowdesk.maxWait} min`} />
                <MetricRow label="Avg Return Visits" fifo={`${result.fifo.avgReturnVisits}`} fd={`${result.flowdesk.avgReturnVisits}`} pct={result.improvements.avgReturnVisits} />
                <MetricRow label="Avg Utilization" fifo={`${Math.round(result.fifo.avgUtilization * 100)}%`} fd={`${Math.round(result.flowdesk.avgUtilization * 100)}%`} />
                <MetricRow label="Completed" fifo={`${result.fifo.completed}`} fd={`${result.flowdesk.completed}`} />
              </tbody>
            </table>
          </div>
        </>
      )}

      {!result && (
        <div className="glass-card p-10 text-center">
          <div className="text-5xl mb-4">📊</div>
          <h3 className="text-xl font-bold text-surface-700 mb-2">Ready to Compare</h3>
          <p className="text-surface-500 text-sm max-w-md mx-auto">
            Configure the parameters above and click "Run Comparison" to see how FlowDesk outperforms FIFO on {config.name}.
          </p>
        </div>
      )}
    </div>
  );
}

function ImprovementCard({ label, value, fifoVal, fdVal }: {
  label: string; value: number; fifoVal: string; fdVal: string;
}) {
  const isPositive = value > 0;
  return (
    <div className="glass-card metric-card">
      <div className={`metric-value ${isPositive ? '' : 'negative'}`}>
        {isPositive ? '↓' : '↑'}{Math.abs(value)}%
      </div>
      <div className="metric-label">{label}</div>
      <div className="mt-2 flex justify-center gap-3 text-xs">
        <span className="text-red-400">FIFO: {fifoVal}</span>
        <span className="text-green-400">FD: {fdVal}</span>
      </div>
    </div>
  );
}

function MetricRow({ label, fifo, fd, pct }: {
  label: string; fifo: string; fd: string; pct?: number;
}) {
  return (
    <tr className="border-b border-surface-800/50 hover:bg-surface-800/20">
      <td className="py-2.5 px-3 text-surface-700">{label}</td>
      <td className="py-2.5 px-3 text-right font-mono text-red-400">{fifo}</td>
      <td className="py-2.5 px-3 text-right font-mono text-green-400">{fd}</td>
      <td className="py-2.5 px-3 text-right font-mono">
        {pct !== undefined ? (
          <span className={pct > 0 ? 'text-green-400' : 'text-red-400'}>
            {pct > 0 ? '↓' : '↑'}{Math.abs(pct)}%
          </span>
        ) : '—'}
      </td>
    </tr>
  );
}
