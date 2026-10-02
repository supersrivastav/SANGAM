// ========================================
// Live Simulation - interactive stepping sim
// for Customer/Staff/Admin views
// NO React or DOM imports
// ========================================

import {
  DomainConfig, Customer, StepState, QueueEntry, ServerState,
  SimEvent, Notification, Step
} from './types';
import { SeededRandom } from './rng';
import { getStepMedianDuration, getReadySteps, predictedWait, sampleDuration } from './simulation';
import { flowdeskPolicy } from './policies/flowdesk';

const CUSTOMER_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan',
  'Krishna', 'Ishaan', 'Ananya', 'Saanvi', 'Aanya', 'Aadhya', 'Aaradhya',
  'Myra', 'Sara', 'Diya', 'Kiara', 'Prisha', 'Rahul', 'Amit', 'Priya',
  'Sneha', 'Ravi', 'Neha', 'Suresh', 'Meena', 'Vikram', 'Pooja',
  'Raj', 'Simran', 'Deepak', 'Anjali', 'Karan', 'Divya', 'Rohit', 'Sunita'
];

export type LiveEvent = { time: number; type: string; data: unknown };

export class LiveSimulation {
  config: DomainConfig;
  clock: number = 0;
  customers: Map<string, Customer> = new Map();
  queues: Map<string, QueueEntry[]> = new Map();
  servers: ServerState[] = [];
  events: SimEvent[] = [];
  notifications: Notification[] = [];
  rng: SeededRandom;
  futureEvents: LiveEvent[] = [];
  customerCounter: number = 0;
  running: boolean = false;
  speed: number = 1;
  autoArrivals: boolean = false;
  nextAutoArrival: number = 5;
  suggestions: string[] = [];
  private lastSuggestionCheck: number = 0;

  constructor(config: DomainConfig, seed: number = 42) {
    this.config = config;
    this.rng = new SeededRandom(seed);
    this.initResources();
  }

  private initResources() {
    this.queues.clear();
    this.servers = [];
    for (const resource of this.config.resources) {
      this.queues.set(resource.id, []);
      for (let i = 0; i < resource.count; i++) {
        this.servers.push({
          resourceId: resource.id,
          serverIndex: i,
          busy: false,
        });
      }
    }
  }

  reset(config?: DomainConfig) {
    if (config) this.config = config;
    this.clock = 0;
    this.customers.clear();
    this.futureEvents = [];
    this.events = [];
    this.notifications = [];
    this.customerCounter = 0;
    this.suggestions = [];
    this.lastSuggestionCheck = 0;
    this.initResources();
  }

  addCustomer(serviceId: string, priorityClassId: string, missingReqs: string[] = [], name?: string): Customer {
    const id = `c-${this.customerCounter++}`;
    const service = this.config.services.find(s => s.id === serviceId)!;

    const stepState: Record<string, StepState> = {};
    for (const step of service.steps) {
      stepState[step.id] = { status: 'pending' };
    }

    const customer: Customer = {
      id,
      name: name || CUSTOMER_NAMES[this.customerCounter % CUSTOMER_NAMES.length],
      serviceId,
      priorityClassId,
      arrivalTime: this.clock,
      missingRequirementIds: missingReqs,
      stepState,
      returnVisits: 0,
    };

    this.customers.set(id, customer);
    this.events.push({
      time: this.clock,
      type: 'arrival',
      customerId: id,
      message: `${customer.name} arrived for ${service.name}`
    });

    this.routeCustomer(customer);
    return customer;
  }

  addRandomCustomer(): Customer {
    const service = this.rng.pick(this.config.services);
    const priorityClass = this.config.priorityClasses[
      this.rng.random() < 0.15 ? 0 : this.config.priorityClasses.length - 1
    ];
    return this.addCustomer(service.id, priorityClass.id);
  }

  private getPredictedWait = (resourceId: string) =>
    predictedWait(resourceId, this.queues, this.servers, this.config, this.clock, this.customers);

