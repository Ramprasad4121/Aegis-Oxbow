'use client';

import { useState, useEffect, useCallback } from 'react';

const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL ?? 'http://localhost:4000';

interface RelayerStatus {
  status: 'IDLE' | 'POOLING' | 'EXECUTING' | 'EXECUTED' | 'ERROR';
  pooledIntents: number;
  batchSizeThreshold: number;
  aiReady: boolean;
  currentGasGwei: string;
  aiConfidence: number;
  summary: string;
  lastBatch: {
    txHash: string | null;
    batchSize: number;
    totalValue: string;
    executedAt: number | null;
  };
  stats: {
    totalBatchesExecuted: number;
    totalIntentsProcessed: number;
    uptimeSec: number;
  };
  intents: Array<{
    intentIndex: number;
    sender: string;
    receiver: string;
    amount: string;
    txHash: string;
  }>;
}

function StatusTag({ status }: { status: RelayerStatus['status'] }) {
  const map: Record<string, string> = {
    IDLE: 'tag-idle',
    POOLING: 'tag-pooling',
    EXECUTING: 'tag-exec',
    EXECUTED: 'tag-ok',
    ERROR: 'tag-err',
  };
  const dots: Record<string, string> = {
    IDLE: '○',
    POOLING: '◉',
    EXECUTING: '◎',
    EXECUTED: '●',
    ERROR: '✕',
  };
  return (
    <span className={`tag ${map[status] ?? 'tag-idle'}`}>
      <span>{dots[status] ?? '○'}</span>
      {status}
    </span>
  );
}

function fmt(addr: string): string {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function fmtUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function LiveNetworkStatus() {
  const [data, setData] = useState<RelayerStatus | null>(null);
  const [offline, setOffline] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`${RELAYER_URL}/api/status`);
      if (!res.ok) throw new Error();
      const json: RelayerStatus = await res.json();
      setData(json);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [poll]);

  const pct = data ? (data.pooledIntents / data.batchSizeThreshold) * 100 : 0;
  const aiPct = data ? data.aiConfidence * 100 : 0;

  /* ── Offline ─────────────────────────────────────────────────────────────── */
  if (offline) {
    return (
      <section className="panel" style={{ padding: '14px' }}>
        <div className="section-title">RELAY STATUS</div>
        <div className="err-box" style={{ fontSize: '11px' }}>
          RPC ERROR — RELAYER OFFLINE ({RELAYER_URL})
        </div>
      </section>
    );
  }

  /* ── Loading ─────────────────────────────────────────────────────────────── */
  if (!data) {
    return (
      <section className="panel" style={{ padding: '14px' }}>
        <div className="section-title">RELAY STATUS</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--muted)' }} className="cursor">
          CONNECTING
        </div>
      </section>
    );
  }

  const poolStr = `${data.pooledIntents}/${data.batchSizeThreshold}`;

  /* ── Active ──────────────────────────────────────────────────────────────── */
  return (
    <section className="panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="section-title" style={{ borderBottom: 'none', marginBottom: 0 }}>
          RELAY STATUS
        </div>
        <StatusTag status={data.status} />
      </div>
      <div style={{ borderBottom: '1px solid var(--border)' }} />

      {/* Intent pool fill */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
          <span className="label">INTENT POOL</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: 700, color: pct >= 100 ? 'var(--accent)' : 'var(--text)' }}>
            {poolStr}
          </span>
        </div>
        <div className="progress-track" style={{ marginBottom: '12px' }}>
          <div className="progress-fill" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>

        {/* AI Confidence Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
          <span className="label" style={{ color: 'var(--ok)' }}>AI GAS CONFIDENCE</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: 700, color: aiPct >= 70 ? 'var(--ok)' : 'var(--text)' }}>
            {data.aiReady ? `${aiPct.toFixed(1)}%` : 'TRAINING...'}
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${Math.min(100, aiPct)}%`, background: aiPct >= 70 ? 'var(--ok)' : 'var(--muted)' }} />
          {/* 70% Marker */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '70%', width: '2px', background: 'var(--border)' }} />
        </div>


        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--muted)' }}>
            {data.summary.toUpperCase()}
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--accent)', fontWeight: 700 }}>
             {data.currentGasGwei} GWEI
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div>
        <div className="data-row">
          <span className="k">BATCHES EXECUTED</span>
          <span className="v" style={{ color: 'var(--accent)' }}>{data.stats.totalBatchesExecuted}</span>
        </div>
        <div className="data-row">
          <span className="k">INTENTS PROCESSED</span>
          <span className="v">{data.stats.totalIntentsProcessed}</span>
        </div>
        <div className="data-row">
          <span className="k">UPTIME</span>
          <span className="v">{fmtUptime(data.stats.uptimeSec)}</span>
        </div>
        <div className="data-row">
          <span className="k">EXECUTION TRIGGER</span>
          <span className="v">{data.batchSizeThreshold} INTENTS OR AI CONFIDENCE {">"} 70%</span>
        </div>
        <div className="data-row">
          <span className="k">VAULT</span>
          <span className="v" style={{ color: 'var(--muted)', fontSize: '11px' }}>
            {fmt(process.env.NEXT_PUBLIC_VAULT_ADDRESS ?? '0x0000000000000000000000000000000000000000')}
          </span>
        </div>
      </div>

      {/* Pooled intents */}
      {data.intents.length > 0 && (
        <div>
          <div className="label" style={{ marginBottom: '8px' }}>POOLED INTENTS</div>
          {data.intents.map((intent) => (
            <div key={intent.intentIndex} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', borderBottom: '1px solid var(--border)',
              fontFamily: 'var(--mono)', fontSize: '11px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ color: 'var(--muted)' }}>#{intent.intentIndex}</span>
                <span style={{ color: 'var(--dim)', fontSize: '10px' }}>{fmt(intent.receiver)}</span>
              </div>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{intent.amount} BNB</span>
            </div>
          ))}
        </div>
      )}

      {/* Last batch */}
      {data.lastBatch.txHash && (
        <div>
          <div className="label" style={{ marginBottom: '8px' }}>LAST BATCH</div>
          <div className="data-row">
            <span className="k">SIZE</span>
            <span className="v">{data.lastBatch.batchSize}</span>
          </div>
          <div className="data-row">
            <span className="k">VALUE</span>
            <span className="v" style={{ color: 'var(--accent)' }}>{data.lastBatch.totalValue} BNB</span>
          </div>
          <div className="data-row" style={{ alignItems: 'center' }}>
            <span className="k">TX</span>
            <a
              href={`https://testnet.bscscan.com/tx/${data.lastBatch.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--accent)', textDecoration: 'none' }}
            >
              {data.lastBatch.txHash.slice(0, 14)}…{data.lastBatch.txHash.slice(-8)} ↗
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
