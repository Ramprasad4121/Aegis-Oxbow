import { ethers } from "ethers";
import { config } from "./config";
import { AEGIS_VAULT_ABI } from "./abi";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Intent {
  sender: string;
  receiver: string;
  amount: bigint;
  intentIndex: number;
  receivedAt: number;
  txHash: string;
  blockNumber: number;
}

export type BatchStatus =
  | "IDLE"
  | "POOLING"
  | "EXECUTING"
  | "EXECUTED"
  | "ERROR";

export interface RelayerState {
  status: BatchStatus;
  pooledIntents: Intent[];
  batchSizeThreshold: number;
  lastBatch: {
    txHash: string | null;
    batchSize: number;
    totalValue: string;
    executedAt: number | null;
  };
  aiState: {
    isReady: boolean;
    currentGasGwei: string;
    confidenceScore: number;
    threshold: number;
  };
  totalBatchesExecuted: number;
  totalIntentsProcessed: number;
  uptime: number; // seconds since start
  startedAt: number;
}

import { AIGasPredictor } from "./GasPredictor";

// ─────────────────────────────────────────────────────────────────────────────
// AI Relayer — Core Batching Engine
// ─────────────────────────────────────────────────────────────────────────────

export class AegisRelayer {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private vault: ethers.Contract;
  private gasAI: AIGasPredictor;

  private intentPool: Intent[] = [];
  private isExecuting = false;
  private startedAt = Date.now();

  private currentGasGwei = "0.0";
  private currentAiScore = 0.0;

