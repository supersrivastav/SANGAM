// Quick verification script for FlowDesk engine
// Run: npx tsx src/engine/verify.ts

import hospitalConfig from '../configs/hospital.json';
import parlourConfig from '../configs/parlour.json';
import bankConfig from '../configs/bank.json';
import jansevaConfig from '../configs/janseva.json';
import { DomainConfig } from './types';
import { runComparison } from './comparison';

const configs: [string, DomainConfig][] = [
  ['Hospital', hospitalConfig as DomainConfig],
  ['Parlour', parlourConfig as DomainConfig],
  ['Bank', bankConfig as DomainConfig],
  ['Jan Seva', jansevaConfig as DomainConfig],
];

const seeds = [42, 123, 456, 789, 1337];

console.log('=== FlowDesk Engine Verification ===\n');

for (const [name, config] of configs) {
  console.log(`--- ${name} ---`);
  
  let allBetter = true;
  for (const seed of seeds) {
    const result = runComparison({
      config,
      numCustomers: 100,
      seed,
      arrivalRate: 10,
      missingDocPercent: 20,
      preVisitFixRate: 0.7,
      withDisruption: false,
    });

    const avgBetter = result.flowdesk.avgTotalTime <= result.fifo.avgTotalTime;
    const p90Better = result.flowdesk.p90TotalTime <= result.fifo.p90TotalTime;
    const returnBetter = result.flowdesk.avgReturnVisits <= result.fifo.avgReturnVisits;

    if (!avgBetter || !p90Better) allBetter = false;

    console.log(`  Seed ${seed}: Avg ${result.fifo.avgTotalTime} → ${result.flowdesk.avgTotalTime} (${avgBetter ? '✅' : '❌'}), P90 ${result.fifo.p90TotalTime} → ${result.flowdesk.p90TotalTime} (${p90Better ? '✅' : '❌'}), Returns ${result.fifo.avgReturnVisits} → ${result.flowdesk.avgReturnVisits} (${returnBetter ? '✅' : '❌'})`);
  }

  console.log(`  Overall: ${allBetter ? '✅ All seeds pass' : '⚠️ Some seeds failed'}\n`);
}

// Test with disruption
console.log('--- With Disruption ---');
for (const [name, config] of configs) {
  const result = runComparison({
    config,
    numCustomers: 100,
    seed: 42,
    arrivalRate: 10,
    missingDocPercent: 20,
    preVisitFixRate: 0.7,
    withDisruption: true,
  });
  
  console.log(`  ${name}: Avg improvement ${result.improvements.avgTotalTime}%, P90 improvement ${result.improvements.p90TotalTime}%`);
}

console.log('\n=== Verification Complete ===');
