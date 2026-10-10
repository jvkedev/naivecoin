# Naivecoin (TypeScript)

A small cryptocurrency built from scratch in TypeScript to learn how blockchains work under the hood: hashing, proof of work, peer-to-peer syncing, and the UTXO transaction model. It follows the structure of the [Naivecoin tutorial](https://lhartikk.github.io/), rewritten with current tooling (Node.js, TypeScript strict mode, Express 5, `ws`) and rebuilt step by step.

## The idea of this project

Most people use crypto without knowing how it works. This project answers four questions by building each answer yourself:

1. **How can data be tamper-proof?** Blocks are linked by SHA-256 hashes.
2. **How can strangers agree on one history with no central server?** Nodes talk peer-to-peer and follow the valid chain with the most work.
3. **Why is it expensive to cheat?** Proof of work makes adding a block cost real computation.
4. **How can money exist without a bank?** The UTXO model tracks unspent outputs instead of account balances.

## Progress

| Step | Feature                                                                 | Status                      |
| ---- | ----------------------------------------------------------------------- | --------------------------- |
| 1    | Basic blockchain (blocks, hashing, validation)                          | Done                        |
| 2    | HTTP API (Express)                                                      | Done                        |
| 3    | P2P network (WebSocket sync)                                            | Done                        |
| 4    | Proof of work, difficulty adjustment, total-work rule, timestamp checks | Done                        |
| 5    | Transactions (UTXO model)                                               | **In progress** (about 40%) |
| 6    | Wallet (key pairs and signatures)                                       | Not started                 |
| 7    | Transaction pool                                                        | Not started                 |
| 8    | Polish (balances, address lookup, tests)                                | Not started                 |

### Step 5 breakdown

| Part | What it does                                                                | Status                                                                                    |
| ---- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 5a   | `TxOut`, `TxIn`, `Transaction` classes and `getTransactionId`               | Done                                                                                      |
| 5b   | Coinbase (mining reward) transaction                                        | Done                                                                                      |
| 5c   | `UnspentTxOut` class                                                        | Done                                                                                      |
| 5d   | `updateUnspentTxOuts`: update the unspent list after a block                | Done                                                                                      |
| 5e   | Validate a transaction                                                      | In progress: id check done; inputs-exist check and money-in-equals-money-out check remain |
| 5f   | Validate the coinbase and a block's whole transaction list                  | To do                                                                                     |
| 5g   | Put transactions into blocks (`data: string` becomes `data: Transaction[]`) | To do                                                                                     |
| 5h   | End-to-end test: mine a block, see the reward in the unspent list           | To do                                                                                     |

**Important:** the transaction code lives in `src/transaction.ts` and is **not connected to blocks or the API yet**. Blocks still carry a plain string in `data`. Connecting them is step 5g.

## What works today

- Blocks linked by SHA-256 hashes, with full block and chain validation
- **Proof of work:** each block has a `nonce` and `difficulty`; a block's hash must start with `difficulty` zero bits
- **Difficulty adjustment:** every 5 blocks, difficulty goes up by 1 if the batch was mined in under half the target time, and down by 1 (never below 0) if it took over double. Target: 1 block per 10 seconds
- **Difficulty is enforced:** every node recomputes the required difficulty and rejects blocks that claim a different one, so a miner cannot pick an easy difficulty
- **Most total work wins:** when chains compete, a node follows the chain with the most accumulated work (each block counts as `2^difficulty`), not simply the longest one
- **Timestamp rules:** a block may not be more than 60 seconds older than its parent, or more than 60 seconds ahead of the node's clock
- HTTP API to view the chain, mine blocks and manage peers
- Several nodes connected over WebSockets, staying in sync
- Transaction building blocks: ids, coinbase reward, unspent list updates (in `transaction.ts`, not yet wired in)

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

Connect node 2 to node 1 (using curl, Bruno, or any HTTP client):

```bash
curl -X POST -H "Content-Type: application/json" \
  --data '{"peer": "ws://localhost:6001"}' \
  http://localhost:3002/addPeer
```

Mine a block on node 1, then check node 2:

```bash
curl -X POST -H "Content-Type: application/json" \
  --data '{"data": "hello"}' \
  http://localhost:3001/mineBlock

curl http://localhost:3002/blocks
```

Connections and chains are in memory only: after restarting a node, run `/addPeer` again.

## API

| Method | Endpoint     | Body                              | Description                                                   |
| ------ | ------------ | --------------------------------- | ------------------------------------------------------------- |
| GET    | `/blocks`    | none                              | Returns the whole chain                                       |
| POST   | `/mineBlock` | `{ "data": "text" }`              | Mines a block (proof of work), adds it, announces it to peers |
| POST   | `/addPeer`   | `{ "peer": "ws://host:p2pPort" }` | Connects to another node                                      |
| GET    | `/peers`     | none                              | Lists connected peers                                         |

`/addPeer` takes the other node's **P2P (WebSocket) port**, not its HTTP port.

## How it works

### Blocks

```
Block { index, hash, previousHash, timestamp, data, difficulty, nonce }
```

The hash is `SHA-256(index || previousHash || timestamp || data || difficulty || nonce)`. Every field that must not be altered is part of the hash, so changing any old block changes its hash and breaks the link to the next one.

A block is valid when:

1. its `index` is the previous index + 1
2. its `previousHash` equals the previous block's `hash`
3. its timestamp passes the timestamp rules
4. recomputing its hash gives the stored `hash`
5. its hash has at least `difficulty` leading zero bits
6. its `difficulty` equals what the rules require at that height

### Proof of work

Miners try `nonce = 0, 1, 2, ...` until the hash starts with enough zero bits. Each extra zero bit halves the chance of success, so each +1 difficulty is roughly twice the work. The `nonce` is only the number being varied; the number of tries is a result of luck and difficulty.

### Choosing between chains

A chain is valid when it starts with the known genesis block and every block is valid against the one before it (including its required difficulty). A node replaces its chain only when the received chain is valid **and** has more total work.

### Peer-to-peer messages

| Type                  | Meaning                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| `QUERY_LATEST`        | "Send me your latest block"                                            |
| `QUERY_ALL`           | "Send me your whole chain"                                             |
| `RESPONSE_BLOCKCHAIN` | "Here are blocks" (answer to a query, or an announcement after mining) |

When a node receives blocks, it compares the peer's latest block with its own:

1. Not ahead of me: ignore it (this also stops blocks bouncing between nodes forever).
2. Fits on top of my latest block: validate, add, and tell my other peers.
3. Doesn't fit and only one block was sent: I'm behind by more than one, so ask for the whole chain.
4. Doesn't fit and a whole chain was sent: replace mine only if it is valid and has more work.

Nothing from a peer is trusted; every block and chain is validated first.

### Transactions (UTXO model, in progress)

Instead of account balances, the chain tracks **unspent transaction outputs**, like cash notes:

- An **output** (`TxOut`) is a note: an `address` (owner) and an `amount`.
- An **input** (`TxIn`) points at a note being spent, by `(txOutId, txOutIndex)`: which transaction created it, and which output inside it.
- A **transaction** spends existing outputs and creates new ones. Total in must equal total out; any leftover goes back to the sender as change.
- The **transaction id** is the SHA-256 of its inputs and outputs, so tampering with any amount or address changes the hash and is detected.
- The **coinbase transaction** is the first transaction in each block. It has one fake input (empty `txOutId`, `txOutIndex` set to the block number so ids stay unique) and creates a 50-coin reward for the miner.
- The **unspent list** (`UnspentTxOut[]`) holds every note that exists and is not yet spent. After each block, spent outputs are removed and new ones added. A spent note is gone, so it cannot be spent twice. This is what prevents double spending.
- A wallet's **balance** is the sum of the unspent outputs that belong to its address.

Signatures (proving you own an output) arrive in Step 6, so until then anyone could spend anyone's output.

## Project structure

```
src/
  blockchain.ts    blocks, hashing, proof of work, difficulty, chain validation and selection
  transaction.ts   transaction classes, ids, coinbase, unspent list update (not yet wired into blocks)
  p2p.ts           WebSocket server, peer connections, messages, broadcasting
  main.ts          Express HTTP API and startup
```

## What is left

1. Finish transaction validation: inputs must exist in the unspent list, and total input value must equal total output value (5e)
2. Validate the coinbase and a block's whole transaction list (5f)
3. Store transactions inside blocks and keep the unspent list in sync with the chain (5g, 5h)
4. Wallet: key pairs, addresses, signing and verifying transactions (Step 6)
5. Transaction pool for pending transactions, and mining from it (Step 7)
6. Balance and address lookup endpoints, tests (Step 8)
7. Possible extra: a separate Next.js frontend that talks to a node over HTTP

Roughly: Steps 1 to 4 are complete, Step 5 is partly done, and Steps 6 to 8 are still ahead. About half of the project is finished.

## Known limitations

- The chain, peer list and unspent list are in memory only; a restarted node starts from genesis and re-syncs
- `data` is still a plain string; transactions are not yet part of blocks
- No signatures yet, so ownership of outputs is not enforced
- No reconnection or heartbeat for dropped peer connections
- Work is summed with normal numbers; real systems use `BigInt` for very high difficulty
