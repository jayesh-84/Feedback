import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'preprod';

const distDir = path.resolve('dist');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

console.log(`Running Vite build for UI in ${mode} mode...`);
execSync(`npx tsc && npx vite build --mode ${mode}`, { stdio: 'inherit' });

console.log('Copying keys and zkir to dist...');
const keysSrc = path.resolve('../contract/src/managed/feedback/keys');
const zkirSrc = path.resolve('../contract/src/managed/feedback/zkir');

if (fs.existsSync(keysSrc)) {
  fs.cpSync(keysSrc, path.resolve('dist/keys'), { recursive: true });
} else {
  console.log('Keys directory does not exist, skipping copy.');
}

if (fs.existsSync(zkirSrc)) {
  fs.cpSync(zkirSrc, path.resolve('dist/zkir'), { recursive: true });
} else {
  console.log('Zkir directory does not exist, skipping copy.');
}

console.log('UI Build completed successfully!');
