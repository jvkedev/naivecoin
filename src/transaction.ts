import { createHash } from "node:crypto";

// ---------- The shapes of our data ----------

// One note: who owns it and how much it is worth
class TxOut {
  constructor(
    public address: string,
    public amount: number,
  ) {}
}

// A pointer to a note we want to spend
class TxIn {
  constructor(
    public txOutId: string,
    public txOutIndex: number,
  ) {}
}

// One transaction: notes crossed out (txIns) and notes written (txOuts)
class Transaction {
  constructor(
    public id: string,
    public txIns: TxIn[],
    public txOuts: TxOut[],
  ) {}
}

// One line of the notebook: a note that exists and is not spent yet
class UnspentTxOut {
  constructor(
    public readonly txOutId: string,
    public readonly txOutIndex: number,
    public readonly address: string,
    public readonly amount: number,
  ) {}
}

const COINBASE_AMOUNT = 50;

// ---------- Transaction id ----------

const getTransactionId = (transaction: Transaction): string => {
  let txInContent = "";
  for (const txIn of transaction.txIns) {
    txInContent = txInContent + txIn.txOutId + txIn.txOutIndex;
  }

  let txOutContent = "";
  for (const txOut of transaction.txOuts) {
    txOutContent = txOutContent + txOut.address + txOut.amount;
  }

  return createHash("sha256")
    .update(txInContent + txOutContent)
    .digest("hex");
};

const isValidTransactionId = (transaction: Transaction): boolean => {
  return getTransactionId(transaction) === transaction.id;
};

// ---------- Mining reward ----------

const getCoinbaseTransaction = (
  address: string,
  blockIndex: number,
): Transaction => {
  const tx = new Transaction(
    "",
    [new TxIn("", blockIndex)], // fake input: no real note is spent
    [new TxOut(address, COINBASE_AMOUNT)],
  );

  tx.id = getTransactionId(tx);

  return tx;
};

// ---------- The notebook ----------

// Look through the notebook for one note. Returns it, or undefined if not found.
const findUnspentTxOut = (
  txOutId: string,
  txOutIndex: number,
  unspentTxOuts: UnspentTxOut[],
): UnspentTxOut | undefined => {
  for (const unspent of unspentTxOuts) {
    if (unspent.txOutId === txOutId && unspent.txOutIndex === txOutIndex) {
      return unspent;
    }
  }

  return undefined;
};

// Update the notebook after a block: cross out spent notes, write new ones
const updateUnspentTxOuts = (
  newTransactions: Transaction[],
  unspentTxOuts: UnspentTxOut[],
): UnspentTxOut[] => {
  // Step 1: collect every new note written by these transactions
  const newUnspent: UnspentTxOut[] = [];
  for (const tx of newTransactions) {
    for (const [index, txOut] of tx.txOuts.entries()) {
      newUnspent.push(
        new UnspentTxOut(tx.id, index, txOut.address, txOut.amount),
      );
    }
  }

  const remaining: UnspentTxOut[] = [];
  for (const unspent of unspentTxOuts) {
    let isSpent = false;

    for (const tx of newTransactions) {
      for (const txIn of tx.txIns) {
        if (
          txIn.txOutId === unspent.txOutId &&
          txIn.txOutIndex === unspent.txOutIndex
        ) {
          isSpent = true;
        }
      }
    }

    if (!isSpent) {
      remaining.push(unspent);
    }
  }

  // Step 3: old notes that survived + the new notes
  return [...remaining, ...newUnspent];
};

// ---------- Validation ----------

// Every input must point at a note that exists in the notebook
const doInputsExist = (
  transaction: Transaction,
  unspentTxOuts: UnspentTxOut[],
): boolean => {
  for (const txIn of transaction.txIns) {
    const note = findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, unspentTxOuts);
    if (note === undefined) {
      return false;
    }
  }

  return true;
};

export {
  TxOut,
  TxIn,
  Transaction,
  UnspentTxOut,
  COINBASE_AMOUNT,
  getTransactionId,
  isValidTransactionId,
  getCoinbaseTransaction,
  findUnspentTxOut,
  updateUnspentTxOuts,
  doInputsExist,
};
