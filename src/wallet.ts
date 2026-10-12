import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { getPublicFromPrivateKey } from "./keys.js";

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

export { initWallet, getPrivateKeyFromWallet, getPublicFromWallet };
