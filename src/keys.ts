import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { buffer } from "node:stream/consumers";

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

const verifySignature = (
  data: string,
  signatureHex: string,
  publicKeyHex: string,
): boolean => {
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(publicKeyHex, "hex"),
      format: "der",
      type: "spki",
    });

    return verify(
      "sha256",
      Buffer.from(data),
      publicKey,
      Buffer.from(signatureHex, "hex"),
    );
  } catch {
    return false;
  }
};

export { getPublicFromPrivateKey, signData, verifySignature };
