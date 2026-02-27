'use client';

import { useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { parseEther, isAddress, encodeFunctionData } from 'viem';
import { useSendTransaction } from 'wagmi';

const VAULT_ADDRESS = (
  process.env.NEXT_PUBLIC_VAULT_ADDRESS ?? '0x0000000000000000000000000000000000000000'
) as `0x${string}`;

const VAULT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: '_intendedReceiver', type: 'address' }],
    outputs: [],
  },
] as const;

export interface SuccessData {
  txHash: string;
  receiver: string;
  amount: string;
}

interface DepositFormProps {
  onSuccess: (data: SuccessData) => void;
}

export default function DepositForm({ onSuccess }: DepositFormProps) {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState('');
  const [receiver, setReceiver] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { sendTransactionAsync } = useSendTransaction();

  const validate = useCallback((): string | null => {
    const n = parseFloat(amount);
    if (!amount || isNaN(n) || n <= 0) return 'INVALID AMOUNT';
    if (!receiver) return 'RECEIVER REQUIRED';
    if (!isAddress(receiver)) return 'INVALID ADDRESS';
    if (receiver.toLowerCase() === address?.toLowerCase())
      return 'RECEIVER CANNOT EQUAL SENDER';
    return null;
  }, [amount, receiver, address]);

  const handleDeposit = async () => {
    setError('');
    const err = validate();
    if (err) { setError(err); return; }

    setIsSubmitting(true);
    try {
      const data = encodeFunctionData({
        abi: VAULT_ABI,
        functionName: 'deposit',
        args: [receiver as `0x${string}`],
      });

      const txHash = await sendTransactionAsync({
        to: VAULT_ADDRESS,
        value: parseEther(amount),
        data,
      });

      onSuccess({ txHash, receiver, amount });
      setAmount('');
      setReceiver('');
    } catch (err: any) {
      setError(err?.shortMessage ?? err?.message ?? 'TX FAILED');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <div style={{ padding: '20px 0', color: 'var(--muted)', fontSize: '12px', fontFamily: 'var(--mono)' }}>
        WALLET NOT CONNECTED. CONNECT TO REGISTER INTENT.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Amount */}
      <div>
        <div className="label" style={{ marginBottom: '6px' }}>AMOUNT (BNB)</div>
        <div style={{ display: 'flex' }}>
          <input
            id="bnb-amount"
            type="number"
            min="0"
            step="0.001"
            placeholder="0.0000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
            disabled={isSubmitting}
            style={{ flex: 1 }}
          />
          <div style={{
            display: 'flex', alignItems: 'center', padding: '0 12px',
            border: '1px solid var(--border)', borderLeft: 'none',
            background: '#0a0a0a', fontFamily: 'var(--mono)',
            fontSize: '11px', fontWeight: 700, color: 'var(--accent)'
          }}>
            BNB
          </div>
        </div>
      </div>

      {/* Receiver */}
      <div>
        <div className="label" style={{ marginBottom: '6px' }}>RECEIVER (FRESH ADDR)</div>
        <input
          id="dest-address"
          type="text"
          placeholder="0x..."
          value={receiver}
          onChange={(e) => setReceiver(e.target.value)}
          className="input"
          disabled={isSubmitting}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="err-box">
          ERR: {error}
        </div>
      )}

      {/* CTA */}
      <button
        id="deposit-btn"
        onClick={handleDeposit}
        disabled={isSubmitting}
        className="btn-primary"
        style={{ marginTop: '4px' }}
      >
        {isSubmitting ? (
          <><span className="spin">◌</span> SIGNING TX...</>
        ) : (
          'REGISTER INTENT'
        )}
      </button>

      {/* Info */}
      <div className="info-box">
        Intent enters AI relay pool. Batch executes at 5 intents OR 15s timeout.
        Relayer sponsors gas. On-chain link severed.
      </div>
    </div>
  );
}
