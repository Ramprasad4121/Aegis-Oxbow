import { AegisRelayer } from "./relayer";
import { createServer } from "./server";
import { config } from "./config";

async function main(): Promise<void> {
  console.log("══════════════════════════════════════════════════");
  console.log("  🛡️  Aegis-Oxbow AI Relayer — Starting Up");
  console.log("══════════════════════════════════════════════════");

  const relayer = new AegisRelayer();

  // Start event listener
  await relayer.start();

  // Start HTTP server
  const app = createServer(relayer);
  const server = app.listen(config.port, () => {
    console.log(`🌐 Status API listening on http://localhost:${config.port}`);
    console.log(`   GET  /health          — Health check`);
    console.log(`   GET  /api/status      — Live relayer state`);
    console.log(`   POST /api/simulate-intent — Demo: inject mock intent`);
    console.log("══════════════════════════════════════════════════\n");
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    await relayer.stop();
    server.close(() => {
      console.log("✅ Server closed.");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
