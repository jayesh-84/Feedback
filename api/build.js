import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const distDir = path.resolve('dist');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

console.log('Compiling API Typescript...');
execSync('npx tsc --project tsconfig.build.json', { stdio: 'inherit' });
console.log('API Build completed successfully!');
