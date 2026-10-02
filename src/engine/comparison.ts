// ========================================
// Comparison Runner - runs FIFO vs FlowDesk
// NO React or DOM imports
// ========================================

import { DomainConfig, ComparisonResult } from './types';
import { runSimulation } from './simulation';
import { fifoPolicy } from './policies/fifo';
import { flowdeskPolicy } from './policies/flowdesk';

export interface ComparisonOptions {
  config: DomainConfig;
  numCustomers: number;
  seed: number;
  arrivalRate: number;
  missingDocPercent: number;
  preVisitFixRate: number;
  withDisruption: boolean;
  disruptionResourceId?: string;
  disruptionTime?: number;
  disruptionDelay?: number;
}

export function runComparison(options: ComparisonOptions): ComparisonResult {
  const {
    config, numCustomers, seed, arrivalRate,
    missingDocPercent, preVisitFixRate,
    withDisruption, disruptionResourceId, disruptionTime, disruptionDelay
  } = options;

  const delay = withDisruption ? {
    resourceId: disruptionResourceId || config.resources[Math.min(2, config.resources.length - 1)].id,
    atTime: disruptionTime || (numCustomers * arrivalRate * 0.4),
    delayMin: disruptionDelay || 20,
  } : undefined;

  const fifoResult = runSimulation({
    config,
    policy: fifoPolicy,
    seed,
    numCustomers,
    arrivalRate,
    missingDocPercent,
    preVisitFixRate: 0, // FIFO doesn't have pre-visit checks
    injectDelay: delay,
  });

  const flowdeskResult = runSimulation({
    config,
    policy: flowdeskPolicy,
    seed,
    numCustomers,
    arrivalRate,
    missingDocPercent,
    preVisitFixRate,
    injectDelay: delay,
  });

  const fifo = fifoResult.metrics;
  const flowdesk = flowdeskResult.metrics;

  const pctImprove = (fifoVal: number, fdVal: number) => {
    if (fifoVal === 0) return 0;
    return Math.round(((fifoVal - fdVal) / fifoVal) * 1000) / 10;
  };

  return {
    fifo,
    flowdesk,
    improvements: {
      avgTotalTime: pctImprove(fifo.avgTotalTime, flowdesk.avgTotalTime),
      p90TotalTime: pctImprove(fifo.p90TotalTime, flowdesk.p90TotalTime),
      avgWaitTime: pctImprove(fifo.avgWaitTime, flowdesk.avgWaitTime),
      avgReturnVisits: pctImprove(fifo.avgReturnVisits, flowdesk.avgReturnVisits),
    }
  };
}
