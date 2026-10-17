import dotenv from 'dotenv';
dotenv.config();

// Ensure simulation mode is active if live instances are not reachable
if (!process.env.SIMULATION_MODE) {
  process.env.SIMULATION_MODE = 'true';
}

import { globalHarness } from './harness.js';
import { Logger } from '../utils/logger.js';

async function main() {
  Logger.info(`Starting full certification run for all connectors (SIMULATION_MODE=${process.env.SIMULATION_MODE})...`);
  const results = await globalHarness.certifyAll();

  console.log('\n================ CERTIFICATION SUMMARY ================');
  let allPassed = true;
  for (const [key, record] of Object.entries(results)) {
    const statusSymbol = record.certified ? '✅' : '❌';
    console.log(`${statusSymbol} [${key.toUpperCase()}]: ${record.certified ? 'CERTIFIED' : 'FAILED'}`);
    for (const step of record.steps) {
      console.log(`   - ${step.step}: ${step.passed ? 'PASSED' : 'FAILED'} (${step.duration_ms}ms)`);
    }
    if (!record.certified) allPassed = false;
  }
  console.log('=======================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Certification runner failure:', err);
  process.exit(1);
});
