import { WebSocketServer, WebSocket } from "ws";
import { getBlockchain, getLatestBlock } from "./blockchain.js";

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

        case MessageType.RESPONSE_BLOCKCHAIN:
          console.log("Received blocks:", message.data);
          break;

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
};

const getPeers = (): string[] => {
  return [...sockets].map(() => "peer");
};

export { initP2PServer, connectToPeer, getPeers, broadcastLatest };