  public state: RelayerState = {
    status: "IDLE",
    pooledIntents: [],
    batchSizeThreshold: config.batchSizeThreshold,
    lastBatch: {
      txHash: null,
      batchSize: 0,
      totalValue: "0",
      executedAt: null,
    },
    aiState: {
      isReady: false,
      currentGasGwei: "0.0",
      confidenceScore: 0,
      threshold: 0.7,
    },
    totalBatchesExecuted: 0,
    totalIntentsProcessed: 0,
    uptime: 0,
    startedAt: Date.now(),
  };

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.relayerPrivateKey, this.provider);
    this.vault = new ethers.Contract(
      config.vaultAddress,
      AEGIS_VAULT_ABI,
      this.wallet
    );
    this.gasAI = new AIGasPredictor();

    console.log(`🤖 AegisRelayer AI initializing...`);
    console.log(`   RPC:     ${config.rpcUrl}`);
    console.log(`   Vault:   ${config.vaultAddress}`);
    console.log(`   Relayer: ${this.wallet.address}`);
    console.log(`   Batch threshold: ${config.batchSizeThreshold} intents OR Neural Net Gas > 0.7 score`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Startup
  // ──────────────────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    // Verify relayer is authorized
    try {
      const onChainRelayer: string = await (this.vault as any).relayer();
      if (onChainRelayer.toLowerCase() !== this.wallet.address.toLowerCase()) {
        console.warn(
          `⚠️  WARNING: This wallet (${this.wallet.address}) is NOT the authorized relayer (${onChainRelayer}).`
        );
        console.warn("   executeBatch() calls will revert on-chain!");
      } else {
        console.log(`✅ Relayer wallet matches on-chain relayer.`);
      }
    } catch {
      console.warn("⚠️  Could not verify on-chain relayer (contract may not be deployed locally).");
    }

    console.log(`\n👂 Listening for IntentRegistered events...`);
    this.vault.on(
      "IntentRegistered",
      (sender, receiver, amount, intentIndex, event) => {
        this.handleIntent({
          sender,
          receiver,
          amount: BigInt(amount),
          intentIndex: Number(intentIndex),
          receivedAt: Date.now(),
          txHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber,
        });
      }
    );

    console.log(`\n🧠 AI listening for new blocks to train on historical gas data...`);
    this.provider.on("block", async (blockNumber) => {
      try {
        const blockObj = await this.provider.getBlock(blockNumber);
        if (blockObj?.baseFeePerGas) {
          const baseFee = blockObj.baseFeePerGas;
          this.currentGasGwei = parseFloat(ethers.formatUnits(baseFee, "gwei")).toFixed(2);
          
          this.gasAI.addBlockDataAndTrain(baseFee);
          
          const [executeAI, score] = this.gasAI.shouldExecuteBatch(baseFee);
          this.currentAiScore = score;
          
          if (this.gasAI.isReady) {
            console.log(`[Block ${blockNumber}] AI Gas: ${this.currentGasGwei} Gwei | Confidence: ${(score * 100).toFixed(1)}%`);
            
            // Trigger 2: AI determines gas is optimal and we have something to execute
            if (executeAI && this.intentPool.length > 0) {
              console.log(`🧠 AI TRIGGER: Confidence ${(score * 100).toFixed(1)}% > 70%. Optimum gas window found. Executing ${this.intentPool.length} intent(s).`);
              this.executeBatch();
            }
          } else {
             console.log(`[Block ${blockNumber}] AI training on new gas point... ${this.currentGasGwei} Gwei`);
          }
        }
      } catch (e) {
        console.error("AI block listener error:", e);
      }
    });

    this.state.status = "POOLING";
    console.log("✅ Relayer started and waiting for intents...\n");
  }

  async stop(): Promise<void> {
    this.vault.removeAllListeners();
    this.provider.removeAllListeners("block");
    console.log("🛑 Relayer stopped.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Intent Handling — AI Logic
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Called for every new IntentRegistered event. 
   * Implements the AI batching heuristic:
   *   1. Add to pool
   *   2. If pool reaches MAX threshold (5) → execute immediately (override AI)
   */
  handleIntent(intent: Intent): void {
    this.intentPool.push(intent);
    this.syncState();

    console.log(
      `📥 Intent #${intent.intentIndex} received | Pool: ${this.intentPool.length}/${config.batchSizeThreshold}` +
        ` | From: ${intent.sender.slice(0, 8)}... → ${intent.receiver.slice(0, 8)}...` +
        ` | Amount: ${ethers.formatEther(intent.amount)} BNB`
    );

    // ── Trigger 1: Pool is full (hard override of AI for max latency) ──────
    if (this.intentPool.length >= config.batchSizeThreshold) {
      console.log(`🎯 Pool max capacity reached (${this.intentPool.length}). Triggering batch immediately!`);
      this.executeBatch();
      return;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Batch Execution
  // ──────────────────────────────────────────────────────────────────────────

  private async executeBatch(): Promise<void> {
    if (this.isExecuting || this.intentPool.length === 0) return;

    this.isExecuting = true;
    this.state.status = "EXECUTING";

    // Drain pool atomically (prevent double-spend)
    const batch = this.intentPool.splice(0, this.intentPool.length);
    this.syncState();

    const receivers = batch.map((i) => i.receiver);
    const amounts = batch.map((i) => i.amount);
    const totalValue = amounts.reduce((acc, v) => acc + v, 0n);

    console.log(`\n🚀 ─── EXECUTING BATCH ─────────────────────────────────`);
    console.log(`   Batch size:  ${batch.length} intents`);
    console.log(`   Total value: ${ethers.formatEther(totalValue)} BNB`);
    console.log(`   Receivers:   ${receivers.map((r) => r.slice(0, 10) + "...").join(", ")}`);

    try {
      // Check vault has enough balance
      const vaultBal: bigint = await (this.vault as any).vaultBalance();
      if (vaultBal < totalValue) {
        throw new Error(
          `Vault balance (${ethers.formatEther(vaultBal)} BNB) < batch total (${ethers.formatEther(totalValue)} BNB)`
        );
      }

      // Estimate gas and bump by 20% for safety
      const gasEstimate = await (this.vault as any).executeBatch.estimateGas(receivers, amounts);
      const gasLimit = (gasEstimate * 120n) / 100n;

      const tx = await (this.vault as any).executeBatch(receivers, amounts, { gasLimit });
      console.log(`   📡 TX submitted: ${tx.hash}`);

      const receipt = await tx.wait(1);
      console.log(`   ✅ TX confirmed in block ${receipt.blockNumber} | Gas used: ${receipt.gasUsed}`);
      console.log(`─────────────────────────────────────────────────────────\n`);

      // Update state
      this.state.lastBatch = {
        txHash: tx.hash,
        batchSize: batch.length,
        totalValue: ethers.formatEther(totalValue),
        executedAt: Date.now(),
      };
      this.state.totalBatchesExecuted++;
      this.state.totalIntentsProcessed += batch.length;
      this.state.status = this.intentPool.length > 0 ? "POOLING" : "IDLE";
    } catch (err: any) {
      console.error(`   ❌ Batch execution FAILED:`, err.message ?? err);
      // Return intents to pool for retry
      this.intentPool.unshift(...batch);
      this.state.status = "ERROR";
    } finally {
      this.isExecuting = false;
      this.syncState();
      // Schedule restart if intents are waiting, but wait 10s to avoid spamming the RPC
      if (this.intentPool.length > 0) {
        setTimeout(() => {
           this.isExecuting = false;
        }, 10000);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  private syncState(): void {
    this.state.pooledIntents = [...this.intentPool];
    this.state.aiState = {
      isReady: this.gasAI.isReady,
      currentGasGwei: this.currentGasGwei,
      confidenceScore: this.currentAiScore,
      threshold: 0.7,
    };
    this.state.uptime = Math.floor((Date.now() - this.startedAt) / 1000);
    if (this.state.status !== "EXECUTING" && this.state.status !== "ERROR") {
      this.state.status = this.intentPool.length > 0 ? "POOLING" : "IDLE";
    }
  }

  getStatus(): RelayerState {
    this.syncState();
    return { ...this.state };
  }
}
