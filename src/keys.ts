import { createPrivateKey, createPublicKey, sign } from "node:crypto";

const toPrivateKeyObject = (privateKeyHex: string) => {
  return createPrivateKey({
    key: Buffer.from(privateKeyHex, "hex"),
    format: "der",
    type: "pkcs8",
  });
};

const getPublicFromPrivateKey = (privateKeyHex: string): string => {
  const publicKey = createPublicKey(toPrivateKeyObject(privateKeyHex));
  return publicKey.export({ type: "spki", format: "der" }).toString("hex");
};

const signData = (data: string, privateKeyHex: string): string => {
  return sign(
    "sha256",
    Buffer.from(data),
    toPrivateKeyObject(privateKeyHex),
  ).toString("hex");
};

export { getPublicFromPrivateKey, signData };
