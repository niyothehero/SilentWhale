# SilentWhale

Private whale intelligence powered by on-chain encrypted data.

SilentWhale is a privacy-preserving crypto intelligence app where analysts publish whale signals, subscribers buy access on-chain, and authorized wallets decrypt sensitive fields locally through Fhenix CoFHE permissions. The public feed can show useful market context while keeping the actual wallet, amount, confidence, entry score, and risk score sealed until access is granted.

Think of it as a private intelligence layer for whale tracking: public enough to discover a signal, encrypted enough to preserve the edge.

## Live Deployment

- App: `https://silent-whale-lake.vercel.app`
- Vercel production alias: `https://silent-whale-lake.vercel.app`
- Network: Ethereum Sepolia
- Contract: `0xa859F4010d52C4baaa9749e445b3dC520b92F679`
- Deployment metadata: `deployments/silentwhale.eth-sepolia.json`
- Deploy tx: `0xd203fefaeca514cf2618e9a458bfd78cc32a27babe670aac3dde989a75103e43`

- Brand assets: `public/silentwhale-mark.svg` for UI chrome and `public/icon.svg` for the favicon.

## What The App Does

SilentWhale solves a real problem in public whale tracking: once an alpha wallet or exact trade becomes public, everyone copies it and the edge disappears. The app keeps sensitive intelligence encrypted while still letting users discover that a valuable signal exists.

Core users:

- Analysts publish private alpha feeds and monetize access.
- Subscribers buy Pro, Elite, or DAO access and decrypt the signals they are allowed to see.
- Admins manage analyst approvals, subscription prices, feeds, and protocol controls.

Current product surfaces:

- Landing page explaining the privacy-first whale intelligence concept.
- Streamlined dashboard for on-chain signal discovery, live/gated counts, search, filters, pagination, and encrypted unlock actions.
- Signal detail pages with lifecycle edit/archive controls.
- Analyst marketplace pages with profiles and encrypted reputation unlocks.
- Analyst console for publishing encrypted whale signals with generated scores and provenance.
- Subscription page for ETH and ERC20/USDC-ready settlement plus billing receipts.
- Private watchlist page for encrypted wallet and threshold storage.
- Alert receipt history for owner/indexer-recorded private watchlist matches.
- DAO team workspace page for shared decrypt seats.
- Admin console for feeds, grants, pricing, payment token config, treasury, cooldowns, and alerts.

## How It Works

1. An analyst prepares a signal with public context plus sensitive fields.
2. The frontend scores/classifies the signal and encrypts wallet, amount, confidence, entry score, and risk score with `@cofhe/sdk`.
3. `SilentWhale.sol` stores encrypted handles plus public indexed metadata on-chain.
4. A subscriber buys a Pro, Elite, or DAO tier with ETH or the owner-configured ERC20 settlement token.
5. The subscriber calls `grantSignalAccess` for an eligible signal.
6. The contract grants FHE ACL access only if the wallet has enough personal or DAO-team tier access.
7. The frontend uses the wallet permit to decrypt locally and display plaintext to that user.

Private watchlists follow the same idea: the wallet and confidence threshold are encrypted before being written on-chain, and only the owner can decrypt their watchlist data. Alert receipts store hashed private rules rather than raw strategy.

## Current On-Chain Features

- Encrypted whale signals using `InEaddress`, `InEuint64`, and `InEuint32`.
- Feed-based signal publishing with Pro, Elite, and DAO tier requirements.
- Indexed metadata fields for movement type, venue, source chain, event ref, AI model, and score provenance.
- Owner-gated analyst approval before curated publishing.
- Native ETH subscriptions and owner-configured ERC20 subscription settlement.
- Payment receipts and billing history.
- ACL-gated signal unlocks before decrypt.
- Encrypted private watchlists.
- Encrypted analyst reputation storage.
- Analyst profiles and marketplace metadata.
- DAO team accounts with seat-based shared decrypt access.
- Alert receipts keyed by private rule hashes.
- Signal metadata updates, archive/reactivate lifecycle controls, and anti-spam publish cooldown.
- Owner controls for analysts, feeds, grants, tier prices, token config, treasury withdrawals, and alert recording.
- Live Sepolia QA script covering publish, subscribe, ACL grant, decrypt, watchlist, analyst score/profile, DAO seats, and alert flows.

## Current App Pages