  private getContext() {
    return {
      clock: this.clock,
      customers: this.customers,
      queues: this.queues,
      servers: this.servers,
      config: this.config,
      events: this.events,
      notifications: this.notifications,
      predictedWait: this.getPredictedWait,
    };
  }

  private routeCustomer(customer: Customer) {
    const service = this.config.services.find(s => s.id === customer.serviceId)!;
    const readySteps = getReadySteps(customer, service);
    if (readySteps.length === 0) {
      const allDone = service.steps.every(s => customer.stepState[s.id].status === 'done');
      if (allDone && !customer.completedAt) {
        customer.completedAt = this.clock;
        this.events.push({
          time: this.clock,
          type: 'service-end',
          customerId: customer.id,
          message: `${customer.name} completed all steps!`
        });
      }
      return;
    }

    const ctx = this.getContext();
    const stepsToRoute = flowdeskPolicy.routeCustomer(customer, readySteps, ctx);

    for (const step of stepsToRoute) {
      customer.stepState[step.id].status = 'waiting';
      const pw = this.getPredictedWait(step.resourceId);
      customer.stepState[step.id].etaStart = this.clock + pw;
      customer.stepState[step.id].etaEnd = this.clock + pw + (step.duration.max - step.duration.min) + 0.25 * pw;

      const queue = this.queues.get(step.resourceId)!;
      queue.push({ customerId: customer.id, stepId: step.id, enqueuedAt: this.clock });

      this.tryServe(step.resourceId);
    }
  }

  private tryServe(resourceId: string) {
    const resource = this.config.resources.find(r => r.id === resourceId)!;
    const freeServer = this.servers.find(s => s.resourceId === resourceId && !s.busy);
    if (!freeServer) return;

    const queue = this.queues.get(resourceId)!;
    if (queue.length === 0) return;

    const ctx = this.getContext();
    const picked = flowdeskPolicy.pickNext(resource, queue, ctx);
    if (!picked) return;

    const qIdx = queue.findIndex(q => q.customerId === picked.customerId && q.stepId === picked.stepId);
    if (qIdx >= 0) queue.splice(qIdx, 1);

    const customer = this.customers.get(picked.customerId)!;
    const service = this.config.services.find(s => s.id === customer.serviceId)!;
    const step = service.steps.find(s => s.id === picked.stepId)!;

    const complexityFactor = this.rng.lognormal(1, 0.2);
    const duration = sampleDuration(step, this.rng, complexityFactor);
    const endTime = this.clock + duration;

    freeServer.busy = true;
    freeServer.currentCustomerId = customer.id;
    freeServer.currentStepId = picked.stepId;
    freeServer.busyUntil = endTime;

    customer.stepState[picked.stepId] = {
      status: 'in-service',
      startedAt: this.clock,
      assignedServer: freeServer.serverIndex,
      etaStart: this.clock,
      etaEnd: endTime,
    };

    this.events.push({
      time: this.clock,
      type: 'service-start',
      resourceId,
      customerId: customer.id,
      stepId: picked.stepId,
      message: `${customer.name} started ${step.name} at ${resource.name}`
    });

    // In click-driven mode, we do NOT schedule automatic service-end events.
    // They must be marked done manually by staff.
  }

