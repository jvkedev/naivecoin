import {
  doInputsExist,
  Transaction,
  UnspentTxOut,
  validateTransaction,
} from "./transaction.js";

let transactionPool: Transaction[] = [];

const getTransactionPool = (): Transaction[] => {
  return transactionPool;
};

const hasConflictWithPool = (transaction: Transaction): boolean => {
  for (const poolTx of transactionPool) {
    for (const poolIn of poolTx.txIns) {
      for (const newIn of transaction.txIns) {
        if (
          poolIn.txOutId === newIn.txOutId &&
          poolIn.txOutIndex === newIn.txOutIndex
        ) {
          return true;
        }
      }
    }
  }

  return false;
};

const addToTransactionPool = (
  transaction: Transaction,
  unspentTxOut: UnspentTxOut[],
): boolean => {
  if (!validateTransaction(transaction, unspentTxOut)) return false;
  if (hasConflictWithPool(transaction)) return false;

  transactionPool.push(transaction);
  return true;
};

const updateTransactionPool = (unspentTxOut: UnspentTxOut[]): void => {
  const stillValid: Transaction[] = [];

  for (const tx of transactionPool) {
    if (doInputsExist(tx, unspentTxOut)) {
      stillValid.push(tx);
    }
  }

  transactionPool = stillValid;
};

export { getTransactionPool, addToTransactionPool, updateTransactionPool };