- `/` - product landing page and overview.
- `/dashboard` - simplified on-chain signal desk with filters, status counts, details links, and encrypted unlock flow.
- `/signals/[id]` - signal detail, encrypted unlock, edit/archive lifecycle.
- `/analysts` - analyst marketplace, profiles, encrypted reputation unlocks.
- `/analyst` - publish encrypted signal handles to the contract.
- `/watchlist` - add and decrypt private encrypted watchlist items.
- `/alerts` - hashed private alert receipt history.
- `/dao` - DAO workspace and team seat management.
- `/subscription` - buy tier access on-chain with ETH or ERC20.
- `/admin` - owner-only protocol operations.

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
NEXT_PUBLIC_SILENT_WHALE_ADDRESS=0xa859F4010d52C4baaa9749e445b3dC520b92F679
NEXT_PUBLIC_USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
```

Vercel production and development envs should contain the same `NEXT_PUBLIC_*` values. The app does not currently need Pinata or OpenAI credentials at runtime, and deploy private keys should not be stored in Vercel for the frontend.

Never commit a private key. For deploy, seed, or live QA, set it only in the shell process that needs it:

```bash
$env:PRIVATE_KEY="0x..."
npm run deploy:sepolia
Remove-Item Env:\PRIVATE_KEY
```

## Scripts

- `npm run dev`: start the Next app.
- `npm run build`: production Next build through webpack.
- `npm run compile`: compile Solidity contracts.
- `npm run test:contracts`: run CoFHE mock contract tests.
- `npm run deploy:sepolia`: deploy `SilentWhale` to Sepolia.
- `npm run seed:sepolia`: test-only demo seeding; disabled unless `ALLOW_DEMO_SEED=true` is set for a disposable QA deployment.
- `npm run qa:sepolia`: mutating live QA for publish, subscribe, ACL grant, decrypt, watchlist, reputation, DAO team, and alert flows; disabled unless `ALLOW_LIVE_QA_MUTATION=true` is set for a disposable QA deployment.
- `npm run indexer`: index protocol signal events and optional ERC20 whale transfers into `cache/indexed-events.json`.
- `npm run qa:wallet`: verify configured RPC, chain, deployed bytecode, and wallet recovery code paths.
- `npm run security:check`: run bytecode and contract invariant checks for Wave 5 hardening.

## Production Notes

- Fhenix CoFHE currently supports Sepolia, Arbitrum Sepolia, and Base Sepolia testnets; mainnet support is not live yet.
- `next build` runs TypeScript validation.
- The app uses npm as the package manager with `package-lock.json`.
- `hardhat.config.js` uses optimizer runs `1` so the Wave 5 contract stays under the EIP-170 deploy limit.
- `docs/threat-model.md` documents CoFHE handles, ACL grants, subscriptions, teams, alerts, and residual risks.
- `docs/wave-5-qa.md` lists the local, testnet, wallet, and browser QA matrix.
- `npm audit` still reports high advisories in the Hardhat and CoFHE-adjacent toolchain. The suggested automatic fixes require breaking upgrades such as Hardhat 3, so the current tested CoFHE-compatible Hardhat 2 stack is intentionally preserved.
- The production dashboard was polished to avoid heavy card UI: it uses simple row-based signal reading, light dividers, direct details links, and one clear unlock action per signal.

## Final QA Snapshot

Last verified on June 1, 2026:

- `npm run lint` passed.
- `npm run test:contracts` passed with 9 tests.
- `npm run security:check` passed with deployed bytecode at 24,494 bytes.
- `npm run qa:wallet` passed against Sepolia chain `11155111`.
- `npm run indexer` indexed 0 protocol signals on the fresh empty deployment.
- `npm run build` passed. The build still reports webpack circular chunk warnings, but deployment succeeds.
- Vercel production route smoke checks returned `200` for `/`, `/dashboard`, `/admin`, `/alerts`, `/analyst`, `/analysts`, `/dao`, `/subscription`, `/watchlist`, and `/signals/1`.

## Wave 5 - Completed   Build

Wave 5 turns SilentWhale into a complete testnet protocol surface while staying aligned with current CoFHE support on Sepolia, Arbitrum Sepolia, and Base Sepolia.

- Real indexer foundation: `scripts/indexer.js` indexes SilentWhale protocol events and optional ERC20 whale transfers. Dashboard search, filters, pagination, classifications, source chain, venue, event ref, and detail pages are live.
- AI signal engine: analyst publish flow can generate confidence, entry, risk, narrative, model version, and provenance before encrypting scores and writing handles on-chain.
- Alerts and watchlist receipts: private watchlists remain encrypted, and the owner/indexer can record hashed rule receipts with read/unread state in `/alerts`. The matcher remains off-chain so raw watchlist strategy is never written to the contract.
- ERC20 and USDC payments: the contract supports owner-configured ERC20 settlement, stable token tier prices, receipts, billing history, approvals, and token treasury withdrawal.
- DAO and team access: DAO subscribers can create team workspaces, add seats, and share decrypt eligibility with members while the owner subscription remains active.
- Analyst marketplace and reputation: analysts can publish profiles, public feed coverage is shown in `/analysts`, and encrypted reputation scores unlock through CoFHE permits.
- Signal lifecycle management: `/signals/[id]` supports detail pages, metadata edits, archive/reactivate controls, inactive dashboard states, and event-backed history.
- Admin console completion: `/admin` now covers feeds, analyst allowlist, ETH/token pricing, owner grants, treasury, cooldowns, analytics, and alert recording.
- Wallet and network QA: `npm run qa:wallet` checks RPC chain, deployed bytecode, and wallet recovery code paths; `docs/wave-5-qa.md` lists browser wallet scenarios.
- Security hardening: custom errors keep bytecode deployable, treasury writes use `nonReentrant`, cooldowns reduce spam, and `docs/threat-model.md` captures residual risks.

## Long-Term Ideas

- Confidential auto-copy trading with user-defined risk limits.
- Private portfolio intelligence for whale clusters.
- Insider accumulation detection.
- DAO-grade intelligence feeds.
- Analyst revenue sharing.
- API access for funds, bots, and research desks.
- Cross-chain whale intelligence across Ethereum, Base, Arbitrum, and more.
