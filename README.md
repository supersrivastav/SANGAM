# FlowDesk: Beyond the Queue ⚡

FlowDesk (formerly SANGAM) is an AI-augmented queue management platform that eliminates unpredictable waiting lines. Instead of traditional first-come-first-serve ticketing, our proprietary TypeScript engine dynamically calculates live ETAs, factors in multi-step service journeys, and optimizes staff utilization in real-time. 

Customers use a natural language AI Receptionist to join queues remotely and track their live progress on mobile, while admins monitor facility health via data-rich telemetry dashboards.

---

## 🌟 Key Features

- **Smart AI Receptionist**: Natural language processing (heuristic intent matching) routes customers to the correct service automatically without complex menus.
- **Dynamic Simulation Engine**: Built from scratch in TypeScript, the engine calculates highly accurate, live ETAs based on current floor utilization, resource availability, and missing prerequisite documents.
- **Cross-Domain Architecture**: Seamlessly scales across diverse environments—including Hospitals, Banks, Government Service Centers (JanSeva), and Salons.
- **Role-Based Portals**:
  - **Customer Portal**: Mobile-optimized, live journey planner that acts as a digital ticket.
  - **Staff Panel**: Streamlined view for workers to manage active services without cognitive overload.
  - **Admin Dashboard**: Real-time telemetry, server utilization, bottleneck alerts, and historical performance comparisons.
- **Data-Rich Comparison Tool**: Visually compare FlowDesk's algorithmic routing efficiency against standard FIFO (First-In-First-Out) systems.

---

## 🛠️ Tech Stack

FlowDesk is engineered for blistering performance as a purely client-side Single Page Application (SPA).

- **Frontend Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (v4) + custom vanilla CSS (iOS-style light theme)
- **State Management**: Zustand (lightweight global state for the simulation engine)
- **Routing**: Native Browser History API (`window.history.pushState`) for instantaneous, dependency-free tab switching.
- **Hosting**: GitHub Pages

---

## 🚀 Getting Started (Local Development)

Because the simulation engine and backend logic run entirely inside the browser, setup is incredibly fast.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/supersrivastav/SANGAM.git
   cd SANGAM
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

---

## 🏗️ Architecture & Engine Overview

At the heart of FlowDesk is the `src/engine/` directory, which houses our proprietary scheduling algorithm.

- **LiveSim (`liveSim.ts`)**: Manages the continuous simulation clock and state. It loops through active customers, allocates resources, resolves bottlenecks, and fires real-time notifications.
- **Policies (`policies/`)**: Contains the routing logic. `fifo.ts` represents traditional queuing, while `flowdesk.ts` implements our optimized, multi-step routing algorithm.
- **Configs (`configs/`)**: Domain-specific configurations (JSON format) define the required services, mandatory documents, base wait times, and physical resources for different environments (e.g., `bank.json`, `hospital.json`).
- **Store (`useFlowStore.ts`)**: The Zustand store acts as the bridge between the TypeScript simulation engine and the React UI, ensuring that when the engine ticks, the UI re-renders instantaneously.

---

*Designed with ❤️ for a frictionless world.*
