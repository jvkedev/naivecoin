import express from "express";
import {
  getBlockchain,
  getLatestBlock,
  getUnspentTxOuts,
  mineBlock,
} from "./blockchain.js";
import {
  broadcastLatest,
  connectToPeer,
  getPeers,
  initP2PServer,
} from "./p2p.js";
import { getCoinbaseTransaction } from "./transaction.js";
import {
  createTransaction,
  getBalance,
  getPrivateKeyFromWallet,
  getPublicFromWallet,
  initWallet,
} from "./wallet.js";

const HTTP_PORT = Number(process.env.HTTP_PORT) || 3001;
const P2P_PORT = Number(process.env.P2P_PORT) || 6001;

initWallet();
const app = express();

app.use(express.json());

app.get("/blocks", (req, res) => {
  res.status(200).json(getBlockchain());
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

app.get("/unspentOutputs", (req, res) => {
  res.status(200).json(getUnspentTxOuts());
});

app.get("/address", (req, res) => {
  return res.status(200).json({ address: getPublicFromWallet() });
});

app.get("/balance", (req, res) => {
  const balance = getBalance(getPublicFromWallet(), getUnspentTxOuts());
  return res.status(200).json({ balance });
});

app.post("/mineBlock", (req, res) => {
  const nextIndex = getLatestBlock().index + 1;
  const coinbase = getCoinbaseTransaction(getPublicFromWallet(), nextIndex);

  const block = mineBlock([coinbase]);

  if (block === null) {
    return res.status(500).json({
      message: "Could not create block",
    });
  }

  broadcastLatest();
  return res.status(201).json(block);
});

app.post("/mineTransaction", (req, res) => {
  const address = req.body?.address;
  const amount = req.body?.amount;

  if (typeof address !== "string" || typeof amount !== "number") {
    return res.status(400).json({
      message: "Need an address (text) and an amount (number)",
    });
  }

  try {
    const tx = createTransaction(
      address,
      amount,
      getPrivateKeyFromWallet(),
      getUnspentTxOuts(),
    );

    const nextIndex = getLatestBlock().index + 1;
    const coinbase = getCoinbaseTransaction(getPublicFromWallet(), nextIndex);

    const block = mineBlock([coinbase, tx]);
    if (block === null) {
      return res.status(400).json({ message: "Block was rejected" });
    }

    broadcastLatest();
    return res.status(201).json(block);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong";
    return res.status(400).json({
      message,
    });
  }
});

app.listen(HTTP_PORT, () => {
  console.log(`HTTP listening on http://localhost:${HTTP_PORT}`);
});

initP2PServer(P2P_PORT);
