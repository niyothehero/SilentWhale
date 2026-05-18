# SilentWhale

Private whale intelligence powered by on-chain encrypted data.

SilentWhale is a privacy-preserving crypto intelligence app where analysts publish whale signals, subscribers buy access on-chain, and authorized wallets decrypt sensitive fields locally through Fhenix CoFHE permissions. The public feed can show useful market context while keeping the actual wallet, amount, confidence, entry score, and risk score sealed until access is granted.

Think of it as a private intelligence layer for whale tracking: public enough to discover a signal, encrypted enough to preserve the edge.

## Live Deployment

- App: `https://silent-whale-lake.vercel.app`
- Latest Vercel deployment: `https://silent-whale-q2wt2qv4e-nikkus-projects-d0d225f5.vercel.app`
- Network: Ethereum Sepolia
- Contract: `0x4756117A9Ea918B12A5AdeF7EfFe5484E38C114E`
- Deployment metadata: `deployments/silentwhale.eth-sepolia.json`
- Seed signal tx: `0xc0177449bb7f0340f286890b0d3b45819294befa8cc2491222c27afffbe32248`
- Latest live QA signal tx: `0x3406ecec4bc7c26b31c4c6112a3e5f8346bf5dc1d3c3c993ca0702a53d61266b`
- Latest live QA access grant tx: `0x7a5fe24c4a01b18f91a060592a71625878663fa35731ea99309047b421e8c789`
- Live QA result: `LIVE_QA_OK`

## What The App Does

SilentWhale solves a real problem in public whale tracking: once an alpha wallet or exact trade becomes public, everyone copies it and the edge disappears. The app keeps sensitive intelligence encrypted while still letting users discover that a valuable signal exists.

Core users:

- Analysts publish private alpha feeds and monetize access.
- Subscribers buy Pro, Elite, or DAO access and decrypt the signals they are allowed to see.
- Admins manage analyst approvals, subscription prices, feeds, and protocol controls.

Current product surfaces:

- Landing page explaining the privacy-first whale intelligence concept.
- Dashboard for live encrypted signal discovery.
- Analyst console for publishing encrypted whale signals.
- Subscription page for on-chain ETH tier access.
- Private watchlist page for encrypted wallet and threshold storage.
- Admin page for analyst approval and tier pricing.
- Roadmap page for build status and next steps.

## How It Works

1. An analyst prepares a signal with public context plus sensitive fields.
2. The frontend encrypts wallet, amount, confidence, entry score, and risk score with `@cofhe/sdk`.
3. `SilentWhale.sol` stores the encrypted handles on-chain.
4. A subscriber buys a Pro, Elite, or DAO tier with `subscribe`.
5. The subscriber calls `grantSignalAccess` for an eligible signal.
6. The contract grants FHE ACL access only if the wallet has enough tier access.
7. The frontend uses the wallet permit to decrypt locally and display plaintext to that user.

Private watchlists follow the same idea: the wallet and confidence threshold are encrypted before being written on-chain, and only the owner can decrypt their watchlist data.

## Current On-Chain Features

- Encrypted whale signals using `InEaddress`, `InEuint64`, and `InEuint32`.
- Feed-based signal publishing with Pro, Elite, and DAO tier requirements.
- Owner-gated analyst approval before curated publishing.
- On-chain native ETH subscriptions.
- ACL-gated signal unlocks before decrypt.
- Encrypted private watchlists.
- Encrypted analyst reputation storage.
- Owner controls for analyst status and tier prices.
- Live Sepolia QA script covering publish, subscribe, ACL grant, decrypt, watchlist, and analyst score flows.

## Current App Pages

- `/` - product landing page and overview.
- `/dashboard` - public signal feed plus encrypted-detail unlock flow.
- `/analyst` - publish encrypted signal handles to the contract.
- `/watchlist` - add and decrypt private encrypted watchlist items.
- `/subscription` - buy tier access on-chain.
- `/admin` - owner-only analyst approval and tier price controls.
- `/roadmap` - current build milestones and next planned protocol work.

## Setup

```bash
npm install
cp .env.example .env.local
npm run compile
npm run test:contracts
npm run dev
```

Required local env:

```bash
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
NEXT_PUBLIC_SILENT_WHALE_ADDRESS=0x4756117A9Ea918B12A5AdeF7EfFe5484E38C114E
```

Never commit a private key. For deploy, seed, or live QA, set it only in the shell process that needs it:

```bash
$env:PRIVATE_KEY="0x..."
npm run deploy:sepolia
npm run seed:sepolia
npm run qa:sepolia
Remove-Item Env:\PRIVATE_KEY
```

## Scripts

- `npm run dev`: start the Next app.
- `npm run build`: production Next build through webpack.
- `npm run compile`: compile Solidity contracts.
- `npm run test:contracts`: run CoFHE mock contract tests.
- `npm run deploy:sepolia`: deploy `SilentWhale` to Sepolia.
- `npm run seed:sepolia`: publish one encrypted demo signal.
- `npm run qa:sepolia`: run live Sepolia publish, subscribe, ACL grant, decrypt, watchlist, and reputation QA.

