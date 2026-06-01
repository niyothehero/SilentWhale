# SilentWhale Threat Model

## Confidential Assets

- Whale wallet, notional size, confidence, entry score, risk score.
- Watchlist wallet and minimum confidence thresholds.
- Analyst reputation scores.
- Team seat access and subscription state.

## Trust Boundaries

- CoFHE ciphertext handles are stored on-chain; plaintext should only exist in the client or QA scripts after permit-based decrypt.
- `FHE.allow` grants are the source of decrypt authority. A wallet must satisfy the contract tier/team rules before `grantSignalAccess` allows handles.
- Self permits are wallet-scoped EIP-712 signatures and should stay in the browser SDK store.
- Alert receipts store hashed rules, channel metadata, and delivery references, not raw watchlist strategy.

## Controls

- Analysts must be owner-approved before curated publishing.
- Owner and signal analyst can edit/archive signal lifecycle metadata.
- Paid access supports ETH and one owner-configured ERC20 settlement token.
- DAO teams inherit access from an active DAO-tier owner subscription.
- Treasury withdrawals and token configuration are owner-only and guarded by `nonReentrant`.
- Publish cooldown can be enabled to slow analyst spam.
- Contract bytecode size is checked before deploy.

## Residual Risks

- Indexing and notification delivery are off-chain services; operators must protect API keys and job credentials.
- ERC20 payment safety depends on configuring the intended token address and decimals per network.
- The current alert matcher records receipts but does not prove private rule matching on-chain.
- Mainnet CoFHE support is not available yet; production deployment remains on supported testnets until Fhenix mainnet support ships.
