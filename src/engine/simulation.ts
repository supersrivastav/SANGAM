// ========================================
// FlowDesk Discrete-Event Simulation Engine
// NO React or DOM imports
// ========================================

import {
  DomainConfig, Customer, StepState, QueueEntry, ServerState,
  SimEvent, Notification, SimContext, Policy, Step, SimMetrics
} from './types';
import { SeededRandom } from './rng';

export interface SimulationOptions {
  config: DomainConfig;
  policy: Policy;
  seed: number;
  numCustomers: number;
  arrivalRate: number; // avg minutes between arrivals
  missingDocPercent: number; // 0-100
  preVisitFixRate: number; // 0-1, fraction who fix docs when warned (FlowDesk only)
  injectDelay?: { resourceId: string; atTime: number; delayMin: number };
}

export interface SimulationResult {
  metrics: SimMetrics;
  customers: Customer[];
  events: SimEvent[];
  notifications: Notification[];
}

const CUSTOMER_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan',
  'Krishna', 'Ishaan', 'Ananya', 'Saanvi', 'Aanya', 'Aadhya', 'Aaradhya',
  'Myra', 'Sara', 'Diya', 'Kiara', 'Prisha', 'Rahul', 'Amit', 'Priya',
  'Sneha', 'Ravi', 'Neha', 'Suresh', 'Meena', 'Vikram', 'Pooja',
  'Raj', 'Simran', 'Deepak', 'Anjali', 'Karan', 'Divya', 'Rohit', 'Sunita',
  'Manish', 'Kavita', 'Mohan', 'Lakshmi', 'Gaurav', 'Rekha', 'Sanjay', 'Nisha',
  'Ajay', 'Ritu', 'Vijay', 'Swati'
];

export function getStepMedianDuration(step: Step): number {
  return (step.duration.min + step.duration.max) / 2;
}

export function sampleDuration(step: Step, rng: SeededRandom, complexityFactor: number): number {
  const base = rng.triangular(step.duration.min, step.duration.max);
  return Math.max(step.duration.min, base * complexityFactor);
}

export function getReadySteps(customer: Customer, service: { steps: Step[] }): Step[] {
  return service.steps.filter(step => {
    const state = customer.stepState[step.id];
    if (!state || state.status !== 'pending') return false;
    // Check all prerequisites are done
    return step.after.every(preId => {
      const preState = customer.stepState[preId];
      return preState && preState.status === 'done';
    });
  });
}

export function predictedWait(resourceId: string, queues: Map<string, QueueEntry[]>, servers: ServerState[], config: DomainConfig, clock: number, allCustomers: Map<string, Customer>): number {
  const resource = config.resources.find(r => r.id === resourceId);
  if (!resource) return 0;

  const queue = queues.get(resourceId) || [];
  const service = config.services;

  // Sum of median durations of queued entries
  let queuedTime = 0;
  for (const entry of queue) {
    const cust = allCustomers.get(entry.customerId);
    if (!cust) continue;
    for (const svc of service) {
      const step = svc.steps.find(s => s.id === entry.stepId);
      if (step) {
        queuedTime += getStepMedianDuration(step);
        break;
      }
    }
  }

  // Remaining time of in-service entries
  let remainingInService = 0;
  const resourceServers = servers.filter(s => s.resourceId === resourceId && s.busy);
  for (const srv of resourceServers) {
    if (srv.busyUntil !== undefined) {
      remainingInService += Math.max(0, srv.busyUntil - clock);
    }
  }

  return (queuedTime + remainingInService) / resource.count;
}

