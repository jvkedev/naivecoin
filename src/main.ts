import express from "express";
import { getBlockchain, mineBlock } from "./blockchain.js";
import { connectToPeer, getPeers, initP2PServer } from "./p2p.js";

const HTTP_PORT = Number(process.env.HTTP_PORT) || 3001;
const P2P_PORT = Number(process.env.P2P_PORT) || 6001;

const app = express();

app.use(express.json());

app.get("/blocks", (req, res) => {
  res.status(200).json(getBlockchain());
});

app.post("/mineBlock", (req, res) => {
  const data = req.body?.data;

  if (!data || typeof data !== "string") {
    return res.status(400).json({
      message: "Data is missing",
    });
  }

  const block = mineBlock(data);

  if (block === null) {
    return res.status(500).json({
      message: "Could not create block",
    });
  }

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
