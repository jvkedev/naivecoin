import { createHash } from "node:crypto";

class Block {
  constructor(
    public index: number,
    public hash: string,
    public previousHash: string,
    public timestamp: number,
    public data: string,
    public difficulty: number,
    public nonce: number,
  ) {}
}

const calculateHash = (
  index: number,
  previousHash: string,
  timestamp: number,
  data: string,
  difficulty: number,
  nonce: number,
): string => {
  const combined = `${index}||${previousHash}||${timestamp}||${data}||${difficulty}||${nonce}`;

  return createHash("sha256").update(combined).digest("hex");
};

const hashMatchedDifficulty = (hash: string, difficulty: number): boolean => {
  const binaryHash = BigInt("0x" + hash)
    .toString(2)
    .padStart(256, "0");

  return binaryHash.startsWith("0".repeat(difficulty));
};

const findBlock = (
  index: number,
  previousHash: string,
  timestamp: number,
  data: string,
  difficulty: number,
): Block => {
  let nonce = 0;

  while (true) {
    const hash = calculateHash(
      index,
      previousHash,
      timestamp,
      data,
      difficulty,
      nonce,
    );

    if (hashMatchedDifficulty(hash, difficulty)) {
      return new Block(
        index,
        hash,
        previousHash,
        timestamp,
        data,
        difficulty,
        nonce,
      );
    }

    nonce++;
  }
};

const genesisTimestamp = 1465154705;

const genesisBlock = new Block(
  0,
  calculateHash(0, "", genesisTimestamp, "my genesis block", 0, 0),
  "",
  genesisTimestamp,
  "my genesis block",
  0,
  0,
);

let blockchain: Block[] = [genesisBlock];

const getLatestBlock = (): Block => {
  const latest = blockchain[blockchain.length - 1];

  if (latest === undefined) {
    throw new Error("Blockchain is empty");
  }

  return latest;
};

const getDifficulty = (): number => 4;

const generateNextBlock = (data: string): Block => {
  const latestBlock = getLatestBlock();
  const nextIndex = latestBlock.index + 1;
  const timestamp = Math.floor(Date.now() / 1000);

  return findBlock(
    nextIndex,
    latestBlock.hash,
    timestamp,
    data,
    getDifficulty(),
  );
};

const isValidBlock = (newBlock: Block, previousBlock: Block): boolean => {
  if (newBlock.index !== previousBlock.index + 1) return false;
  if (newBlock.previousHash !== previousBlock.hash) return false;
  if (
    calculateHash(
      newBlock.index,
      newBlock.previousHash,
      newBlock.timestamp,
      newBlock.data,
      newBlock.difficulty,
      newBlock.nonce,
    ) !== newBlock.hash
  )
    return false;

  if (!hashMatchedDifficulty(newBlock.hash, newBlock.difficulty)) return false;

  return true;
};

const isValidChain = (chain: Block[]): boolean => {
  const first = chain[0];

  if (first === undefined) return false;

  if (first.hash !== genesisBlock.hash) return false;

  for (let i = 1; i < chain.length; i++) {
    const current = chain[i];
    const previous = chain[i - 1];

    if (current === undefined || previous === undefined) return false;

    if (!isValidBlock(current, previous)) return false;
  }

  return true;
};

const addBlock = (newBlock: Block): boolean => {
  if (isValidBlock(newBlock, getLatestBlock())) {
    blockchain.push(newBlock);
    return true;
  }

  return false;
};

const mineBlock = (data: string): Block | null => {
  const block = generateNextBlock(data);

  if (!addBlock(block)) return null;

  return block;
};

const getBlockchain = (): Block[] => blockchain;

const replaceChain = (newChain: Block[]): boolean => {
  if (!isValidChain(newChain)) return false;
  if (newChain.length <= blockchain.length) return false;

  blockchain = newChain;

  return true;
};

export {
  Block,
  getBlockchain,
  getLatestBlock,
  generateNextBlock,
  addBlock,
  isValidChain,
  mineBlock,
  replaceChain,
};
