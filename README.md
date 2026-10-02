# FlowDesk: Beyond the Queue

FlowDesk is a domain-agnostic journey orchestrator for any service with multiple steps, shared resources, and variable durations (e.g., hospitals, banks, salons, government service centers).

It prevents wasted visits, intelligently routes customers in parallel across bottlenecks, and automatically re-plans the entire system when delays occur.

## MVP Scope Completed
1. **Config-driven Engine**: Switch between 4 included domains (Hospital, Parlour, Bank, Jan Seva Kendra) instantly via the UI dropdown. Everything reconfigures dynamically.
2. **Customer View**: Service picker, pre-visit requirement checklist (prevents return visits), and a live journey stepper with dynamically updated ETA ranges.
3. **Staff View**: Minimalist interface for staff to track "Now Serving", "Next Up", and mark services as done.
4. **Admin Dashboard**: Real-time resource capacity cards, bottleneck detection (turns red), disruption/delay injection, auto-generated suggestions, and a live event log.
5. **Comparison View**: A headless simulation runner that tests 100 customers under the FIFO baseline vs the FlowDesk smart policy, proving measurable time improvements.

## Technology Stack
* React 18
* Vite
* TypeScript
* Tailwind CSS v4
* Zustand (State management)
* Recharts (Data visualization)

## How to Run

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:5173`.

## Demo Script

1. **Start**: "Queue apps fix one line. Real pain is the whole journey: repeat visits, wasted walking, cascading delays."
2. **Customer View**: Select the Hospital domain, pick "OPD + Blood test", and leave Photo ID unchecked. Show the warning about a second visit. Check it to see the journey with live ETA ranges.
3. **Admin View**: Go to the Admin tab. Click "Load Demo" to populate the system. Show the live resource cards. Click "Inject delay: Doctor +20 min". Watch the cards turn red, the event log update, and suggestions appear.
4. **Comparison View**: Go to the Compare tab. Show the big % improvement numbers and the chart. Toggle disruption on to see FlowDesk's recovery advantage.
5. **Domain Switch**: Switch domain to Parlour, then Bank, then Jan Seva Kendra live. Show how the same app and engine seamlessly adapt to different configs.
6. **Close**: "A new domain is just a config file. FlowDesk turns any service workflow into a self-correcting customer journey."

## Architecture

* **`/src/configs/*.json`**: The core domain definitions. All labels, resources, services, and requirements are defined here.
* **`/src/engine/`**: The pure TypeScript discrete-event simulation core (no DOM/React dependencies).
  * `simulation.ts`: Event loop, entity tracking.
  * `policies/flowdesk.ts`: The smart scheduler using Shortest Processing Time (SPT) and journey urgency heuristics.
  * `comparison.ts`: Runs headless tests for the Compare view.
* **`/src/store/useFlowStore.ts`**: The Zustand store connecting the simulation engine to React components.
