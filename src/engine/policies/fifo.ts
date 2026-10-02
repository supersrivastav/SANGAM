// ========================================
// FIFO Baseline Policy
// NO React or DOM imports
// ========================================

import { Policy, Resource, QueueEntry, SimContext, Customer, Step } from '../types';

export const fifoPolicy: Policy = {
  name: 'FIFO',

  pickNext(_resource: Resource, waiting: QueueEntry[], _ctx: SimContext): QueueEntry | null {
    if (waiting.length === 0) return null;
    // Simple FIFO: earliest enqueued
    let earliest = waiting[0];
    for (const entry of waiting) {
      if (entry.enqueuedAt < earliest.enqueuedAt) {
        earliest = entry;
      }
    }
    return earliest;
  },

  routeCustomer(_customer: Customer, readySteps: Step[], _ctx: SimContext): Step[] {
    // FIFO: sequential, one step at a time, in order defined
    if (readySteps.length === 0) return [];
    return [readySteps[0]];
  }
};
