import { create } from 'zustand';
import { DomainConfig } from '../engine/types';
import { LiveSimulation } from '../engine/liveSim';

import hospitalConfig from '../configs/hospital.json';
import parlourConfig from '../configs/parlour.json';
import bankConfig from '../configs/bank.json';
import jansevaConfig from '../configs/janseva.json';

const configs: Record<string, DomainConfig> = {
  hospital: hospitalConfig as DomainConfig,
  parlour: parlourConfig as DomainConfig,
  bank: bankConfig as DomainConfig,
  janseva: jansevaConfig as DomainConfig,
};

export type ActiveTab = 'customer' | 'staff' | 'admin' | 'compare';

interface FlowStore {
  // Domain
  activeDomainId: string;
  config: DomainConfig;
  configs: Record<string, DomainConfig>;

  // Simulation
  sim: LiveSimulation;
  simTick: number; // incrementing counter to force re-renders
  speed: number;
  running: boolean;

  // UI state
  activeTab: ActiveTab;
  selectedCustomerId: string | null;
  selectedResourceId: string | null;
  selectedServiceId: string | null;

  // Actions
  switchDomain: (domainId: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
  // Auth
  isAuthenticated: boolean;
  authRole: 'customer' | 'staff' | 'admin' | null;
  login: (role: 'customer' | 'staff' | 'admin') => void;
  logout: () => void;

  setSelectedCustomerId: (id: string | null) => void;
  setSelectedResourceId: (id: string | null) => void;
  setSelectedServiceId: (id: string | null) => void;
  setSpeed: (speed: number) => void;
  toggleRunning: () => void;
  tickSim: () => void;
  addCustomer: (serviceId: string, priorityClassId: string, missingReqs?: string[]) => void;
  addRandomCustomer: () => void;
  addResource: (name: string, count: number) => void;
  injectDelay: (resourceId: string, delayMin: number) => void;
  loadDemo: () => void;
  setAutoArrivals: (on: boolean) => void;
  staffMarkDone: (resourceId: string, serverIndex: number) => void;
}

const initialConfig = configs.hospital;
const initialSim = new LiveSimulation(initialConfig, 42);

export const useFlowStore = create<FlowStore>((set, get) => ({
  isAuthenticated: false,
  authRole: null,
  login: (role) => set({ isAuthenticated: true, authRole: role, activeTab: role }),
  logout: () => set({ isAuthenticated: false, authRole: null, activeTab: 'customer' }),

  activeDomainId: 'hospital',
  config: initialConfig,
  configs,
  sim: initialSim,
  simTick: 0,
  speed: 1,
  running: false,
  activeTab: 'customer',
  selectedCustomerId: null,
  selectedResourceId: null,
  selectedServiceId: null,

  switchDomain: (domainId: string) => {
    const config = configs[domainId];
    if (!config) return;
    const sim = new LiveSimulation(config, 42);
    set({
      activeDomainId: domainId,
      config,
      sim,
      simTick: 0,
      running: false,
      selectedCustomerId: null,
      selectedResourceId: config.resources[0]?.id || null,
      selectedServiceId: null,
    });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedCustomerId: (id) => set({ selectedCustomerId: id }),
  setSelectedResourceId: (id) => set({ selectedResourceId: id }),
  setSelectedServiceId: (id) => set({ selectedServiceId: id }),
  setSpeed: (speed) => set({ speed }),

  toggleRunning: () => {
    set(state => ({ running: !state.running }));
  },

  tickSim: () => {
    const { sim } = get();
    sim.tick(1);
    set(state => ({ simTick: state.simTick + 1 }));
  },

  addCustomer: (serviceId, priorityClassId, missingReqs = []) => {
    const { sim } = get();
    const customer = sim.addCustomer(serviceId, priorityClassId, missingReqs);
    set(state => ({
      simTick: state.simTick + 1,
      selectedCustomerId: customer.id,
    }));
  },

  addRandomCustomer: () => {
    const { sim } = get();
    const customer = sim.addRandomCustomer();
    set(state => ({
      simTick: state.simTick + 1,
      selectedCustomerId: customer.id,
    }));
  },

  addResource: (name: string, count: number) => {
    const { config, sim } = get();
    const newId = name.toLowerCase().replace(/\s+/g, '-');
    config.resources.push({
      id: newId,
      name,
      count
    });
    // Add to live queues
    sim.queues.set(newId, []);
    for (let i = 0; i < count; i++) {
      sim.servers.push({
        resourceId: newId,
        serverIndex: i,
        busy: false,
      });
    }
    set(state => ({ simTick: state.simTick + 1 }));
  },

  injectDelay: (resourceId, delayMin) => {
    const { sim } = get();
    sim.injectDelay(resourceId, delayMin);
    set(state => ({ simTick: state.simTick + 1 }));
  },

  loadDemo: () => {
    const { sim } = get();
    sim.loadDemo();
    set(state => ({
      simTick: state.simTick + 1,
      running: true,
      selectedCustomerId: null,
    }));
  },

  setAutoArrivals: (on) => {
    const { sim } = get();
    sim.autoArrivals = on;
    set(state => ({ simTick: state.simTick + 1 }));
  },

  staffMarkDone: (resourceId, serverIndex) => {
    const { sim } = get();
    sim.staffMarkDone(resourceId, serverIndex);
    set(state => ({ simTick: state.simTick + 1 }));
  },
}));
