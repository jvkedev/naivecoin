# Naivecoin (TypeScript)

A small cryptocurrency built from scratch in TypeScript to learn how blockchains work under the hood: hashing, proof of work, peer-to-peer syncing, the UTXO transaction model, and wallets with digital signatures. It follows the structure of the [Naivecoin tutorial](https://lhartikk.github.io/), rewritten with current tooling (Node.js, TypeScript strict mode, Express 5, `ws`) and rebuilt step by step.

## The idea of this project

Most people use crypto without knowing how it works. This project answers five questions by building each answer:

1. **How can data be tamper-proof?** Blocks are linked by SHA-256 hashes.
2. **How can strangers agree on one history with no central server?** Nodes talk peer-to-peer and follow the valid chain with the most work.
3. **Why is it expensive to cheat?** Proof of work makes adding a block cost real computation.
4. **How can money exist without a bank?** The UTXO model tracks unspent outputs instead of account balances.
5. **How do you prove a coin is yours?** Wallets: a private key signs, and every node verifies the signature against the public key.

## Progress

| Step | Feature | Status |
|---|---|---|
| 1 | Basic blockchain (blocks, hashing, validation) | Done |
| 2 | HTTP API (Express) | Done |
| 3 | P2P network (WebSocket sync) | Done |
| 4 | Proof of work, difficulty adjustment, total-work rule, timestamp checks | Done |
| 5 | Transactions (UTXO model) | Done |
| 6 | Wallet (key pairs, addresses, signatures) | Done |
| 7 | Transaction pool | Next |
| 8 | Polish (lookups, tests, cleanup) | Not started |

Roughly 75% of the project is finished.

## What works today

- **Blocks** linked by SHA-256 hashes, with full block and chain validation
- **Proof of work:** each block has a `nonce` and `difficulty`; its hash must start with `difficulty` zero bits
- **Difficulty adjustment:** every 5 blocks, difficulty goes up 1 if the batch was mined in under half the target time, and down 1 (never below 0) if it took over double. Target: 1 block per 10 seconds
- **Difficulty is enforced:** every node recomputes the required difficulty and rejects blocks that claim a different one
- **Most total work wins:** nodes follow the valid chain with the most accumulated work (each block counts as `2^difficulty`), not just the longest
- **Timestamp rules:** a block may not be more than 60 seconds older than its parent, or more than 60 seconds ahead of the node's clock
- **Transactions (UTXO):** blocks contain transactions; the first is always the miner's reward (coinbase)
- **Double-spend protection:** a spent output is removed from the unspent set, so it cannot be spent again, within a block or across the chain
- **Wallets:** each node has its own private key (kept in a git-ignored file) and an address derived from its public key
- **Signatures:** to spend an output, the owner signs the transaction; every node verifies each signature against the address the output is locked to
- **Wallet transactions:** the wallet picks enough of its own outputs, pays the receiver, and sends change back to itself
- **HTTP API** to view the chain, mine blocks, pay other addresses, check balance and manage peers
- **P2P sync:** several nodes stay in sync over WebSockets

## Tech stack

- TypeScript (strict, ESM, `nodenext`), run with [`tsx`](https://github.com/privatenumber/tsx)
- Express 5 for the HTTP API
- [`ws`](https://github.com/websockets/ws) for WebSocket peer connections
- Node's built-in `node:crypto` for SHA-256 hashing and ECDSA (`secp256k1`) signatures, with no crypto dependency

## Getting started

```bash
git clone https://github.com/jvkedev/naivecoin.git
cd naivecoin
npm install
npm run dev
```

A node defaults to HTTP port `3001` and P2P port `6001`. On first start it creates a wallet file at `wallet/private_key_<HTTP_PORT>`. That folder is in `.gitignore`: **never commit or share a private key.**

### Run two nodes

Each node needs its own ports, and so gets its own wallet. In two terminals:

```bash
# terminal 1
HTTP_PORT=3001 P2P_PORT=6001 npm run dev

# terminal 2
HTTP_PORT=3002 P2P_PORT=6002 npm run dev
```

Connect node 2 to node 1:

```bash
curl -X POST -H "Content-Type: application/json" \
  --data '{"peer": "ws://localhost:6001"}' \
  http://localhost:3002/addPeer
```

Chains, peers and unspent outputs live in memory only. After restarting a node, run `/addPeer` again. The wallet file survives restarts, so the address stays the same.

### Try the whole flow

1. Get each node's address:

   ```bash
   curl http://localhost:3001/address
   curl http://localhost:3002/address
   ```

2. Mine a block on node 1. The 50-coin reward goes to node 1's wallet:

   ```bash
   curl -X POST http://localhost:3001/mineBlock
   curl http://localhost:3001/balance        # 50
   ```

3. Pay 20 from node 1 to node 2 (use node 2's address):

   ```bash
   curl -X POST -H "Content-Type: application/json" \
     --data '{"address": "<NODE 2 ADDRESS>", "amount": 20}' \
     http://localhost:3001/mineTransaction
   ```

   Node 1 now has 80 (30 change + 50 new reward) and node 2 has 20.

4. Try to pay more than you own: the request is refused with "Not enough coins".

5. Pay back from node 2 to node 1 and watch both balances update.

## API

| Method | Endpoint | Body | Description |
|---|---|---|---|
| GET | `/blocks` | none | Returns the whole chain |
| GET | `/unspentOutputs` | none | Lists every unspent output (the "notebook") |
| GET | `/address` | none | This node's wallet address (its public key) |
| GET | `/balance` | none | Coins owned by this node's wallet |
| POST | `/mineBlock` | none | Mines a block; the reward goes to this node's wallet |
| POST | `/mineTransaction` | `{ "address": "...", "amount": 20 }` | Pays `amount` from this node's wallet to `address`, signs it, and mines it into a block with the reward |
| POST | `/addPeer` | `{ "peer": "ws://host:p2pPort" }` | Connects to another node |
| GET | `/peers` | none | Lists connected peers |

`/addPeer` takes the other node's **P2P (WebSocket) port**, not its HTTP port.

## How it works

### Blocks

```
Block { index, hash, previousHash, timestamp, data: Transaction[], difficulty, nonce }
```

The hash is `SHA-256(index || previousHash || timestamp || JSON(data) || difficulty || nonce)`. Every field that must not be altered is part of the hash, so changing anything in an old block changes its hash and breaks the link to the next one.

A block is valid when:

1. its `index` is the previous index + 1
2. its `previousHash` equals the previous block's `hash`
3. its timestamp passes the timestamp rules
4. recomputing its hash gives the stored `hash`
5. its hash has at least `difficulty` leading zero bits
6. its `difficulty` equals what the rules require at that height
7. its transactions are valid against the current unspent set

### Proof of work

Miners try `nonce = 0, 1, 2, ...` until the hash starts with enough zero bits. Each extra zero bit halves the chance of success, so each +1 difficulty is roughly twice the work.

### Choosing between chains

A chain is valid when it starts with the known genesis block and every block is valid against the one before it, including its difficulty and transactions (replayed from the start with a running unspent set). A node replaces its chain only when the received chain is valid and has more total work.

### Transactions (UTXO model)

Instead of account balances, the chain tracks **unspent transaction outputs**, like cash notes:

- An **output** (`TxOut`) is a note: an `address` (the owner's public key) and an `amount`.
- An **input** (`TxIn`) points at a note being spent, by `(txOutId, txOutIndex)`, and carries the owner's **signature**.
- A **transaction** spends existing outputs and creates new ones. Total in equals total out; any leftover goes back to the sender as change.
- The **transaction id** is the SHA-256 of its inputs and outputs (not the signatures), so changing any amount or address is detected.
- The **coinbase transaction** is the first transaction in each block. It has one fake input (empty `txOutId`, `txOutIndex` set to the block number so ids stay unique) and creates a fixed 50-coin reward for the miner.
- The **unspent set** holds every output that exists and is not spent. After each block, spent outputs are removed and new ones added. It is rebuilt from the first block whenever the chain is replaced.

A transaction is valid when:

1. its id matches its contents
2. no input appears twice
3. every output amount is above zero
4. every input points at an existing unspent output
5. every input carries a valid signature from the owner of that output
6. total input equals total output

A block's transaction list is valid when the first transaction is a correct coinbase, every other transaction passes the checks above, and no output is spent twice within the block.

### Wallets and signatures

A wallet is a key pair on the `secp256k1` curve (the one Bitcoin uses):

- The **private key** is generated on first start and saved to a git-ignored file. It never leaves the node.
- The **public key** is derived from it and used as the **address**. It is one-way: the address cannot be turned back into the private key.
- To spend, the wallet signs the **transaction id** with the private key. Because the id commits to every input and output, changing anything after signing breaks the signature, even if the id is recalculated.
- Every node verifies each signature against the address stored on the output being spent. A signature from anyone else, or none at all, is rejected.
- To pay, the wallet selects enough of its own outputs, creates one output for the receiver and one change output for itself, then signs each input.

### Peer-to-peer messages

| Type | Meaning |
|---|---|
| `QUERY_LATEST` | "Send me your latest block" |
| `QUERY_ALL` | "Send me your whole chain" |
| `RESPONSE_BLOCKCHAIN` | "Here are blocks" (answer to a query, or an announcement after mining) |

When a node receives blocks, it compares the peer's latest block with its own:

1. Not ahead of me: ignore it (this also stops blocks bouncing between nodes forever).
2. Fits on top of my latest block: validate, add, and tell my other peers.
3. Doesn't fit and only one block was sent: I'm behind by more than one, so ask for the whole chain.
4. Doesn't fit and a whole chain was sent: replace mine only if it is valid and has more work.

Nothing from a peer is trusted; every block and chain is validated first.

## Project structure

```
src/
  blockchain.ts    blocks, hashing, proof of work, difficulty, chain validation and selection, unspent set
  transaction.ts   transaction classes, ids, coinbase, unspent updates, signing, transaction and block validation
  keys.ts          key helpers: derive public key, sign data, verify signature
  wallet.ts        private key storage, address, balance, building and signing payments
  p2p.ts           WebSocket server, peer connections, messages, broadcasting
  main.ts          Express HTTP API and startup
wallet/            private key files (git-ignored, never commit)
```

## What is left

1. **Transaction pool (Step 7):** pending transactions waiting to be mined, validated on entry, cleaned after each block, shared between peers over P2P, and mined by miners
2. **Polish (Step 8):** lookups (address history, transaction by id), tests, cleanup, final documentation
3. Possible extra: a separate Next.js frontend that talks to a node over HTTP

## Known limitations

- A payment goes straight into a mined block; there is no pool of pending transactions yet (Step 7)
- The private key is stored as plain hex in a file, with no encryption or password
- The chain, peer list and unspent set are in memory only; a restarted node starts from genesis and re-syncs (the wallet file is kept)
- A block cannot spend an output created earlier in the same block
- No reconnection or heartbeat for dropped peer connections
- Work is summed with normal numbers; real systems use `BigInt` for very high difficulty