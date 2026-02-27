import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { AegisRelayer } from "./relayer";
import { ethers } from "ethers";

export function createServer(relayerInstance: AegisRelayer): express.Application {
  const app = express();

  app.use(cors({ origin: "*" }));
  app.use(express.json());

  // ── Health check ──────────────────────────────────────────────────────────
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // ── Main status endpoint (polled by frontend) ─────────────────────────────
  /**
   * GET /api/status
   * Returns current relayer state for the UI dashboard.
   */
  app.get("/api/status", (_req: Request, res: Response) => {
    const state = relayerInstance.getStatus();
    const poolSize = state.pooledIntents.length;
    const threshold = state.batchSizeThreshold;
    const firstIntent = state.pooledIntents[0];
    const aiState = state.aiState;

    res.json({
      // Core status
      status: state.status,
      pooledIntents: poolSize,
      batchSizeThreshold: threshold,
      aiReady: aiState.isReady,
      currentGasGwei: aiState.currentGasGwei,
      aiConfidence: aiState.confidenceScore,

      // Summary strings for UI
      summary:
        state.status === "EXECUTING"
          ? "🚀 Executing batch transaction..."
          : state.status === "ERROR"
          ? "❌ Batch execution failed. Retrying..."
          : poolSize === 0
          ? "⏳ Waiting for intents..."
          : `💡 ${poolSize}/${threshold} intents pooled — AI Gas Confidence: ${(aiState.confidenceScore * 100).toFixed(1)}%`,

      // Intent details
      intents: state.pooledIntents.map((i) => ({
        intentIndex: i.intentIndex,
        sender: i.sender,
        receiver: i.receiver,
        amount: ethers.formatEther(i.amount),
        amountWei: i.amount.toString(),
        receivedAt: i.receivedAt,
        txHash: i.txHash,
        blockNumber: i.blockNumber,
      })),

      // Last batch result
      lastBatch: state.lastBatch,

      // Global stats
      stats: {
        totalBatchesExecuted: state.totalBatchesExecuted,
        totalIntentsProcessed: state.totalIntentsProcessed,
        uptimeSec: state.uptime,
      },
    });
  });

  // ── Simulate intent submission (for demo / testing without MetaMask) ──────
  /**
   * POST /api/simulate-intent
   * Body: { sender, receiver, amount (in ether) }
   * Injects a fake intent directly into the pool for UI demo purposes.
   */
  app.post("/api/simulate-intent", (req: Request, res: Response) => {
    const { sender, receiver, amount } = req.body as {
      sender?: string;
      receiver?: string;
      amount?: string;
    };

    if (!receiver || !amount) {
      res.status(400).json({ error: "receiver and amount are required" });
      return;
    }

    const state = relayerInstance.getStatus();

    relayerInstance.handleIntent({
      sender: sender ?? "0xDEMO000000000000000000000000000000000001",
      receiver: receiver,
      amount: ethers.parseEther(amount),
      intentIndex: state.totalIntentsProcessed + state.pooledIntents.length,
      receivedAt: Date.now(),
      txHash: "0x" + "0".repeat(64),
      blockNumber: 0,
    });

    res.json({ ok: true, message: "Intent injected into pool" });
  });

  // ── 404 catch-all ─────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  // ── Error handler ─────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
