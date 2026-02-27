'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import DepositForm, { SuccessData } from '@/components/DepositForm';
import LiveNetworkStatus from '@/components/LiveNetworkStatus';

function SuccessPanel({ data, onDismiss }: { data: SuccessData; onDismiss: () => void }) {
  return (
    <div className="ok-box" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em' }}>
          TX SIGNED — INTENT REGISTERED
        </span>
        <button onClick={onDismiss} className="btn-ghost" style={{ color: 'var(--ok)', borderColor: 'var(--ok)' }}>
          DISMISS
        </button>
      </div>
      <div className="data-row" style={{ borderColor: 'rgba(34,197,94,0.2)' }}>
        <span className="k">AMOUNT</span>
        <span className="v">{data.amount} BNB</span>
      </div>
      <div className="data-row" style={{ borderColor: 'rgba(34,197,94,0.2)' }}>
        <span className="k">RECEIVER</span>
        <span className="v" style={{ fontSize: '11px' }}>{data.receiver.slice(0,12)}…{data.receiver.slice(-8)}</span>
      </div>
      <div className="data-row" style={{ borderBottom: 'none', borderColor: 'rgba(34,197,94,0.2)' }}>
        <span className="k">TX</span>
        <a
          href={`https://testnet.bscscan.com/tx/${data.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--ok)', textDecoration: 'none' }}
        >
          {data.txHash.slice(0,14)}…{data.txHash.slice(-8)} ↗
        </a>
      </div>
    </div>
  );
}

export default function Home() {
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: '44px',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 50,
        background: '#000',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '13px', color: 'var(--accent)' }}>
            AEGIS-OXBOW
          </span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: '10px', fontWeight: 700,
            color: 'var(--muted)', border: '1px solid var(--border)', padding: '1px 6px'
          }}>
            BSC TESTNET
          </span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--dim)'
          }}>
            v1.0.0
          </span>
        </div>
        <ConnectButton showBalance={false} chainStatus="none" label="CONNECT WALLET" />
      </header>

      {/* ── Main panel ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '32px 24px 64px' }}>
        <div style={{ width: '100%', maxWidth: '900px' }}>

          {/* System info bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 0', marginBottom: '24px',
            borderBottom: '1px solid var(--border)'
          }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted)' }}>
              PRIVACY-PRESERVING AI GAS RELAYER // BATCH MODE: 5 INTENTS | 15s TIMEOUT
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--dim)' }}>
              TRACK: PRIVACY SOLUTIONS
            </div>
          </div>

          {/* Two-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)' }}>

            {/* ── LEFT: Deposit ──────────────────────────────────────────── */}
            <div style={{ background: '#000', padding: '20px' }}>
              <div className="section-title">DEPOSIT // REGISTER INTENT</div>
              {successData ? (
                <SuccessPanel data={successData} onDismiss={() => setSuccessData(null)} />
              ) : (
                <DepositForm onSuccess={setSuccessData} />
              )}
            </div>

            {/* ── RIGHT: Live status ─────────────────────────────────────── */}
            <div style={{ background: '#000', padding: '20px' }}>
              <LiveNetworkStatus />
            </div>
          </div>

          {/* Bottom: protocol summary */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '1px', background: 'var(--border)',
            marginTop: '1px'
          }}>
            {[
              ['01', 'DEPOSIT', 'User calls AegisVault.deposit(receiver)'],
              ['02', 'POOL', 'Intent added to off-chain relay pool'],
              ['03', 'BATCH TRIGGER', '5 intents OR 15s elapsed'],
              ['04', 'EXECUTE BATCH', 'Relayer signs executeBatch(), pays gas'],
              ['05', 'SETTLE', 'BNB lands in unlinked receiver wallets'],
            ].map(([n, title, desc]) => (
              <div key={n} style={{ background: '#000', padding: '14px 12px' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--accent)', fontWeight: 700, marginBottom: '4px' }}>
                  {n}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px', letterSpacing: '0.04em' }}>
                  {title}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.5 }}>
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--border)', padding: '10px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--dim)' }}>
          AEGIS-OXBOW // BNB CHAIN x YZI LABS HACKATHON 2025
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--dim)' }}>
          MIT LICENSE // OPEN SOURCE
        </span>
      </footer>
    </main>
  );
}
