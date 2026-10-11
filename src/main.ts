import express from "express";
import { getBlockchain, getLatestBlock, mineBlock } from "./blockchain.js";
import {
  broadcastLatest,
  connectToPeer,
  getPeers,
  initP2PServer,
} from "./p2p.js";
import { getCoinbaseTransaction } from "./transaction.js";

const HTTP_PORT = Number(process.env.HTTP_PORT) || 3001;
const P2P_PORT = Number(process.env.P2P_PORT) || 6001;

const app = express();

app.use(express.json());

app.get("/blocks", (req, res) => {
  res.status(200).json(getBlockchain());
});

app.post("/mineBlock", (req, res) => {
  const address = req.body?.address;

  if (!address || typeof address !== "string") {
    return res.status(400).json({
      message: "Address is missing",
    });
  }

  const nextIndex = getLatestBlock().index + 1;
  const coinbase = getCoinbaseTransaction(address, nextIndex);

  const block = mineBlock([coinbase]);

  if (block === null) {
    return res.status(500).json({
      message: "Could not create block",
    });
  }

  broadcastLatest();

  return res.status(201).json(block);
});

app.post("/addPeer", (req, res) => {
  const peer = req.body?.peer;

  if (!peer || typeof peer !== "string") {
    return res.status(400).json({
      message: "Peer is missing",
    });
  }

  connectToPeer(peer);
  return res.status(200).json({
    message: "Connecting to peer",
  });
});

app.get("/peers", (req, res) => {
  return res.status(200).json(getPeers());
});

app.listen(HTTP_PORT, () => {
  console.log(`HTTP listening on http://localhost:${HTTP_PORT}`);
});

initP2PServer(P2P_PORT);
