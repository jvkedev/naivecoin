# Naivecoin (TypeScript)

A small cryptocurrency built from scratch in TypeScript, as a learning project. It is a real, working blockchain: nodes mine blocks with proof of work, talk to each other over P2P, and move coins with signed transactions.

It is not production software. It exists to understand how a blockchain works, one piece at a time.

## What it can do

- **Blockchain:** blocks linked by SHA-256 hashes; any tampering breaks the chain.
- **Proof of work:** a block must have a hash with enough leading zero bits. Difficulty adjusts every 5 blocks toward 10 seconds per block.
- **Longest chain by work:** a node switches to another chain only if it has more total work, and it re-validates every block itself.
- **Timestamp rules:** a block cannot be more than 60 seconds older than the previous one or ahead of the node's clock.
- **P2P network:** nodes connect by WebSocket, sync chains, and broadcast new blocks and pending transactions.
- **Transactions (UTXO model):** coins are "notes" (unspent outputs). A transaction crosses out notes and writes new ones. Includes change outputs and a coinbase reward of 50 per block.
- **Wallets and signatures:** each node has an ECDSA (secp256k1) key pair. Every input is signed, and every node verifies the signatures.
- **Transaction pool:** unconfirmed transactions wait in memory, are shared between peers, refuse conflicting spends of the same note, are mined into the next block, and are cleaned out after each block.

## Progress

| Step | What | Status |
|---|---|---|
| 1 | Blockchain basics | Done |
| 2 | HTTP API | Done |
| 3 | P2P network | Done |
| 4 | Proof of work, difficulty, total work, timestamps | Done |
| 5 | UTXO transactions | Done |
| 6 | Wallets and signatures | Done |
| 7 | Transaction pool (add, clean, share, mine from pool, routes) | Done |
| 8 | Polish: lookups, tests, cleanup, final README and GitHub | Left |

The project is about 88% complete.

## How a payment flows

1. `POST /mineBlock` on a node: it earns a 50-coin reward note.
2. `POST /sendTransaction`: the wallet picks its own notes, signs them, and adds change. The transaction is validated, put in the node's pool, and sent to peers.
3. Peers validate it themselves and add it to their pools.
4. `POST /mineBlock` again: the block holds the coinbase first, then all pooled transactions.
5. The block spreads to peers. Each one checks it, crosses out spent notes, and removes mined transactions from its pool.

## Setup

```
npm install
npx tsc --noEmit
```

Run a node (each node needs its own ports):

```
HTTP_PORT=3001 P2P_PORT=6001 npx tsx src/main.ts
HTTP_PORT=3002 P2P_PORT=6002 npx tsx src/main.ts
```

Connect them:

```
POST http://localhost:3001/addPeer     {"peer": "ws://localhost:6002"}
```

Peer connections, chains, and pools live in memory. After restarting a node, call `/addPeer` again.

## HTTP routes

| Method | Route | What it does |
|---|---|---|
| GET | `/blocks` | The whole chain |
| POST | `/addPeer` | Connect to another node |
| GET | `/peers` | Connected peers |
| GET | `/unspentOutputs` | All unspent notes |
| GET | `/address` | This node's wallet address |
| GET | `/balance` | This node's balance |
| POST | `/mineBlock` | Mine a block: coinbase plus all pooled transactions |
| POST | `/sendTransaction` | Body `{"address": "...", "amount": 20}`; adds a signed transaction to the pool and shares it |
| GET | `/transactionPool` | Pending transactions |

## Project structure

```
src/
  main.ts            HTTP routes and startup
  blockchain.ts      blocks, mining, difficulty, chain validation, unspent notes
  p2p.ts             WebSocket network, block and pool sharing
  transaction.ts     transactions, validation, coinbase, unspent outputs
  transactionPool.ts pending transactions
  keys.ts            key generation, signing, verifying
  wallet.ts          wallet file, balance, creating transactions
wallet/              private keys (git-ignored, never commit)
```

## Security note

Private keys are stored in `wallet/private_key_<HTTP_PORT>`. That folder is in `.gitignore`. Anyone with a private key can spend its coins. Never commit or share it.

## Known limitations

- Nothing is saved to disk except wallet keys. Chains and pools reset when a node stops.
- The wallet does not know which of its notes are already used by pending transactions, so two payments cannot be sent before the next block is mined.
- No address format check beyond length, no transaction fees, no block size limit.
- Peers are not authenticated and the P2P layer has no rate limiting.
- Difficulty and timing are tuned for learning, not for a real network.

## Still to do (Step 8)

1. Lookups: balance by address, address history, transaction by id.
2. Automated tests.
3. Cleanup: unused imports, variable names.
4. Final README review and push to GitHub.

Optional later: a separate Next.js frontend that calls these routes.