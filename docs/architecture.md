# Aegis-Oxbow Architecture

## Overview

Aegis-Oxbow is a KYC-compliant, privacy-preserving gas relayer that breaks on-chain transaction links through AI-driven batch execution.

## Component Diagram

```
┌──────────────────────────────────────────────────────────┐
│                     User Browser                          │
│   ┌─────────────────────────────────────────────────┐    │
│   │  Next.js Frontend (port 3000)                   │    │
│   │  - Deposit Form (wagmi + viem)                  │    │
│   │  - Live Network Status (polls /api/status)      │    │
│   └────────────────────┬────────────────────────────┘    │
└────────────────────────┼─────────────────────────────────┘
                         │ sendTransaction
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   BNB Chain (Testnet)                     │
│   ┌──────────────────────────────────────────────────┐   │
│   │  AegisVault.sol                                  │   │
│   │  - deposit(receiver) → emits IntentRegistered    │   │
│   │  - executeBatch(receivers, amounts)              │   │
│   │  - ReentrancyGuard, Ownable (OpenZeppelin)       │   │
│   └───────┬──────────────────────────────────────────┘   │
└───────────┼─────────────────────────────────────────────┘
            │  event IntentRegistered
            ▼
┌─────────────────────────────────────────────────────────┐
│                AI Relayer Backend (port 4000)             │
│   ┌──────────────────────────────────────────────────┐   │
│   │  AegisRelayer (relayer.ts)                       │   │
│   │  - ethers.js event listener                      │   │
│   │  - In-memory intent pool                         │   │
│   │  - Dual-trigger batch logic:                     │   │
│   │    • Pool size ≥ 5 → immediate batch             │   │
│   │    • 15s timeout → batch whatever is pooled      │   │
│   │  - Signs & submits executeBatch()                │   │
│   │  - Acts as Paymaster (pays gas)                  │   │
│   └──────────────────────────────────────────────────┘   │
│   ┌──────────────────────────────────────────────────┐   │
│   │  Express API (server.ts)                         │   │
│   │  GET  /health                                    │   │
│   │  GET  /api/status → poolSize, lastBatch, stats   │   │
│   │  POST /api/simulate-intent → demo endpoint       │   │
│   └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Security Model

| Property | Implementation |
|---|---|
| Reentrancy protection | OpenZeppelin `ReentrancyGuard` on all state-changing fns |
| Access control | `onlyRelayer` modifier (separate key from admin) |
| Input validation | Custom errors, zero-address & zero-amount checks |
| Balance accounting | Pre-flight totalRequired check before batch execution |
| KYC compliance | Deposits only from connected (KYC-able) wallets |
| Privacy | Batch groups unrelated deposits; no direct sender→receiver link |

## Data Flow — Intent Lifecycle

```
┌─────────┐     deposit()      ┌──────────────┐    IntentRegistered    ┌────────────┐
│  User   │──────────────────→ │  AegisVault  │──────────────────────→ │  Relayer   │
│  Wallet │                    │   (on-chain) │                        │  (off-chain│
└─────────┘                    └──────────────┘                        └─────┬──────┘
                                                                             │
                                                                 Pool intent │
                                                              (batch trigger)│
                                                                             ▼
┌──────────────┐    executeBatch()    ┌──────────────┐     Transfer BNB    ┌──────────────┐
│  Fresh       │ ←───────────────────  │  AegisVault  │ ←─────────────────  │  Relayer     │
│  Wallet(s)   │                      │   (on-chain) │                      │  (pays gas)  │
└──────────────┘                      └──────────────┘                      └──────────────┘
```

## TPS Multiplication Effect

- Without Aegis: N users = N transactions on-chain
- With Aegis: N users (up to `BATCH_SIZE_THRESHOLD`) = **1 transaction on-chain**
- Effective TPS multiplier: up to **BATCH_SIZE_THRESHOLD × base-TPS** = 100× with threshold=100
