import { createHash } from "node:crypto";

const BLOCK_GENERATION_INTERVAL = 10;
const DIFFICULTY_ADJUSTMENT_INTERVAL = 5;

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

/*
 * Converts the hash from hexadecimal into binary.
 * Checks if the number of leading zeros matches the required difficulty.
 */
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

const genesisTimestamp = 1767225600;

const genesisBlock = new Block(
  0,
  calculateHash(0, "", genesisTimestamp, "my genesis block", 4, 0),
  "",
  genesisTimestamp,
  "my genesis block",
  4,
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

/*
 * If blocks are mined too quickly (less than half the expected time),
 * increase the difficulty by 1.
 * If blocks are mined too slowly (more than twice the expected time),
 * decrease the difficulty by 1, but never below 0.
 */
const getAdjustedDifficulty = (chain: Block[], latest: Block): number => {
  const prevAdjustmentBlock =
    chain[chain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];

  if (prevAdjustmentBlock === undefined) return latest.difficulty;

  const timeExpected =
    BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
  const timetaken = latest.timestamp - prevAdjustmentBlock.timestamp;

  if (timetaken < timeExpected / 2) return latest.difficulty + 1;
  if (timetaken > timeExpected * 2) return Math.max(0, latest.difficulty - 1);

  return latest.difficulty;
};

const getDifficulty = (chain: Block[]): number => {
  const latest = chain[chain.length - 1];
  if (latest === undefined) throw new Error("Blockchain is empty");

  if (
    latest.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 &&
    latest.index !== 0
  ) {
    return getAdjustedDifficulty(chain, latest);
  }

  return latest.difficulty;
};

const generateNextBlock = (data: string): Block => {
  const latestBlock = getLatestBlock();
  const nextIndex = latestBlock.index + 1;
  const timestamp = Math.floor(Date.now() / 1000);

  return findBlock(
    nextIndex,
    latestBlock.hash,
    timestamp,
    data,
    getDifficulty(blockchain),
  );
};

const isValidTimestamp = (newBlock: Block, previousBlock: Block): boolean => {
  const now = Math.floor(Date.now() / 1000);
  return (
    previousBlock.timestamp - 60 < newBlock.timestamp &&
    newBlock.timestamp - 60 < now
  );
};

const isValidBlock = (newBlock: Block, previousBlock: Block): boolean => {
  if (newBlock.index !== previousBlock.index + 1) return false;
  if (newBlock.previousHash !== previousBlock.hash) return false;
  if (!isValidTimestamp(newBlock, previousBlock)) return false;
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
    if (current.difficulty !== getDifficulty(chain.slice(0, i))) return false;
  }

  return true;
};

const addBlock = (newBlock: Block): boolean => {
  if (!isValidBlock(newBlock, getLatestBlock())) return false;

  if (newBlock.difficulty !== getDifficulty(blockchain)) return false;

  blockchain.push(newBlock);
  return true;
};

const mineBlock = (data: string): Block | null => {
  const block = generateNextBlock(data);

  if (!addBlock(block)) return null;

  return block;
};

const getBlockchain = (): Block[] => blockchain;

const getTotalWork = (chain: Block[]): number => {
  let total = 0;
  for (const block of chain) {
    total += 2 ** block.difficulty;
  }

  return total;
};

const replaceChain = (newChain: Block[]): boolean => {
  if (!isValidChain(newChain)) return false;
  if (getTotalWork(newChain) <= getTotalWork(blockchain)) return false;

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