export function runSimulation(options: SimulationOptions): SimulationResult {
  const { config, policy, seed, numCustomers, arrivalRate, missingDocPercent, preVisitFixRate, injectDelay } = options;
  const rng = new SeededRandom(seed);

  const customers = new Map<string, Customer>();
  const queues = new Map<string, QueueEntry[]>();
  const servers: ServerState[] = [];
  const events: SimEvent[] = [];
  const notifications: Notification[] = [];

  // Initialize queues and servers
  for (const resource of config.resources) {
    queues.set(resource.id, []);
    for (let i = 0; i < resource.count; i++) {
      servers.push({
        resourceId: resource.id,
        serverIndex: i,
        busy: false,
      });
    }
  }

  // Generate arrivals
  type ArrivalEvent = { time: number; customer: Customer };
  const arrivals: ArrivalEvent[] = [];
  let t = 0;

  for (let i = 0; i < numCustomers; i++) {
    t += rng.uniform(arrivalRate * 0.5, arrivalRate * 1.5);
    const service = rng.pick(config.services);
    const priorityClass = config.priorityClasses[
      rng.random() < 0.15 ? 0 : (rng.random() < 0.3 ? Math.min(1, config.priorityClasses.length - 1) : config.priorityClasses.length - 1)
    ];

    // Determine missing requirements
    const missingReqs: string[] = [];
    const hasMissing = rng.random() * 100 < missingDocPercent;
    if (hasMissing) {
      const criticalReqs = service.requirements.filter(r => r.critical);
      if (criticalReqs.length > 0) {
        const missingReq = rng.pick(criticalReqs);
        missingReqs.push(missingReq.id);
      }
    }

    // For FlowDesk: pre-visit warning allows some customers to fix docs
    let actualMissing = [...missingReqs];
    if (policy.name === 'FlowDesk' && missingReqs.length > 0) {
      if (rng.random() < preVisitFixRate) {
        actualMissing = []; // Customer fixed docs after warning
      }
    }

    const stepState: Record<string, StepState> = {};
    for (const step of service.steps) {
      stepState[step.id] = { status: 'pending' };
    }

    const customer: Customer = {
      id: `c-${i}`,
      name: CUSTOMER_NAMES[i % CUSTOMER_NAMES.length],
      serviceId: service.id,
      priorityClassId: priorityClass.id,
      arrivalTime: Math.round(t * 10) / 10,
      missingRequirementIds: actualMissing,
      stepState,
      returnVisits: 0,
    };

    arrivals.push({ time: customer.arrivalTime, customer });
  }

  // Event-driven simulation
  let clock = 0;
  let arrivalIdx = 0;
  let delayInjected = false;

  // Priority queue of future events
  type FutureEvent = { time: number; type: 'arrival' | 'service-end' | 'delay'; data: unknown };
  const futureEvents: FutureEvent[] = [];

  // Add all arrivals as future events
  for (const a of arrivals) {
    futureEvents.push({ time: a.time, type: 'arrival', data: a });
  }

  // Add delay injection if configured
  if (injectDelay) {
    futureEvents.push({ time: injectDelay.atTime, type: 'delay', data: injectDelay });
  }

  futureEvents.sort((a, b) => a.time - b.time);

  const getPredictedWait = (resId: string) => predictedWait(resId, queues, servers, config, clock, customers);

  const ctx: SimContext = {
    clock: 0,
    customers,
    queues,
    servers,
    config,
    events,
    notifications,
    predictedWait: getPredictedWait,
  };

  function tryServeFromQueue(resourceId: string) {
    const resource = config.resources.find(r => r.id === resourceId)!;
    const freeServer = servers.find(s => s.resourceId === resourceId && !s.busy);
    if (!freeServer) return;

    const queue = queues.get(resourceId) || [];
    if (queue.length === 0) return;

    const picked = policy.pickNext(resource, queue, ctx);
    if (!picked) return;

    // Remove from queue
    const qIdx = queue.findIndex(q => q.customerId === picked.customerId && q.stepId === picked.stepId);
    if (qIdx >= 0) queue.splice(qIdx, 1);

    const customer = customers.get(picked.customerId)!;
    const service = config.services.find(s => s.id === customer.serviceId)!;
    const step = service.steps.find(s => s.id === picked.stepId)!;

    // Check if FIFO discovers missing docs at first step
    if (policy.name === 'FIFO' && customer.missingRequirementIds.length > 0) {
      const isFirstStep = step.after.length === 0;
      if (isFirstStep && !customer.sentHome) {
        // Send customer home
        customer.sentHome = true;
        customer.returnVisits += 1;
        customer.returnAt = clock + config.settings.returnVisitPenaltyMin;
        customer.missingRequirementIds = [];

        // Reset step states
        for (const s of service.steps) {
          customer.stepState[s.id] = { status: 'pending' };
        }

        events.push({
          time: clock,
          type: 'customer-sent-home',
          customerId: customer.id,
          message: `${customer.name} sent home for missing documents. Will return in ${config.settings.returnVisitPenaltyMin} min.`
        });

        // Schedule return
        futureEvents.push({
          time: customer.returnAt,
          type: 'arrival',
          data: { time: customer.returnAt, customer, isReturn: true } as ArrivalEvent & { isReturn: boolean }
        });
        futureEvents.sort((a, b) => a.time - b.time);

        // Try to serve next person
        tryServeFromQueue(resourceId);
        return;
      }
    }

    // Sample duration
    const complexityFactor = rng.lognormal(1, 0.25);
    const duration = sampleDuration(step, rng, complexityFactor);
    const endTime = clock + duration;

    // Update state
    freeServer.busy = true;
    freeServer.currentCustomerId = customer.id;
    freeServer.currentStepId = picked.stepId;
    freeServer.busyUntil = endTime;

    customer.stepState[picked.stepId] = {
      status: 'in-service',
      startedAt: clock,
      assignedServer: freeServer.serverIndex,
      etaStart: clock,
      etaEnd: endTime,
    };

    events.push({
      time: clock,
      type: 'service-start',
      resourceId,
      customerId: customer.id,
      stepId: picked.stepId,
      message: `${customer.name} started ${step.name} at ${resource.name}`
    });

    // Schedule end
    futureEvents.push({
      time: endTime,
      type: 'service-end',
      data: { resourceId, customerId: customer.id, stepId: picked.stepId, serverIndex: freeServer.serverIndex }
    });
    futureEvents.sort((a, b) => a.time - b.time);
  }

  function routeCustomer(customer: Customer) {
    const service = config.services.find(s => s.id === customer.serviceId)!;
    const readySteps = getReadySteps(customer, service);
    if (readySteps.length === 0) {
      // Check if all done
      const allDone = service.steps.every(s => customer.stepState[s.id].status === 'done');
      if (allDone) {
        customer.completedAt = clock;
      }
      return;
    }

    // Mark ready and let policy decide routing
    const stepsToRoute = policy.routeCustomer(customer, readySteps, ctx);

    for (const step of stepsToRoute) {
      customer.stepState[step.id].status = 'waiting';
      const pw = getPredictedWait(step.resourceId);
      customer.stepState[step.id].etaStart = clock + pw;
      customer.stepState[step.id].etaEnd = clock + pw + (step.duration.max - step.duration.min) + 0.25 * pw;

      const queue = queues.get(step.resourceId)!;
      queue.push({
        customerId: customer.id,
        stepId: step.id,
        enqueuedAt: clock,
      });

      tryServeFromQueue(step.resourceId);
    }
  }

  // Main simulation loop
  let safetyCounter = 0;
  const MAX_ITERATIONS = numCustomers * 50 + 5000;

  while (futureEvents.length > 0 && safetyCounter < MAX_ITERATIONS) {
    safetyCounter++;
    const event = futureEvents.shift()!;
    clock = event.time;
    ctx.clock = clock;

    if (event.type === 'arrival') {
      const arrData = event.data as ArrivalEvent & { isReturn?: boolean };
      const customer = arrData.customer;

      if (!arrData.isReturn && customer.sentHome) continue;
      if (arrData.isReturn) {
        customer.sentHome = false;
      }

      customers.set(customer.id, customer);
      events.push({
        time: clock,
        type: 'arrival',
        customerId: customer.id,
        message: `${customer.name} arrived${arrData.isReturn ? ' (return visit)' : ''} for ${config.services.find(s => s.id === customer.serviceId)?.name || customer.serviceId}`
      });
      routeCustomer(customer);

    } else if (event.type === 'service-end') {
      const data = event.data as { resourceId: string; customerId: string; stepId: string; serverIndex: number };
      const customer = customers.get(data.customerId)!;
      const server = servers.find(s => s.resourceId === data.resourceId && s.serverIndex === data.serverIndex)!;

      // Mark step done
      customer.stepState[data.stepId].status = 'done';
      customer.stepState[data.stepId].finishedAt = clock;

      // Free server
      server.busy = false;
      server.currentCustomerId = undefined;
      server.currentStepId = undefined;
      server.busyUntil = undefined;

      const service = config.services.find(s => s.id === customer.serviceId)!;
      const step = service.steps.find(s => s.id === data.stepId)!;
      events.push({
        time: clock,
        type: 'service-end',
        resourceId: data.resourceId,
        customerId: data.customerId,
        stepId: data.stepId,
        message: `${customer.name} finished ${step.name}`
      });

      // Route to next steps
      routeCustomer(customer);

      // Try to serve next from queue
      tryServeFromQueue(data.resourceId);

    } else if (event.type === 'delay') {
      const delayData = event.data as { resourceId: string; delayMin: number };
      if (!delayInjected) {
        delayInjected = true;

        // Add delay to all active services on this resource
        const affectedServers = servers.filter(s => s.resourceId === delayData.resourceId && s.busy);
        for (const srv of affectedServers) {
          if (srv.busyUntil !== undefined) {
            const oldEnd = srv.busyUntil;
            srv.busyUntil = oldEnd + delayData.delayMin;

            // Update future events
            for (const fe of futureEvents) {
              if (fe.type === 'service-end') {
                const feData = fe.data as { resourceId: string; customerId: string; stepId: string; serverIndex: number };
                if (feData.resourceId === delayData.resourceId && feData.serverIndex === srv.serverIndex) {
                  fe.time = srv.busyUntil;
                }
              }
            }
          }
        }
        futureEvents.sort((a, b) => a.time - b.time);

        events.push({
          time: clock,
          type: 'delay-injected',
          resourceId: delayData.resourceId,
          message: `Delay +${delayData.delayMin} min injected on ${config.resources.find(r => r.id === delayData.resourceId)?.name || delayData.resourceId}`
        });

        // Replan: update ETAs for all waiting customers
        let replanCount = 0;
        for (const [, cust] of customers) {
          if (cust.completedAt !== undefined) continue;
          const svc = config.services.find(s => s.id === cust.serviceId)!;
          let changed = false;
          for (const step of svc.steps) {
            const ss = cust.stepState[step.id];
            if (ss.status === 'waiting' || ss.status === 'pending') {
              const newEta = clock + getPredictedWait(step.resourceId);
              if (ss.etaStart !== undefined && Math.abs(newEta - ss.etaStart) > 5) {
                changed = true;
              }
              ss.etaStart = newEta;
              ss.etaEnd = newEta + (step.duration.max - step.duration.min) + 0.25 * getPredictedWait(step.resourceId);
            }
          }
          if (changed) replanCount++;
        }

        if (replanCount > 0) {
          events.push({
            time: clock,
            type: 'replan',
            message: `Re-planned ${replanCount} customers because of delay on ${config.resources.find(r => r.id === delayData.resourceId)?.name}`
          });
        }
      }
    }
  }

  // Compute metrics
  const completedCustomers = Array.from(customers.values()).filter(c => c.completedAt !== undefined);
  const metrics = computeMetrics(completedCustomers, servers, config, clock);

  return {
    metrics,
    customers: Array.from(customers.values()),
    events,
    notifications,
  };
}

