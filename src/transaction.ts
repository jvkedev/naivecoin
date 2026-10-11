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

// Add up the value of every note this transaction crosses out
const getTotalInputAmount = (
  transaction: Transaction,
  unspentTxOuts: UnspentTxOut[],
): number => {
  let total = 0;
  for (const txIn of transaction.txIns) {
    const note = findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, unspentTxOuts);
    if (note !== undefined) {
      total = total + note.amount;
    }
  }

  return total;
};

// Add up the value of every new note this transaction writes
const getTotalOutputAmount = (transaction: Transaction): number => {
  let total = 0;
  for (const txOut of transaction.txOuts) {
    total = total + txOut.amount;
  }

  return total;
};

// Money in must equal money out
const isAmountBalanced = (
  transaction: Transaction,
  UnspentTxOuts: UnspentTxOut[],
): boolean => {
  const totalIn = getTotalInputAmount(transaction, UnspentTxOuts);
  const totalOut = getTotalOutputAmount(transaction);

  return totalIn === totalOut;
};

// The same note must not appear twice in the inputs
const hasDuplicateInputs = (transaction: Transaction): boolean => {
  const seen: string[] = [];

  for (const txIn of transaction.txIns) {
    const key = txIn.txOutId + ":" + txIn.txOutIndex;

    if (seen.includes(key)) {
      return true;
    }
    seen.push(key);
  }

  return false;
};

// Every new note must be worth more than zero
const hasValidOutputAmounts = (transaction: Transaction): boolean => {
  for (const txOut of transaction.txOuts) {
    if (txOut.amount <= 0) {
      return false;
    }
  }

  return true;
};

// The full checklist for a normal (non-coinbase) transaction
const validateTransaction = (
  transaction: Transaction,
  unspentTxOuts: UnspentTxOut[],
): boolean => {
  if (!isValidTransactionId(transaction)) return false;
  if (hasDuplicateInputs(transaction)) return false;
  if (!hasValidOutputAmounts(transaction)) return false;
  if (!doInputsExist(transaction, unspentTxOuts)) return false;
  if (!isAmountBalanced(transaction, unspentTxOuts)) return false;

  return true;
};

const validateCoinbaseTransaction = (
  transaction: Transaction,
  blockIndex: number,
): boolean => {
  if (!isValidTransactionId(transaction)) return false;

  if (transaction.txIns.length !== 1) return false;
  if (transaction.txOuts.length !== 1) return false;

  const txIn = transaction.txIns[0];
  const txOut = transaction.txOuts[0];
  if (txIn === undefined || txOut === undefined) return false;

  if (txIn.txOutId !== "") return false;

  if (txIn.txOutIndex !== blockIndex) return false;

  if (txOut.amount !== COINBASE_AMOUNT) return false;

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
  isAmountBalanced,
  validateTransaction,
  validateCoinbaseTransaction,
};
