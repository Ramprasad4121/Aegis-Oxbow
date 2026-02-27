# Aegis-Oxbow Implementation Summary

This document outlines the complete implementation of **Aegis-Oxbow**, an AI-Powered, Privacy-Preserving Gas Relayer for BNB Chain. 

The project addresses BSC's TPS bottleneck and privacy gaps by pooling user intents and executing them in compressed batches to fresh wallets, breaking the on-chain link between sender and receiver.

## 1. Smart Contracts (Foundry)
**Path:** `src/contracts/`

The core contract is `AegisVault.sol`, a privacy-preserving vault that holds deposited BNB and manages withdrawal intents.

**Key Features Implemented:**
- **Controlled Access:** Uses `Ownable` for admin functions and strictly restricts batch execution to an authorized `relayer` address.
- **Security:** Implements `ReentrancyGuard` on all state-changing functions.
- **Deposit Flow (`deposit`):** 
  - Allows KYC'd users to deposit BNB and specify a fresh destination address (`_intendedReceiver`).
  - Emits an `IntentRegistered` event (containing sender, receiver, amount, and an incrementing `intentIndex`) to notify the off-chain relayer.
- **Batch Execution Flow (`executeBatch`):**
  - Callable *only* by the AI Relayer.
  - Takes arrays of `receivers` and `amounts`.
  - Performs pre-flight checks (array length matching, zero addresses, sufficient vault balance).
  - Iterates through the arrays, transferring BNB to each fresh wallet via `.call{value: amounts[i]}("")`.
  - Emits a `BatchExecuted` event.
- **Gas Optimization:** Uses custom errors (`ZeroAmount()`, `ArrayLengthMismatch()`, `OnlyRelayer()`, etc.) instead of revert strings.
- **Admin Functions:** `setRelayer` to update the operating AI agent, and `emergencyWithdraw` to rescue funds if necessary.

## 2. AI Relayer Builder (Node.js/TypeScript)
**Path:** `src/relayer/`

The Relayer is the core off-chain engine that listens to the vault, intelligently batches user intents, and pays the gas for the final execution.

**Key Features Implemented:**
- **Ethers.js Integration (`relayer.ts`):** Connects to the RPC and listens for the `IntentRegistered` event emitted by the `AegisVault`.
- **Dual-Trigger Batching Heuristic:**
  - **Size Trigger:** If the pool size reaches a configured threshold (e.g., `5` intents), it executes immediately to maximize blockspace efficiency.
  - **Time Trigger:** When the *first* intent enters an empty pool, a countdown timer starts (e.g., `15 seconds`). If the timer expires before the size threshold is met, it executes whatever is in the pool to minimize user latency.
- **Robust Execution:**
  - Prevents race conditions and double-spends by atomically splicing the intent pool before execution.
  - Pre-calculates required vault balance to prevent reverting transactions.
  - Estimates gas dynamically and bumps it by 20% for safety before submitting `executeBatch` to the network.
  - Handles execution failures by returning intents to the pool and retrying.
- **Express API (`server.ts`):** Provides an API for the frontend to poll live status.
  - `GET /api/status`: Returns comprehensive relayer state (IDLE/POOLING/EXECUTING, pool size, timers, total executed batches, etc.).
  - `POST /api/simulate-intent`: Exposes an endpoint to inject fake intents directly into the pool for demonstration purposes without needing MetaMask.

## 3. Frontend (Next.js Application)
**Path:** `src/frontend/`

A modern, terminal-inspired frontend built with Next.js App Router, Wagmi, and RainbowKit.

**Key Features Implemented:**
- **Aesthetic:** Minimalistic, utilitarian, brutalist UI with a single accent color (BNB Yellow), strict typography, and sharp corners.
- **Wallet Connection:** Integrated with Wagmi/RainbowKit to connect to the local Anvil node (or BSC testnet).
- **Deposit Form Component:** 
  - Allows users to input an amount and a destination address.
  - Validates inputs and interacts with the `AegisVault` via Wagmi's `useWriteContract` to trigger the `deposit` function.
- **Live Status Polling (`LiveNetworkStatus.tsx`):**
  - Continuously polls the relayer's `/api/status` endpoint.
  - Dynamically displays the current Intent Pool size (e.g., `1/5`), Relay Status (`IDLE`, `POOLING`, `EXECUTING`), and countdown timers.
- **Execution Visualization:** Displays real-time updates when the AI Relayer triggers a batch and settles the transactions. 

## Summary of the Full Flow
1. **User (KYC'd)** connects to the frontend and deposits BNB, specifying a fresh, unlinked receiver address.
2. The **AegisVault Smart Contract** locks the funds and emits an `IntentRegistered` event.
3. The **AI Relayer** catches the event, adds the intent to its off-chain pool, and evaluates its constraints (5 intents max or 15s max).
4. Once a threshold is met, the **AI Relayer** triggers `executeBatch`, paying the gas fees itself.
5. The **Smart Contract** executes the batch, distributing the pooled BNB to the fresh receiver wallets in a single transaction.
6. The **Frontend** updates seamlessly, reflecting the successful transfer and the broken on-chain link. 
