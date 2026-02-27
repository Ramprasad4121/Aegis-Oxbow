import * as dotenv from "dotenv";
dotenv.config();

function requireEnv(name: string, fallback?: string): string {
  const val = process.env[name] ?? fallback;
  if (!val) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

export const config = {
  /** Ethereum-compatible RPC endpoint (BSC Testnet / opBNB / local hardhat) */
  rpcUrl: requireEnv("RPC_URL", "http://localhost:8545"),

  /** Private key for the relayer wallet (must match AegisVault.relayer) */
  relayerPrivateKey: requireEnv(
    "RELAYER_PRIVATE_KEY",
    // Hardhat default account #1 — NEVER use in production
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
  ),

  /** Deployed AegisVault contract address */
  vaultAddress: requireEnv("VAULT_ADDRESS", "0x0000000000000000000000000000000000000000"),

  /** HTTP port for the status API */
  port: parseInt(process.env.PORT ?? "4000", 10),

  /** Trigger batch when this many intents are pooled */
  batchSizeThreshold: parseInt(process.env.BATCH_SIZE_THRESHOLD ?? "5", 10),

  /** Trigger batch after this many milliseconds regardless of pool size */
  batchTimeoutMs: parseInt(process.env.BATCH_TIMEOUT_MS ?? "15000", 10),

  /** Block number to start listening from (0 = latest) */
  startBlock: parseInt(process.env.START_BLOCK ?? "0", 10),

  /** CORS origin for the frontend */
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
};
