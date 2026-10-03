import CryptoJS from "crypto-js";

class Block {
  constructor(
    public index: number,
    public hash: string,
    public previousHash: string,
    public timestamp: number,
    public data: string,
  ) {}
}

const calculateHash = (
  index: number,
  previousHash: string,
  timestamp: number,
  data: string,
): string => {
  const separator = "||";
  const combinedString = `${index}${separator}${previousHash}${separator}${timestamp}${separator}${data}`;

  const hash = CryptoJS.SHA256(combinedString);

  return hash.toString(CryptoJS.enc.Hex); // Hexadecimal
};

const genesisTimestamp = 1465154705;

const genesisBlock = new Block(
  0,
  calculateHash(0, "", genesisTimestamp, "my genesis block"),
  "",
  genesisTimestamp,
  "my genesis block",
);

let blockchain: Block[] = [genesisBlock];

const getLatestBlock = (): Block => {
  const latest = blockchain[blockchain.length - 1];

  if (latest === undefined) {
    throw new Error("Blockchain is empty");
  }

  return latest;
};

const generateNextBlock = (data: string): Block => {
  const latestBlock = getLatestBlock();

  const nextIndex = latestBlock.index + 1;

  const timestamp = Math.floor(Date.now() / 1000);

  const hash = calculateHash(nextIndex, latestBlock.hash, timestamp, data);

  const newBlock = new Block(
    nextIndex,
    hash,
    latestBlock.hash,
    timestamp,
    data,
  );

  return newBlock;
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
    ) !== newBlock.hash
  )
    return false;

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
  if (isValidChain(newChain)) return false;
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
