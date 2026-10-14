import {
  validateTransaction,
  type Transaction,
  type UnspentTxOut,
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

export { getTransactionPool, addToTransactionPool };