  injectDelay(resourceId: string, delayMin: number) {
    const resource = this.config.resources.find(r => r.id === resourceId);
    if (!resource) return;

    // Extend all active services on this resource
    const affectedServers = this.servers.filter(s => s.resourceId === resourceId && s.busy);
    for (const srv of affectedServers) {
      if (srv.busyUntil !== undefined) {
        const oldEnd = srv.busyUntil;
        srv.busyUntil = oldEnd + delayMin;
        
        // Also update the customer's etaEnd so UI reflects it
        if (srv.currentCustomerId && srv.currentStepId) {
           const cust = this.customers.get(srv.currentCustomerId);
           if (cust) {
               const ss = cust.stepState[srv.currentStepId];
               if (ss && ss.etaEnd !== undefined) {
                   ss.etaEnd += delayMin;
               }
           }
        }
      }
    }

    this.events.push({
      time: this.clock,
      type: 'delay-injected',
      resourceId,
      message: `Delay +${delayMin} min injected on ${resource.name}`
    });

    // Replan all waiting/pending customers
    let replanCount = 0;
    for (const [, cust] of this.customers) {
      if (cust.completedAt !== undefined) continue;
      const svc = this.config.services.find(s => s.id === cust.serviceId);
      if (!svc) continue;
      let changed = false;
      for (const step of svc.steps) {
        const ss = cust.stepState[step.id];
        if (ss.status === 'waiting' || ss.status === 'pending') {
          const newEta = this.clock + this.getPredictedWait(step.resourceId);
          if (ss.etaStart !== undefined && Math.abs(newEta - ss.etaStart) > 2) {
            changed = true;
            this.notifications.push({
              customerId: cust.id,
              message: `Your plan was updated: delay on ${resource.name}. New ETA: ${Math.round(newEta)} min`,
              newEta: newEta,
              time: this.clock,
            });
          }
          ss.etaStart = newEta;
          ss.etaEnd = newEta + (step.duration.max - step.duration.min) + 0.25 * this.getPredictedWait(step.resourceId);
        }
      }
      if (changed) replanCount++;
    }

    if (replanCount > 0) {
      this.events.push({
        time: this.clock,
        type: 'replan',
        message: `Re-planned ${replanCount} ${this.config.labels.customer.toLowerCase()}s because of delay on ${resource.name}`
      });
    }
  }

  private checkSuggestions() {
    if (this.clock - this.lastSuggestionCheck < 5) return;
    this.lastSuggestionCheck = this.clock;

    const threshold = this.config.settings.bottleneckThresholdMin;
    let worstBottleneck: { id: string; name: string; wait: number } | null = null;
    let mostUnderused: { id: string; name: string; util: number } | null = null;

    for (const resource of this.config.resources) {
      const pw = this.getPredictedWait(resource.id);
      if (pw > threshold && (!worstBottleneck || pw > worstBottleneck.wait)) {
        worstBottleneck = { id: resource.id, name: resource.name, wait: pw };
      }

      // Estimate utilization
      const resServers = this.servers.filter(s => s.resourceId === resource.id);
      const busyCount = resServers.filter(s => s.busy).length;
      const util = resServers.length > 0 ? busyCount / resServers.length : 0;
      if (util < 0.4 && (!mostUnderused || util < mostUnderused.util)) {
        mostUnderused = { id: resource.id, name: resource.name, util };
      }
    }

    if (worstBottleneck && mostUnderused && worstBottleneck.id !== mostUnderused.id) {
      const suggestion = `${worstBottleneck.name} is the bottleneck (predicted wait ${Math.round(worstBottleneck.wait)} min). Move 1 staff from ${mostUnderused.name} (idle ${Math.round((1 - mostUnderused.util) * 100)}%) for the next 30 min.`;
      if (!this.suggestions.includes(suggestion)) {
        this.suggestions.unshift(suggestion);
        if (this.suggestions.length > 10) this.suggestions.pop();
        this.events.push({
          time: this.clock,
          type: 'suggestion',
          message: suggestion,
        });
      }
    }
  }

  /** Advance simulation clock by deltaMinutes */
  tick(deltaMinutes: number = 0.5) {
    this.clock += deltaMinutes;

    // Auto arrivals
    if (this.autoArrivals && this.clock >= this.nextAutoArrival) {
      this.addRandomCustomer();
      this.nextAutoArrival = this.clock + this.rng.uniform(2, 6);
    }

    this.checkSuggestions();
  }