## Production Notes

- Vercel production and development envs are set for the current Sepolia contract.
- `next build` runs TypeScript validation.
- The app uses npm as the package manager with `package-lock.json`.
- `npm audit` still reports high advisories in the Hardhat and CoFHE-adjacent toolchain. The suggested automatic fixes require breaking upgrades such as Hardhat 3, so the current tested CoFHE-compatible Hardhat 2 stack is intentionally preserved.

## Wave 5 - Missing Features And Next Build Work

Wave 5 should move SilentWhale from a working testnet MVP into a more complete production protocol. These are the main issues and missing pieces found while reviewing the current app.

### 1. Real Whale Indexer

Current state: signals are manually published from the analyst console or seed/QA scripts. The dashboard reads recent signals directly from the contract.

Wave 5 work:

- Build an indexer that watches selected chains for whale wallet movement.
- Add token, sector, size, DEX, CEX, bridge, and LP movement classification.
- Store indexed metadata in a queryable backend.
- Add filters, search, pagination, and signal detail pages.
- Keep sensitive raw wallet intelligence encrypted before publishing.

### 2. AI Signal Engine

Current state: confidence, entry score, and risk score are manually entered by the analyst.

Wave 5 work:

- Add an AI scoring service for confidence, risk, narrative, and timing.
- Generate signal explanations from wallet history and market context.
- Write encrypted scores back on-chain.
- Add analyst review before final publish.
- Track model version and score provenance for trust.

### 3. Alerts And Watchlist Triggers

Current state: private watchlists are stored and decryptable, but they do not trigger real notifications.

Wave 5 work:

- Match indexed whale events against encrypted/private watchlist rules.
- Add in-app notifications.
- Add email, Telegram, Discord, or webhook alerts.
- Add alert history and read/unread state.
- Support threshold changes without leaking strategy.

### 4. ERC20 And USDC Payments

Current state: subscriptions use native ETH only.

Wave 5 work:

- Add ERC20 subscription settlement, especially USDC.
- Support stable monthly pricing independent of ETH volatility.
- Add payment receipts and billing history.
- Add owner withdrawal UI.
- Add tests for underpayment, refunds, renewals, and token decimals.

### 5. DAO And Team Access

Current state: DAO is a tier label, but there is no full team workspace or seat management.

Wave 5 work:

- Add organizations/team accounts.
- Add team seats and role-based permissions.
- Add shared decrypt access for approved members.
- Add delegated permits where supported.
- Add DAO dashboard views for institutional intelligence desks.

### 6. Analyst Marketplace And Reputation

Current state: analyst approval exists, and encrypted analyst score storage exists, but the UI does not expose a full marketplace.

Wave 5 work:

- Add analyst profiles and feed pages.
- Display public performance stats and encrypted reputation unlocks.
- Add feed subscription analytics.
- Add signal outcome tracking.
- Add dispute/report flows for bad or misleading signals.

### 7. Signal Lifecycle Management

Current state: the contract supports active/inactive signals, but the frontend does not expose full signal management.

Wave 5 work:

- Add edit/archive controls for analysts and admins.
- Add signal detail pages.
- Add expired, revoked, and inactive states in the dashboard.
- Add audit logs for signal changes.
- Add richer event history from publish to unlock.

### 8. Admin Console Completion

Current state: admin can approve analysts and update tier prices. The contract has more owner capabilities than the UI exposes.

Wave 5 work:

- Add feed create/update controls.
- Add owner grant subscription controls.
- Add treasury balance and withdraw controls.
- Add admin analytics for subscribers, revenue, and signal counts.
- Add safer confirmation states for owner-only writes.

### 9. Wallet And Network QA Matrix

Current state: live QA proves the on-chain path, and the deployed app renders cleanly. Full wallet-extension UX testing should be expanded.

Wave 5 work:

- Test MetaMask and other browser wallets across desktop and mobile.
- Test wrong-network switching and chain-add flows.
- Test rejected signatures and failed transactions.
- Add clear user-facing recovery messages.
- Add Playwright or browser-extension QA scripts for connect, subscribe, publish, and decrypt flows.

### 10. Security And Dependency Hardening

Current state: the app is working on Sepolia, but the dependency audit still flags toolchain packages that need a careful migration plan.

Wave 5 work:

- Plan CoFHE-compatible Hardhat/toolchain upgrades.
- Add slither/static-analysis checks for Solidity.
- Add threat model documentation for encrypted handles, ACL grants, and subscriptions.
- Add rate limits or anti-spam rules for signal publishing.
- Add monitoring for contract events and failed transactions.

## Long-Term Ideas

- Confidential auto-copy trading with user-defined risk limits.
- Private portfolio intelligence for whale clusters.
- Insider accumulation detection.
- DAO-grade intelligence feeds.
- Analyst revenue sharing.
- API access for funds, bots, and research desks.
- Cross-chain whale intelligence across Ethereum, Base, Arbitrum, and more.

