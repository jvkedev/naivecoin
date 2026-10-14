import { Transaction } from "./transaction.js";

let transactionPool: Transaction[] = [];

const getTransactionPool = (): Transaction[] => {
  return transactionPool;
};

const addToTransactionPool = (transaction: Transaction): void => {
  transactionPool.push(transaction);
};

export { getTransactionPool, addToTransactionPool };
