import { WebSocketServer, WebSocket } from "ws";

const sockets: WebSocket[] = [];

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

const initConnection = (ws: WebSocket): void => {
  sockets.push(ws);
  console.log("Peer connected");

  ws.on("error", () => console.log("Peer connection error"));

  ws.on("close", () => {
    const index = sockets.indexOf(ws);
    if (index !== -1) sockets.splice(index, 1);
    console.log("Peer disconnected");
  });
};

const getPeers = (): string[] => {
  return sockets.map(() => "peer");
};

export { initP2PServer, connectToPeer, getPeers };
