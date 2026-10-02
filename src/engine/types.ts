// ========================================
// FlowDesk Engine Types
// Domain-agnostic journey orchestrator
// NO React or DOM imports allowed here
// ========================================

export type DomainConfig = {
  id: string;
  name: string;
  labels: { customer: string; resource: string; service: string };
  priorityClasses: PriorityClass[];
  resources: Resource[];
  services: Service[];
  settings: {
    bottleneckThresholdMin: number;
    agingWeightPerMin: number;
    returnVisitPenaltyMin: number;
  };
};

export type PriorityClass = {
  id: string;
  label: string;
  weight: number;
};

export type Resource = {
  id: string;
  name: string;
  count: number;
  location?: { x: number; y: number; floor?: number };
};

export type Service = {
  id: string;
  name: string;
  requirements: Requirement[];
  steps: Step[];
};

export type Requirement = {
  id: string;
  label: string;
  critical: boolean;
};

export type Step = {
  id: string;
  name: string;
  resourceId: string;
  duration: { min: number; max: number };
  after: string[];
};

export type StepState = {
  status: 'pending' | 'ready' | 'waiting' | 'in-service' | 'done';
  etaStart?: number;
  etaEnd?: number;
  startedAt?: number;
  finishedAt?: number;
  assignedServer?: number;
};

export type Customer = {
  id: string;
  name: string;
  serviceId: string;
  priorityClassId: string;
  arrivalTime: number;
  missingRequirementIds: string[];
  stepState: Record<string, StepState>;
  returnVisits: number;
  completedAt?: number;
  sentHome?: boolean;
  returnAt?: number;
};

export type QueueEntry = {
  customerId: string;
  stepId: string;
  enqueuedAt: number;
};

export type ServerState = {
  resourceId: string;
  serverIndex: number;
  busy: boolean;
  currentCustomerId?: string;
  currentStepId?: string;
  busyUntil?: number;
};

export type SimEvent = {
  time: number;
  type: 'arrival' | 'service-start' | 'service-end' | 'delay-injected' | 'replan' | 'suggestion' | 'customer-sent-home' | 'customer-return';
  resourceId?: string;
  customerId?: string;
  stepId?: string;
  message: string;
};

export type Notification = {
  customerId: string;
  message: string;
  newEta?: number;
  time: number;
};

export interface SimContext {
  clock: number;
  customers: Map<string, Customer>;
  queues: Map<string, QueueEntry[]>; // resourceId -> queue
  servers: ServerState[];
  config: DomainConfig;
  events: SimEvent[];
  notifications: Notification[];
  predictedWait: (resourceId: string) => number;
}

export interface Policy {
  name: string;
  pickNext(resource: Resource, waiting: QueueEntry[], ctx: SimContext): QueueEntry | null;
  routeCustomer(customer: Customer, readySteps: Step[], ctx: SimContext): Step[];
}

export type SimMetrics = {
  avgTotalTime: number;
  medianTotalTime: number;
  p90TotalTime: number;
  avgWaitTime: number;
  avgReturnVisits: number;
  maxWait: number;
  resourceUtilization: Record<string, number>;
  avgUtilization: number;
  completed: number;
};

export type ComparisonResult = {
  fifo: SimMetrics;
  flowdesk: SimMetrics;
  improvements: {
    avgTotalTime: number;
    p90TotalTime: number;
    avgWaitTime: number;
    avgReturnVisits: number;
  };
};
