import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { getPublicFromPrivateKey } from "./keys.js";
import {
  Transaction,
  TxIn,
  TxOut,
  getTransactionId,
  signTxIn,
  type UnspentTxOut,
} from "./transaction.js";

const HTTP_PORT = process.env.HTTP_PORT || 3001;
const WALLET_FOLDER = "wallet";
const PRIVATE_KEY_FILE = `${WALLET_FOLDER}/private_key_${HTTP_PORT}`;

const generatePrivateKey = (): string => {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "secp256k1" });
  return privateKey.export({ type: "pkcs8", format: "der" }).toString("hex");
};

const initWallet = (): void => {
  if (existsSync(PRIVATE_KEY_FILE)) {
    return;
  }

  mkdirSync(WALLET_FOLDER, { recursive: true });
  writeFileSync(PRIVATE_KEY_FILE, generatePrivateKey());
  console.log("New wallet created");
};

const getPrivateKeyFromWallet = (): string => {
  return readFileSync(PRIVATE_KEY_FILE, "utf-8").trim();
};

const getPublicFromWallet = (): string => {
  return getPublicFromPrivateKey(getPrivateKeyFromWallet());
};

const getBalance = (address: string, unspentTxOuts: UnspentTxOut[]): number => {
  let total = 0;
  for (const note of unspentTxOuts) {
    if (note.address === address) {
      total = total + note.amount;
    }
  }

  return total;
};

const findOwnNotes = (
  address: string,
  unspentTxOuts: UnspentTxOut[],
): UnspentTxOut[] => {
  const own: UnspentTxOut[] = [];
  for (const note of unspentTxOuts) {
    if (note.address === address) {
      own.push(note);
    }
  }

  return own;
};

const pickNotesForAmount = (
  amount: number,
  ownNotes: UnspentTxOut[],
): { picked: UnspentTxOut[]; total: number } => {
  const picked: UnspentTxOut[] = [];
  let total = 0;

  for (const note of ownNotes) {
    picked.push(note);

    total = total + note.amount;

    if (total >= amount) {
      return { picked, total };
    }
  }

  throw new Error("Not enough coins");
};

const createTransaction = (
  receiverAddress: string,
  amount: number,
  privateKey: string,
  unspentTxOuts: UnspentTxOut[],
): Transaction => {
  if (amount <= 0) {
    throw new Error("Amount must be above zero");
  }

  const myAddress = getPublicFromPrivateKey(privateKey);

  const ownNotes = findOwnNotes(myAddress, unspentTxOuts);
  const { picked, total } = pickNotesForAmount(amount, ownNotes);

  const txIns: TxIn[] = [];
  for (const note of picked) {
    txIns.push(new TxIn(note.txOutId, note.txOutIndex));
  }

  const txOuts: TxOut[] = [new TxOut(receiverAddress, amount)];
  const change = total - amount;
  if (change > 0) {
    txOuts.push(new TxOut(myAddress, change));
  }

  const tx = new Transaction("", txIns, txOuts);
  tx.id = getTransactionId(tx);

  for (const [index, txIn] of tx.txIns.entries()) {
    txIn.signature = signTxIn(tx, index, privateKey, unspentTxOuts);
  }

  return tx;
};

export {
  initWallet,
  getPrivateKeyFromWallet,
  getPublicFromWallet,
  getBalance,
  createTransaction,
};