  /** Load demo scenario with ~12 customers mid-flow */
  loadDemo() {
    this.reset();
    for (let i = 0; i < 12; i++) {
      const service = this.config.services[i % this.config.services.length];
      const priorityClass = this.config.priorityClasses[
        i < 2 ? 0 : this.config.priorityClasses.length - 1
      ];
      this.addCustomer(service.id, priorityClass.id);
      // Advance time slightly between arrivals
      this.tick(this.rng.uniform(0.5, 2));
    }
    // Run forward a bit so things are mid-flow
    for (let i = 0; i < 20; i++) {
      this.tick(1);
    }
    this.autoArrivals = true;
    this.nextAutoArrival = this.clock + 3;
  }

  getResourceStats() {
    return this.config.resources.map(r => {
      const queue = this.queues.get(r.id) || [];
      const resServers = this.servers.filter(s => s.resourceId === r.id);
      const busyServers = resServers.filter(s => s.busy);
      const pw = this.getPredictedWait(r.id);
      const currentCustomers = busyServers.map(s => ({
        customerId: s.currentCustomerId,
        stepId: s.currentStepId,
        busyUntil: s.busyUntil,
      }));

      return {
        resourceId: r.id,
        resourceName: r.name,
        queueLength: queue.length,
        totalServers: resServers.length,
        busyServers: busyServers.length,
        predictedWait: Math.round(pw * 10) / 10,
        utilization: resServers.length > 0 ? Math.round((busyServers.length / resServers.length) * 100) : 0,
        currentCustomers,
        threshold: this.config.settings.bottleneckThresholdMin,
      };
    });
  }

  getCustomerJourney(customerId: string) {
    const customer = this.customers.get(customerId);
    if (!customer) return null;

    const service = this.config.services.find(s => s.id === customer.serviceId);
    if (!service) return null;

    return {
      customer,
      service,
      steps: service.steps.map(step => ({
        step,
        state: customer.stepState[step.id],
        resource: this.config.resources.find(r => r.id === step.resourceId),
      })),
    };
  }

  getStaffView(resourceId: string) {
    const resource = this.config.resources.find(r => r.id === resourceId);
    if (!resource) return null;

    const resServers = this.servers.filter(s => s.resourceId === resourceId);
    const queue = this.queues.get(resourceId) || [];

    const nowServing = resServers
      .filter(s => s.busy && s.currentCustomerId)
      .map(s => ({
        customer: this.customers.get(s.currentCustomerId!)!,
        stepId: s.currentStepId!,
        serverIndex: s.serverIndex,
        busyUntil: s.busyUntil,
      }))
      .filter(s => s.customer);

    const nextUp = queue.length > 0 ? {
      customer: this.customers.get(queue[0].customerId)!,
      stepId: queue[0].stepId,
    } : null;

    return { resource, nowServing, nextUp, queueLength: queue.length };
  }

  /** Staff action: manually mark a service as done */
  staffMarkDone(resourceId: string, serverIndex: number) {
    const server = this.servers.find(s => s.resourceId === resourceId && s.serverIndex === serverIndex);
    if (!server || !server.busy || !server.currentCustomerId) return;

    const customer = this.customers.get(server.currentCustomerId);
    if (!customer || !server.currentStepId) return;

    // Remove future service-end event
    this.futureEvents = this.futureEvents.filter(e => {
      if (e.type === 'service-end') {
        const data = e.data as { resourceId: string; serverIndex: number };
        return !(data.resourceId === resourceId && data.serverIndex === serverIndex);
      }
      return true;
    });

    customer.stepState[server.currentStepId].status = 'done';
    customer.stepState[server.currentStepId].finishedAt = this.clock;

    const service = this.config.services.find(s => s.id === customer.serviceId)!;
    const step = service.steps.find(s => s.id === server.currentStepId)!;

    server.busy = false;
    server.currentCustomerId = undefined;
    server.currentStepId = undefined;
    server.busyUntil = undefined;

    this.events.push({
      time: this.clock,
      type: 'service-end',
      resourceId,
      customerId: customer.id,
      stepId: step.id,
      message: `${customer.name} finished ${step.name} (staff marked done)`
    });

    this.routeCustomer(customer);
    this.tryServe(resourceId);
  }
}
