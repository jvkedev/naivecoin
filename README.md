# Naivecoin (TypeScript)

A small blockchain with a peer-to-peer network, built from scratch in TypeScript to learn how cryptocurrencies work under the hood. Based on the structure of the [Naivecoin tutorial](https://lhartikk.github.io/), rewritten with current versions of Node.js, TypeScript, Express 5 and `ws`.

## What it does

- Creates blocks that are linked together by hashes (SHA-256)
- Validates blocks and whole chains, so any tampering is detected
- Exposes an HTTP API to view the chain, mine blocks and manage peers
- Connects several nodes over WebSockets and keeps their chains in sync

## Status

| Feature | Status |
|---|---|
| Blocks, hashing, validation | Done |
| HTTP API | Done |
| P2P network and chain sync | Done |
| Proof of work and difficulty | Planned |
| Transactions (UTXO model) | Planned |
| Wallet (keys and signatures) | Planned |
| Transaction pool | Planned |

## Tech stack

- TypeScript, run with [`tsx`](https://github.com/privatenumber/tsx)
- Express 5 for the HTTP API
- [`ws`](https://github.com/websockets/ws) for WebSocket peer connections
- `crypto-js` for SHA-256

## Getting started

```bash
git clone https://github.com/jvkedev/naivecoin.git
cd naivecoin
npm install
```

Run one node:

```bash
npm run dev
```

By default a node uses HTTP port `3001` and P2P port `6001`.

### Run two nodes

Each node needs its own ports. In two separate terminals:

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

Mine a block on node 1 and check that node 2 received it:

```bash
curl -X POST -H "Content-Type: application/json" \
  --data '{"data": "hello"}' \
  http://localhost:3001/mineBlock

curl http://localhost:3002/blocks
```

## API

| Method | Endpoint | Body | Description |
|---|---|---|---|
| GET | `/blocks` | none | Returns the whole chain |
| POST | `/mineBlock` | `{ "data": "text" }` | Creates a block, adds it and announces it to peers |
| POST | `/addPeer` | `{ "peer": "ws://host:p2pPort" }` | Connects this node to another node |
| GET | `/peers` | none | Lists connected peers |

`/addPeer` takes the other node's **P2P (WebSocket) port**, not its HTTP port.

## How it works

### Blocks and validation

Every block stores its `index`, `timestamp`, `data`, its own `hash` and the `previousHash`. The hash is computed from the other fields, so changing any old block changes its hash and breaks the link to the next block.

A block is valid when:

1. its `index` is the previous index + 1
2. its `previousHash` equals the previous block's `hash`
3. recomputing its hash gives the stored `hash`

A chain is valid when it starts with the known genesis block and every block is valid against the one before it.

### Peer-to-peer messages

Nodes talk over WebSocket using three message types:

| Type | Meaning |
|---|---|
| `QUERY_LATEST` | "Send me your latest block" |
| `QUERY_ALL` | "Send me your whole chain" |
| `RESPONSE_BLOCKCHAIN` | "Here are blocks" (answer to either query, or an announcement after mining) |

When two nodes connect, each asks the other for its latest block. When a node mines a block, it broadcasts it to all peers.

### Syncing: longest valid chain wins

When a node receives blocks, it compares the peer's latest block with its own:

1. **Not ahead of me:** ignore it. This also stops blocks bouncing between nodes forever.
2. **Fits right on top of my latest block:** validate and add it, then tell my other peers.
3. **Doesn't fit, and only one block was sent:** I'm behind by more than one block, so ask for the whole chain.
4. **Doesn't fit, and a whole chain was sent:** replace my chain only if the received chain is valid and longer.

Nothing from a peer is trusted. Every block and chain is validated before it is used.

## Project structure

```
src/
  blockchain.ts   blocks, hashing, validation, chain replacement
  p2p.ts          WebSocket server, peer connections, messages, broadcasting
  main.ts         Express HTTP API and startup
```

## Known limitations

- The chain is kept in memory only, so a restarted node starts from the genesis block and re-syncs from its peers
- No proof of work yet, so any node can add blocks instantly
- No reconnection or heartbeat for dropped peer connections
- `data` is a plain string until transactions are added

## What's next

1. Proof of work and difficulty adjustment
2. Transactions using the UTXO model
3. Wallets with key pairs and signed transactions
4. Transaction pool for pending transactions