export function computeMetrics(completedCustomers: Customer[], servers: ServerState[], config: DomainConfig, totalSimTime: number): SimMetrics {
  if (completedCustomers.length === 0) {
    return {
      avgTotalTime: 0, medianTotalTime: 0, p90TotalTime: 0,
      avgWaitTime: 0, avgReturnVisits: 0, maxWait: 0,
      resourceUtilization: {}, avgUtilization: 0, completed: 0,
    };
  }

  const totalTimes = completedCustomers.map(c => (c.completedAt! - c.arrivalTime));
  totalTimes.sort((a, b) => a - b);

  const waitTimes = completedCustomers.map(c => {
    const totalTime = c.completedAt! - c.arrivalTime;
    let serviceDuration = 0;
    for (const stepId in c.stepState) {
      const ss = c.stepState[stepId];
      if (ss.startedAt !== undefined && ss.finishedAt !== undefined) {
        serviceDuration += ss.finishedAt - ss.startedAt;
      }
    }
    return Math.max(0, totalTime - serviceDuration);
  });

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const median = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const p90 = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.9)] || sorted[sorted.length - 1];
  };

  // Resource utilization
  const resourceUtilization: Record<string, number> = {};
  for (const resource of config.resources) {
    // Compute busy time for each server of this resource
    // We'll estimate from completed customers' step data
    let totalBusyTime = 0;
    for (const c of completedCustomers) {
      for (const stepId in c.stepState) {
        const ss = c.stepState[stepId];
        if (ss.startedAt !== undefined && ss.finishedAt !== undefined) {
          // Find which resource this step belongs to
          for (const svc of config.services) {
            const step = svc.steps.find(s => s.id === stepId);
            if (step && step.resourceId === resource.id) {
              totalBusyTime += ss.finishedAt - ss.startedAt;
              break;
            }
          }
        }
      }
    }
    const totalCapacity = resource.count * totalSimTime;
    resourceUtilization[resource.id] = totalCapacity > 0 ? Math.min(1, totalBusyTime / totalCapacity) : 0;
  }

  const utilValues = Object.values(resourceUtilization);
  const avgUtilization = utilValues.length > 0 ? avg(utilValues) : 0;

  return {
    avgTotalTime: Math.round(avg(totalTimes) * 10) / 10,
    medianTotalTime: Math.round(median(totalTimes) * 10) / 10,
    p90TotalTime: Math.round(p90(totalTimes) * 10) / 10,
    avgWaitTime: Math.round(avg(waitTimes) * 10) / 10,
    avgReturnVisits: Math.round(avg(completedCustomers.map(c => c.returnVisits)) * 100) / 100,
    maxWait: Math.round(Math.max(...waitTimes) * 10) / 10,
    resourceUtilization,
    avgUtilization: Math.round(avgUtilization * 100) / 100,
    completed: completedCustomers.length,
  };
}
