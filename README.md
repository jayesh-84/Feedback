# Midnight Feedback Privacy DApp

A privacy-first decentralized feedback application built on the [Midnight Network](https://midnight.network/) using zero-knowledge proofs (ZKP).

This DApp demonstrates the power of Midnight's private-smart-contract model:
- **Anonymous Submissions**: Anyone can submit feedback containing a rating (1-5 stars) and a comment.
- **ZK Ledger Computations**: The smart contract aggregates ratings (`rating_sum`, `feedback_count`) and publishes public metrics (average rating, latest rating, latest comment) without exposing the submitter's identity or private transaction history.
- **Board Ownership & Access Control**: The board owner is determined cryptographically via a private secret key hash. Only the board owner can run the ZK circuit to clear the board feedback.

---

## Project Structure

```
feedback-dapp/
├── contract/               # Private smart contract in Compact language
│   ├── src/               # Contract source (feedback.compact) and TS bindings
│   └── build.js           # Cross-platform contract build pipeline
├── api/                   # Common types and adaptors for CLI and React UI
│   └── build.js           # Cross-platform API build script
├── bboard-cli/            # Command-line interface client (adapted for Feedback)
│   └── build.js           # Cross-platform CLI build script
└── bboard-ui/             # Premium dark-theme React web client
    └── build.js           # Cross-platform UI build script
```

---

## Prerequisites

### 1. Node.js Version Check
Ensure Node.js is installed (`v24` or higher is recommended):
```bash
node --version
```

### 2. Docker
Docker is required to run the local **Proof Server**, which generates the cryptographic zero-knowledge proofs:
```bash
docker --version
```
Ensure Docker Desktop is running.

### 3. Lace Wallet Extension (Web UI Only)
Install the official Lace wallet browser extension on the [Chrome Store](https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk) or [Edge Store](https://microsoftedge.microsoft.com/addons/detail/lace/efeiemlfnahiidnjglmehaihacglceia).
- Configure your wallet to the **Preprod** network.
- Connect to your **Local Proof Server** (`http://localhost:6300`).
- Fund your wallet with test tNIGHT and generate tDUST tokens using the [Midnight Preprod Faucet](https://midnight-tmnight-preprod.nethermind.dev/).

---

## Setup & Compilation

### 1. Install Workspace Dependencies
Run this command from the repository root:
```bash
npm install
```

### 2. Compile the Smart Contract
We run the compiler using our pre-pulled, version-aligned compiler image locally:
```bash
# Set the version environment variable and run compact compile
$env:COMPACTC_VERSION="0.25.0"; npm run compact
```

### 3. Build the Entire Workspace
To compile the TypeScript wrappers, API layer, CLI, and React UI cross-platform, run:
```bash
npm run build
```

---

## Option 1: Command Line Interface (CLI)

### 1. Start the Local Proof Server
```bash
cd bboard-cli
docker compose -f proof-server-local.yml up -d
cd ..
```

### 2. Run the CLI Application
Run the CLI launcher to connect to the Preprod testnet:
```bash
npm run preprod-remote --workspace=@midnight-ntwrk/bboard-cli
```

### 3. Using the CLI
- **Create Wallet**: Option `1` generates a new seed and address. Paste and fund this address from the faucet.
- **Deploy Contract**: Choose Option `3` (Deploy) to publish the feedback board to the network.
- **Submit Feedback / Clear Board / View Ledger**: Interact with the contract using privacy-preserving zero-knowledge proofs.

---

## Option 2: Web Browser Interface (UI)

The UI features a stunning, premium glassmorphic dark space theme with interactive star ratings, glowing stat charts, and owner administration tools.

### 1. Start the Web Server
Make sure the proof server is running, then launch the React dev server:
```bash
npm run dev --workspace=@midnight-ntwrk/bboard-ui
```
Open `http://localhost:8080` in your web browser.

---

## Smart Contract Deployment & Placeholder Replacement

Once you are ready to deploy to production:

1. **Compile & Deploy** your `feedback.compact` contract using the CLI or deployment script.
2. **Copy the deployed contract address** returned by the deployment transaction.
3. **Replace the contract address placeholder** `<YOUR_DEPLOYED_CONTRACT_ADDRESS>` in the following files:
   - In [bboard-cli/src/config.ts](file:///c:/Users/SARVADNYA/demo/bboard-cli/src/config.ts)
   - In [bboard-ui/src/contexts/BrowserDeployedBoardManager.ts](file:///c:/Users/SARVADNYA/demo/bboard-ui/src/contexts/BrowserDeployedBoardManager.ts)

Everything else is fully adapted, bundled, and ready to go!

---

## Troubleshooting

| Issue | Resolution |
| --- | --- |
| `npm run compact` fails | Ensure Docker is running. The build pipeline uses a local Docker image to compile the contract. |
| `TLA / Top-Level Await` Bundle Error | Built-in build script processes compiler-generated `.cjs` to `.js` ESM dynamically to ensure compatibility with Vite's WebAssembly bundling requirements. |
| Lace wallet not detected | Ensure the Lace extension is active and set to Preprod network with your local proof server URL. |
