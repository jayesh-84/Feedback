import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const distDir = path.resolve('dist');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

console.log('Compiling CLI Typescript...');
execSync('npx tsc --project tsconfig.build.json', { stdio: 'inherit' });

console.log('Copying managed contract files...');
fs.mkdirSync(path.resolve('dist/contract/src'), { recursive: true });
fs.cpSync(path.resolve('../contract/src/managed'), path.resolve('dist/contract/src/managed'), { recursive: true });

console.log('CLI Build completed successfully!');
