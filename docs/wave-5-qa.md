# Wave 5 QA Matrix

Run these checks before shipping a deployment.

## Local

```bash
npm run compile
npm run test:contracts
npm run security:check
npm run build
```

## Testnet

Fresh production deployment:

```bash
npm run deploy:sepolia
npm run qa:wallet
npm run indexer
```

Disposable QA deployment only:

```bash
$env:ALLOW_DEMO_SEED="true"; npm run seed:sepolia; Remove-Item Env:\ALLOW_DEMO_SEED
$env:ALLOW_LIVE_QA_MUTATION="true"; npm run qa:sepolia; Remove-Item Env:\ALLOW_LIVE_QA_MUTATION
```

## Wallet UX

- No wallet extension: connect buttons should report that a wallet extension is required.
- Wrong network: wallet should switch to the configured chain or offer to add it.
- Rejected account request: status text should keep the user on the page with a retry path.
- Rejected transaction: page status should show the short wallet error.
- Expired CoFHE permit: decrypt should prompt through the SDK permit flow again.

## Browser Surfaces

- `/dashboard`: filters, pagination, signal unlock, inactive signal state.
- `/signals/[id]`: detail read, encrypted unlock, edit/archive controls.
- `/analyst`: encrypted publish with generated scores and provenance.
- `/subscription`: ETH payment, ERC20 payment, billing receipts.
- `/watchlist`: encrypted watchlist add/decrypt.
- `/alerts`: alert history and read/unread updates.
- `/dao`: DAO team creation and member seats.
- `/analysts`: profiles and encrypted reputation unlocks.
- `/admin`: feeds, grants, token config, treasury, cooldown, alert receipts.
