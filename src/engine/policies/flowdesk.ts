// ========================================
// FlowDesk Smart Policy
// Priority scoring, intelligent routing, parallel awareness
// NO React or DOM imports
// ========================================

import { Policy, Resource, QueueEntry, SimContext, Customer, Step } from '../types';
import { getStepMedianDuration } from '../simulation';

export const flowdeskPolicy: Policy = {
  name: 'FlowDesk',

  pickNext(resource: Resource, waiting: QueueEntry[], ctx: SimContext): QueueEntry | null {
    if (waiting.length === 0) return null;

    let bestEntry: QueueEntry | null = null;
    let bestScore = -Infinity;

    for (const entry of waiting) {
      const customer = ctx.customers.get(entry.customerId);
      if (!customer) continue;

      const priorityClass = ctx.config.priorityClasses.find(p => p.id === customer.priorityClassId);
      const priorityWeight = priorityClass?.weight || 0;

      // Aging: how long has this customer waited in this queue
      const minutesWaited = ctx.clock - entry.enqueuedAt;
      const agingScore = ctx.config.settings.agingWeightPerMin * minutesWaited;

      // Short job bonus (SPT - Shortest Processing Time)
      // This is the key differentiator: serving short jobs first reduces avg wait
      const service = ctx.config.services.find(s => s.id === customer.serviceId);
      const step = service?.steps.find(s => s.id === entry.stepId);
      const medianDuration = step ? getStepMedianDuration(step) : 10;
      // Stronger SPT bonus: inversely proportional to job duration
      const shortJobBonus = Math.min(15, Math.max(0, 20 - medianDuration * 1.5));

      // Journey urgency: more remaining steps = higher urgency to keep system flowing
      const remainingSteps = service ? service.steps.filter(s => {
        const state = customer.stepState[s.id];
        return state && state.status !== 'done';
      }).length : 0;
      const journeyUrgency = remainingSteps * 3;

      // Time in system: customers who've been in system longest get a bonus
      const timeInSystem = ctx.clock - customer.arrivalTime;
      const systemTimeBonus = Math.min(20, timeInSystem * 0.2);

      const score = priorityWeight + agingScore + shortJobBonus + journeyUrgency + systemTimeBonus;

      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
      }
    }

    return bestEntry;
  },

  routeCustomer(customer: Customer, readySteps: Step[], ctx: SimContext): Step[] {
    if (readySteps.length === 0) return [];

    // Sort by shortest predicted wait first - this is the key advantage
    // FlowDesk routes to the least congested resource first
    const sorted = [...readySteps].sort((a, b) => {
      const waitA = ctx.predictedWait(a.resourceId);
      const waitB = ctx.predictedWait(b.resourceId);
      return waitA - waitB;
    });

    // Route to the step with shortest predicted wait
    return [sorted[0]];
  }
};
