import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const distDir = path.resolve('dist');

// 1. Remove dist directory if it exists
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

// 2. Post-process the compiler output to convert CJS to ESM (to avoid top-level await bundling issues in Vite)
const managedDir = path.resolve('src/managed/feedback/contract');
const cjsFile = path.join(managedDir, 'index.cjs');
const jsFile = path.join(managedDir, 'index.js');
const dctsFile = path.join(managedDir, 'index.d.cts');
const dtsFile = path.join(managedDir, 'index.d.ts');

if (fs.existsSync(cjsFile)) {
  console.log('Converting compiled contract index.cjs to index.js (ESM)...');
  let content = fs.readFileSync(cjsFile, 'utf8');
  
  // Replace CommonJS require with ESM import
  content = content.replace(
    "const __compactRuntime = require('@midnight-ntwrk/compact-runtime');",
    "import * as __compactRuntime from '@midnight-ntwrk/compact-runtime';"
  );
  
  // Replace CommonJS exports with ESM export
  const exportsBlock = `exports.Contract = Contract;
exports.ledger = ledger;
exports.pureCircuits = pureCircuits;
exports.contractReferenceLocations = contractReferenceLocations;`;
  
  const esmExports = `export { Contract, ledger, pureCircuits, contractReferenceLocations };`;
  
  if (content.includes(exportsBlock)) {
    content = content.replace(exportsBlock, esmExports);
  } else {
    // Fallback regex or generic replacement if spacing varies
    content = content.replace(/exports\.(\w+)\s*=\s*\1;/g, '');
    content += `\nexport { Contract, ledger, pureCircuits, contractReferenceLocations };\n`;
  }
  
  fs.writeFileSync(jsFile, content, 'utf8');
  console.log('ESM conversion complete!');
}

if (fs.existsSync(dctsFile)) {
  fs.copyFileSync(dctsFile, dtsFile);
}

// 3. Run tsc
console.log('Compiling Typescript...');
execSync('npx tsc --project tsconfig.build.json', { stdio: 'inherit' });

// 4. Copy managed directory
console.log('Copying managed files...');
fs.cpSync(path.resolve('src/managed'), path.resolve('dist/managed'), { recursive: true });

// 5. Copy contract file
console.log('Copying contract file...');
fs.copyFileSync(path.resolve('src/feedback.compact'), path.resolve('dist/feedback.compact'));

console.log('Build completed successfully!');
