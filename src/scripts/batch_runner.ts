import fs from 'fs';
import path from 'path';
import axios from 'axios';

async function runBatch() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: tsx src/scripts/batch_runner.ts <input_path> <output_dir> [api_base_url]');
    console.error('Example: tsx src/scripts/batch_runner.ts ./test_inputs ./test_outputs http://localhost:3000');
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);
  const outputDir = path.resolve(args[1]);
  const baseUrl = args[2] || process.env.API_BASE_URL || 'http://localhost:3000';

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filesToProcess: string[] = [];

  if (fs.statSync(inputPath).isDirectory()) {
    const files = fs.readdirSync(inputPath).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      filesToProcess.push(path.join(inputPath, f));
    }
  } else {
    filesToProcess.push(inputPath);
  }

  console.log(`[Batch Runner] Processing ${filesToProcess.length} input files against ${baseUrl}...`);

  const summary = {
    total: filesToProcess.length,
    succeeded: 0,
    failed: 0,
    results: [] as any[]
  };

  for (const filePath of filesToProcess) {
    const filename = path.basename(filePath);
    const raw = fs.readFileSync(filePath, 'utf8');
    let inputPayload: any;

    try {
      inputPayload = JSON.parse(raw);
    } catch (err: any) {
      console.error(`Skipping invalid JSON file: ${filename}`);
      continue;
    }

    const outName = filename.replace('.json', '_result.json');
    const outPath = path.join(outputDir, outName);

    try {
      const response = await axios.post(`${baseUrl}/api/v1/publish`, inputPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `batch_${filename}_${Date.now()}`
        },
        timeout: 10000
      });

      fs.writeFileSync(outPath, JSON.stringify(response.data, null, 2));
      summary.succeeded++;
      summary.results.push({ file: filename, status: 'succeeded', output_file: outName });
      console.log(`✓ [SUCCESS] ${filename} -> ${outName}`);
    } catch (err: any) {
      const errorData = err.response?.data || { error: err.message };
      fs.writeFileSync(outPath, JSON.stringify(errorData, null, 2));
      summary.failed++;
      summary.results.push({
        file: filename,
        status: 'failed',
        error: errorData,
        output_file: outName
      });
      console.log(`✗ [FAILED] ${filename} -> Error recorded in ${outName}`);
    }
  }

  const summaryPath = path.join(outputDir, 'batch_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`\n[Batch Runner Complete] Succeeded: ${summary.succeeded}, Failed: ${summary.failed}`);
  console.log(`Summary report written to ${summaryPath}`);
}

runBatch().catch((err) => {
  console.error('Fatal batch runner error:', err);
  process.exit(1);
});
