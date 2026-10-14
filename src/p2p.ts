import { WebSocketServer, WebSocket } from "ws";
import {
  type Block,
  addBlock,
  getBlockchain,
  getLatestBlock,
  getUnspentTxOuts,
  replaceChain,
} from "./blockchain.js";
import { addToTransactionPool, getTransactionPool } from "./transactionPool.js";
import type { Transaction } from "./transaction.js";

const sockets = new Set<WebSocket>();

const initP2PServer = (p2pPort: number): void => {
  const server = new WebSocketServer({ port: p2pPort });
  server.on("connection", (ws) => initConnection(ws));
  console.log(`P2P listening on port ${p2pPort}`);
};

const connectToPeer = (peerUrl: string): void => {
  try {
    const ws = new WebSocket(peerUrl);
    ws.on("open", () => initConnection(ws));
    ws.on("error", () => console.log(`Connection failed: ${peerUrl}`));
  } catch {
    console.log(`Invalid peer URL: ${peerUrl}`);
  }
};

enum MessageType {
  QUERY_LATEST = 0,
  QUERY_ALL = 1,
  RESPONSE_BLOCKCHAIN = 2,
  QUERY_TRANSACTION_POOL,
  RESPONSE_TRANSACTION_POOL,
}

interface Message {
  type: MessageType;
  data: string | null;
}

const send = (ws: WebSocket, message: Message): void => {
  ws.send(JSON.stringify(message));
};

const broadcast = (message: Message): void => {
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      send(socket, message);
    }
  }
};

const broadcastLatest = (): void => {
  broadcast({
    type: MessageType.RESPONSE_BLOCKCHAIN,
    data: JSON.stringify([getLatestBlock()]),
  });
};

const broadcastTransactionPool = (): void => {
  broadcast({
    type: MessageType.RESPONSE_TRANSACTION_POOL,
    data: JSON.stringify(getTransactionPool()),
  });
};

const handleBlockchainResponse = (received: Block[], ws: WebSocket): void => {
  const theirs = received[received.length - 1];
  if (theirs === undefined) return;

  const mine = getLatestBlock();

  if (theirs.index <= mine.index) return;

  if (theirs.previousHash === mine.hash) {
    if (addBlock(theirs)) broadcastLatest();
  } else if (received.length === 1) {
    send(ws, {
      type: MessageType.QUERY_ALL,
      data: null,
    });
  } else {
    if (replaceChain(received)) broadcastLatest();
  }
};

const initMessageHandler = (ws: WebSocket): void => {
  ws.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      console.log("received message type:", message.type);

      switch (message.type) {
        case MessageType.QUERY_LATEST:
          send(ws, {
            type: MessageType.RESPONSE_BLOCKCHAIN,
            data: JSON.stringify([getLatestBlock()]),
          });
          break;

        case MessageType.QUERY_ALL:
          send(ws, {
            type: MessageType.RESPONSE_BLOCKCHAIN,
            data: JSON.stringify(getBlockchain()),
          });
          break;

        case MessageType.RESPONSE_BLOCKCHAIN: {
          const received = JSON.parse(message.data);
          if (!Array.isArray(received)) break;
          handleBlockchainResponse(received, ws);
          break;
        }

        case MessageType.QUERY_TRANSACTION_POOL: {
          send(ws, {
            type: MessageType.RESPONSE_TRANSACTION_POOL,
            data: JSON.stringify(getTransactionPool()),
          });
          break;
        }

        case MessageType.RESPONSE_TRANSACTION_POOL: {
          let received: Transaction[];
          try {
            received = JSON.parse(message.data);
          } catch {
            break;
          }

          if (!Array.isArray(received)) break;

          let addedSomething = false;

          for (const tx of received) {
            if (addToTransactionPool(tx, getUnspentTxOuts())) {
              addedSomething = true;
            }
          }

          if (addedSomething) {
            broadcastTransactionPool();
          }

          break;
        }

        default:
          console.log("Unknown message type");
      }
    } catch {
      console.log("Bad message");
    }
  });
};

const initConnection = (ws: WebSocket): void => {
  sockets.add(ws);
  console.log("Peer connected");

  ws.on("error", () => console.log("Peer connection error"));

  ws.on("close", () => {
    sockets.delete(ws);
    console.log("Peer disconnected");
  });

  initMessageHandler(ws);
  send(ws, { type: MessageType.QUERY_LATEST, data: null });
  send(ws, { type: MessageType.QUERY_TRANSACTION_POOL, data: null });
};

const getPeers = (): string[] => {
  return [...sockets].map(() => "peer");
};

export {
  initP2PServer,
  connectToPeer,
  getPeers,
  broadcastLatest,
  broadcastTransactionPool,
};
