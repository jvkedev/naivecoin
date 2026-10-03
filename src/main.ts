import express from "express";
import { blockchain, mineBlock } from "./blockchain.js";

const PORT = 3001;

const app = express();

app.use(express.json());

app.get("/blocks", (req, res) => {
  res.status(200).json(blockchain);
});

app.post("/mineBlock", (req, res) => {
  const data = req.body?.data;

  if (!data || typeof data !== "string") {
    return res.status(400).json({
      messsage: "Data is missing",
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

app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
