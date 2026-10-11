# Naivecoin (TypeScript)

A small cryptocurrency built from scratch in TypeScript to learn how blockchains work under the hood: hashing, proof of work, peer-to-peer syncing, and the UTXO transaction model. It follows the structure of the [Naivecoin tutorial](https://lhartikk.github.io/), rewritten with current tooling (Node.js, TypeScript strict mode, Express 5, `ws`) and rebuilt step by step.

## The idea of this project

Most people use crypto without knowing how it works. This project answers five questions by building each answer:

1. **How can data be tamper-proof?** Blocks are linked by SHA-256 hashes.
2. **How can strangers agree on one history with no central server?** Nodes talk peer-to-peer and follow the valid chain with the most work.
3. **Why is it expensive to cheat?** Proof of work makes adding a block cost real computation.
4. **How can money exist without a bank?** The UTXO model tracks unspent outputs instead of account balances.
5. **How do you prove a coin is yours?** Wallets and digital signatures (next step).

## Progress

| Step | Feature | Status |
|---|---|---|
| 1 | Basic blockchain (blocks, hashing, validation) | Done |
| 2 | HTTP API (Express) | Done |
| 3 | P2P network (WebSocket sync) | Done |
| 4 | Proof of work, difficulty adjustment, total-work rule, timestamp checks | Done |
| 5 | Transactions (UTXO model) | Done |
| 6 | Wallet (key pairs and signatures) | Next |
| 7 | Transaction pool | Not started |
| 8 | Polish (balances, address lookup, tests) | Not started |

Roughly 60% of the project is finished.

## What works today

- **Blocks** linked by SHA-256 hashes, with full block and chain validation
- **Proof of work:** each block has a `nonce` and `difficulty`; its hash must start with `difficulty` zero bits
- **Difficulty adjustment:** every 5 blocks, difficulty goes up 1 if the batch was mined in under half the target time, and down 1 (never below 0) if it took over double. Target: 1 block per 10 seconds
- **Difficulty is enforced:** every node recomputes the required difficulty and rejects blocks that claim a different one
- **Most total work wins:** nodes follow the valid chain with the most accumulated work (each block counts as `2^difficulty`), not just the longest
- **Timestamp rules:** a block may not be more than 60 seconds older than its parent, or more than 60 seconds ahead of the node's clock
- **Transactions (UTXO):** blocks contain transactions; the first is always the miner's reward (coinbase)
- **Transaction validation:** id matches contents, inputs exist, no duplicate inputs, outputs are positive, and money in equals money out
- **Double-spend protection:** a spent output is removed from the unspent set, so it cannot be spent again, within a block or across the chain
- **Unspent set** kept in sync as blocks are added, and rebuilt from the first block whenever the chain is replaced
- **HTTP API** to view the chain, mine blocks, spend coins and manage peers
- **P2P sync:** several nodes stay in sync over WebSockets

## Tech stack

- TypeScript (strict, ESM, `nodenext`), run with [`tsx`](https://github.com/privatenumber/tsx)
- Express 5 for the HTTP API
- [`ws`](https://github.com/websockets/ws) for WebSocket peer connections
- Node's built-in `node:crypto` for SHA-256 (no hashing dependency)

## Getting started

```bash
git clone https://github.com/jvkedev/naivecoin.git
cd naivecoin
npm install
npm run dev
```

A node defaults to HTTP port `3001` and P2P port `6001`.

### Run two nodes

Each node needs its own ports. In two terminals:

```bash
# terminal 1
HTTP_PORT=3001 P2P_PORT=6001 npm run dev

# terminal 2
HTTP_PORT=3002 P2P_PORT=6002 npm run dev
```

Connect node 2 to node 1 (with curl, Bruno, or any HTTP client):

```bash
curl -X POST -H "Content-Type: application/json" \
  --data '{"peer": "ws://localhost:6001"}' \
  http://localhost:3002/addPeer
```

Chains, peers and unspent outputs live in memory only. After restarting a node, run `/addPeer` again.

### Try the whole flow

1. Mine a block so `dev` earns the 50-coin reward:

   ```bash
   curl -X POST -H "Content-Type: application/json" \
     --data '{"address": "dev"}' http://localhost:3001/mineBlock
   ```

2. List unspent outputs and copy the `txOutId` of the note owned by `dev`:

   ```bash
   curl http://localhost:3001/unspentOutputs
   ```

3. Spend 20 of it to `asha`. A second miner address collects the next reward:

   ```bash
   curl -X POST -H "Content-Type: application/json" \
     --data '{"minerAddress":"miner","txOutId":"<ID>","txOutIndex":0,"toAddress":"asha","amount":20}' \
     http://localhost:3001/mineTransaction
   ```

4. Check `/unspentOutputs` again: `asha` has 20, `dev` has 30 change, `miner` has 50, and the original 50-coin note is gone. Node 2 shows the same.

5. Send the same request again: it is rejected, because that note was already spent.

## API

| Method | Endpoint | Body | Description |
|---|---|---|---|
| GET | `/blocks` | none | Returns the whole chain |
| POST | `/mineBlock` | `{ "address": "dev" }` | Mines a block containing only the reward for `address` |
| POST | `/mineTransaction` | `{ "minerAddress", "txOutId", "txOutIndex", "toAddress", "amount" }` | Spends one unspent output and mines it, with the reward, into a block. **Temporary** testing route, replaced by wallets in Step 6 |
| GET | `/unspentOutputs` | none | Lists every unspent output (the "notebook") |
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

- An **output** (`TxOut`) is a note: an `address` (owner) and an `amount`.
- An **input** (`TxIn`) points at a note being spent, by `(txOutId, txOutIndex)`: which transaction created it, and which output inside it.
- A **transaction** spends existing outputs and creates new ones. Total in equals total out; any leftover goes back to the sender as change.
- The **transaction id** is the SHA-256 of its inputs and outputs, so changing any amount or address is detected.
- The **coinbase transaction** is the first transaction in each block. It has one fake input (empty `txOutId`, `txOutIndex` set to the block number so ids stay unique) and creates a fixed 50-coin reward for the miner.
- The **unspent list** holds every output that exists and is not spent. After each block, spent outputs are removed and new ones added.
- A **balance** is the sum of the unspent outputs that belong to an address.

A transaction is valid when:

1. its id matches its contents
2. no input appears twice
3. every output amount is above zero
4. every input points at an existing unspent output
5. total input equals total output

A block's transaction list is valid when the first transaction is a correct coinbase, every other transaction passes the checks above, and no output is spent twice within the block.

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
  transaction.ts   transaction classes, ids, coinbase, unspent updates, transaction and block validation
  p2p.ts           WebSocket server, peer connections, messages, broadcasting
  main.ts          Express HTTP API and startup
```

## What is left

1. **Wallet (Step 6):** key pairs, addresses derived from public keys, signing inputs and verifying signatures, so only the owner can spend an output
2. **Transaction pool (Step 7):** pending transactions waiting to be mined, shared between peers
3. **Polish (Step 8):** balance and address lookup endpoints, tests
4. Possible extra: a separate Next.js frontend that talks to a node over HTTP

## Known limitations

- **No signatures yet:** anyone can spend any output via `/mineTransaction` (fixed by Step 6)
- Transactions cannot be sent to the network on their own yet; they go straight into a mined block (fixed by Step 7)
- The chain, peer list and unspent set are in memory only; a restarted node starts from genesis and re-syncs
- A block cannot spend an output created earlier in the same block
- No reconnection or heartbeat for dropped peer connections
- Work is summed with normal numbers; real systems use `BigInt` for very high difficulty