import { createHash } from "node:crypto";

class TxOut {
  constructor(
    public address: string,
    public amount: number,
  ) {}
}

class TxIn {
  constructor(
    public txOutId: string,
    public txOutIndex: number,
  ) {}
}

class Transaction {
  constructor(
    public id: string,
    public txIns: TxIn[],
    public txOuts: TxOut[],
  ) {}
}

const getTransactionId = (transaction: Transaction): string => {
  const txInContent = transaction.txIns
    .map((txIn) => txIn.txOutId + txIn.txOutIndex)
    .join("");

  const txOutContent = transaction.txOuts
    .map((txOut) => txOut.address + txOut.amount)
    .join("");

  return createHash("sha256")
    .update(txInContent + txOutContent)
    .digest("hex");
};

export { TxOut, TxIn, Transaction, getTransactionId };
