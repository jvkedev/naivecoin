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

const COIN_BASE_AMOUNT = 50;

const getCoinbaseTransaction = (
  address: string,
  blockIndex: number,
): Transaction => {
  const tx = new Transaction(
    "",
    [new TxIn("", blockIndex)],
    [new TxOut(address, COIN_BASE_AMOUNT)],
  );

  tx.id = getTransactionId(tx);

  return tx;
};

class UnspentTxOut {
  constructor(
    public readonly txOutId: string,
    public readonly txOutIndex: number,
    public readonly address: string,
    public readonly amount: number,
  ) {}
}

const updateUnspentTxOuts = (
  newTransactions: Transaction[],
  UnspentTxOuts: UnspentTxOut[],
): UnspentTxOut[] => {
  const newUnspent: UnspentTxOut[] = newTransactions.flatMap((tx) =>
    tx.txOuts.map(
      (txOut, index) =>
        new UnspentTxOut(tx.id, index, txOut.address, txOut.amount),
    ),
  );

  const consumed: UnspentTxOut[] = newTransactions
    .flatMap((tx) => tx.txIns)
    .map((txIn) => new UnspentTxOut(txIn.txOutId, txIn.txOutIndex, "", 0));

  const remaining = UnspentTxOuts.filter(
    (u) =>
      !consumed.some(
        (c) => c.txOutId === u.txOutId && c.txOutIndex === u.txOutIndex,
      ),
  );

  return [...remaining, ...newUnspent];
};

const isValidTransactionId = (transaction: Transaction): boolean => {
  return getTransactionId(transaction) === transaction.id;
};

export {
  TxOut,
  TxIn,
  Transaction,
  getTransactionId,
  getCoinbaseTransaction,
  UnspentTxOut,
  updateUnspentTxOuts,
  isValidTransactionId,
};
