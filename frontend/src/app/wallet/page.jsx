'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TopUpModal from '@/components/TopUpModal';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function WalletPage() {
  const { authFetch, isLoggedIn, walletBalance, lockedBalance, availableBalance, fetchBalance, user } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNote, setWithdrawNote] = useState('');
  const [payMethod, setPayMethod] = useState('');
  const [payDetails, setPayDetails] = useState({});
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [withdrawStep, setWithdrawStep] = useState(1); // 1=amount, 2=method+details
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [lockedRewards, setLockedRewards] = useState([]);
  const [minWithdraw, setMinWithdraw] = useState(0);

  const flash = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  };

  const refreshWallet = async () => {
    try {
      const data = await authFetch('/wallet');
      setTransactions(data.transactions || []);
      setLockedRewards(data.lockedRewards || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return; }
    (async () => {
      await Promise.all([refreshWallet(), fetchBalance()]);
      setLoading(false);
    })();
  }, [isLoggedIn]);

  // Load admin-configured minimum withdrawal amount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/settings/public`);
        const data = await res.json();
        setMinWithdraw(Number(data.minWithdrawalAmount) || 0);
      } catch { /* ignore — backend still enforces the minimum */ }
    })();
  }, []);

  // Auto-refresh when the earliest lock expires
  useEffect(() => {
    if (lockedRewards.length === 0) return;
    const earliest = Math.min(...lockedRewards.map(lr => new Date(lr.lockedUntil).getTime()));
    const delay = Math.max(0, earliest - Date.now()) + 1500;
    const timer = setTimeout(() => { refreshWallet(); fetchBalance(); }, delay);
    return () => clearTimeout(timer);
  }, [lockedRewards]);

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const amt = Number(withdrawAmount);
    if (!amt || amt <= 0) { flash('Enter a valid amount', 'error'); return; }
    if (amt > availableBalance) { flash('Insufficient available balance', 'error'); return; }
    if (!payMethod) { flash('Select a payment method', 'error'); return; }

    // Validate required fields per method
    if (payMethod === 'bank') {
      if (!payDetails.bankName || !payDetails.accountNumber || !payDetails.accountTitle) {
        flash('Fill all bank details', 'error'); return;
      }
    } else if (payMethod === 'easypaisa' || payMethod === 'jazzcash') {
      if (!payDetails.accountTitle || !payDetails.phoneNumber) {
        flash('Fill account holder name and phone number', 'error'); return;
      }
    }

    setSubmitting(true);
    try {
      const data = await authFetch('/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          note: withdrawNote,
          paymentMethod: { method: payMethod, ...payDetails },
        }),
      });
      if (data.message) flash(data.message);
      else flash('Withdrawal requested');
      setWithdrawAmount('');
      setWithdrawNote('');
      setPayMethod('');
      setPayDetails({});
      setWithdrawStep(1);
      setShowWithdraw(false);
      fetchBalance();
      await refreshWallet();
    } catch (err) {
      flash(err.message || 'Failed', 'error');
    }
    setSubmitting(false);
  };

  if (!isLoggedIn) {
    return (
      <div className="bg-grid relative" style={{ minHeight: 'calc(100vh - 64px)' }}>
        <div className="relative z-10 flex items-center justify-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
          <div className="glass-card p-8 text-center" style={{ maxWidth: 400 }}>
            <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>🔒</span>
            <p className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Login Required</p>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Sign in to access your wallet</p>
            <Link href="/login" className="btn-neon btn-neon-primary text-sm" style={{ textDecoration: 'none' }}>Log In</Link>
          </div>
        </div>
      </div>
    );
  }

  // Hide locked rewards from main transaction list while they're locked
  const lockedIds = new Set(lockedRewards.map(lr => lr._id));
  const visibleTransactions = transactions.filter(t => !lockedIds.has(t._id));

  // Below admin-set minimum withdrawal balance?
  const belowMin = minWithdraw > 0 && availableBalance < minWithdraw;
  const minProgress = belowMin ? Math.min(100, Math.round((Math.max(0, availableBalance) / minWithdraw) * 100)) : 100;

  const typeConfig = {
    credit: { icon: '💰', color: '#00ff88', label: 'Credit', sign: '+' },
    debit: { icon: '📤', color: '#ff5c8a', label: 'Debit', sign: '-' },
    withdrawal: { icon: '🏦', color: '#ff5c8a', label: 'Withdraw', sign: '-' },
  };

  const statusColors = {
    completed: { bg: 'rgba(0,255,136,0.1)', color: '#00ff88', border: 'rgba(0,255,136,0.2)' },
    pending: { bg: 'rgba(255,217,61,0.1)', color: '#ffd93d', border: 'rgba(255,217,61,0.2)' },
    rejected: { bg: 'rgba(255,217,61,0.1)', color: '#ffd93d', border: 'rgba(255,217,61,0.2)' },
  };

  return (
    <div className="bg-grid relative" style={{ overflow: 'hidden', minHeight: 'calc(100vh - 64px)' }}>
      <div className="glow-orb" style={{ width: '30vw', height: '30vw', maxWidth: 400, maxHeight: 400, background: '#00ff88', top: '0%', right: '5%', opacity: 0.4 }} />
      <div className="glow-orb" style={{ width: '25vw', height: '25vw', maxWidth: 300, maxHeight: 300, background: 'var(--neon-purple)', bottom: '10%', left: '5%', animationDelay: '5s', opacity: 0.3 }} />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* ── Balance Card ── */}
        <div className="rounded-2xl px-4 py-4 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 relative overflow-hidden" style={{
          background: 'linear-gradient(135deg, rgba(0,255,136,0.06) 0%, rgba(0,229,255,0.04) 50%, rgba(168,85,247,0.06) 100%)',
          border: '1px solid rgba(0,255,136,0.15)',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,255,136,0.1), transparent 70%)', pointerEvents: 'none' }} />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-muted)' }}>Your Balance</p>
            <p className="text-3xl font-black leading-none" style={{
              background: 'linear-gradient(135deg, #00ff88, var(--neon-cyan))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 16px rgba(0,255,136,0.3))',
            }}>
              PKR {walletBalance.toLocaleString()}
            </p>
            {lockedBalance > 0 ? (
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Available: <span style={{ color: '#00ff88', fontWeight: 700 }}>PKR {availableBalance.toLocaleString()}</span>
                {' · '}
                Locked: <span style={{ color: '#ffd93d', fontWeight: 700 }}>PKR {lockedBalance.toLocaleString()}</span>
              </p>
            ) : (
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Available for withdrawal</p>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => {
              if (user && !user.emailVerified) { router.push('/verify-email'); return; }
              setShowWithdraw(!showWithdraw); setWithdrawStep(1); setPayMethod(''); setPayDetails({}); setWithdrawAmount(''); setWithdrawNote('');
            }} className="btn-neon text-sm flex-1 sm:flex-none" style={{
              background: showWithdraw ? 'rgba(255,217,61,0.12)' : 'rgba(0,255,136,0.08)',
              borderColor: showWithdraw ? 'rgba(255,217,61,0.3)' : 'rgba(0,255,136,0.2)',
              color: showWithdraw ? '#ffd93d' : '#00ff88',
              padding: '8px 16px',
            }}>
              {showWithdraw ? '✕ Cancel' : '🏦 Withdraw'}
            </button>
            <button onClick={() => setShowTopUp(true)} className="btn-neon text-sm flex-1 sm:flex-none" style={{
              background: 'rgba(0,229,255,0.08)',
              borderColor: 'rgba(0,229,255,0.25)',
              color: 'var(--neon-cyan)',
              padding: '8px 16px',
            }}>
              💳 Add Funds
            </button>
          </div>
        </div>

        {/* ── Email Verification Banner ── */}
        {user && !user.emailVerified && (
          <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3 animate-fade-in-up" style={{
            background: 'rgba(255,217,61,0.08)',
            border: '1px solid rgba(255,217,61,0.2)',
          }}>
            <span style={{ fontSize: 20 }}>📧</span>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: '#ffd93d' }}>Verify your email to claim rewards</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Withdrawals require a verified email address.</p>
            </div>
            <Link href="/verify-email" className="btn-neon text-xs shrink-0 px-3 py-1.5" style={{
              background: 'rgba(255,217,61,0.12)', borderColor: 'rgba(255,217,61,0.3)', color: '#ffd93d', textDecoration: 'none',
            }}>
              Verify Now
            </Link>
          </div>
        )}

        {/* ── Locked Rewards ── */}
        {lockedRewards.length > 0 && (
          <div className="rounded-xl px-4 py-3 mb-4 animate-fade-in-up" style={{
            background: 'rgba(255,217,61,0.06)',
            border: '1px solid rgba(255,217,61,0.15)',
          }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#ffd93d' }}>🔒 Locked Rewards</p>
            <div className="flex flex-col gap-1.5">
              {lockedRewards.map((lr, i) => {
                const unlockAt = new Date(lr.lockedUntil);
                const now = new Date();
                const diffMs = Math.max(0, unlockAt - now);
                const mins = Math.ceil(diffMs / 60000);
                return (
                  <div key={lr._id || i} className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--text-muted)' }}>{lr.game}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      <span style={{ color: '#ffd93d', fontWeight: 700 }}>PKR {lr.amount.toLocaleString()}</span>
                      {' · unlocks in '}
                      {mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Minimum Balance Notice ── */}
        {showWithdraw && belowMin && (
          <div className="glass-card p-6 mb-5 animate-fade-in-up text-center relative" style={{
            border: '1px solid rgba(255,217,61,0.25)',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: -50, left: '50%', transform: 'translateX(-50%)', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,217,61,0.12), transparent 70%)', pointerEvents: 'none' }} />
            <span style={{ fontSize: 44, display: 'block', marginBottom: 8 }}>💸</span>
            <p className="text-lg font-black mb-1" style={{
              background: 'linear-gradient(135deg, #ffd93d, #00ff88)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Almost there!
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              You can withdraw once you have <span style={{ color: '#00ff88', fontWeight: 800 }}>PKR {minWithdraw.toLocaleString()}</span> in your wallet.
            </p>
            <div style={{ maxWidth: 320, margin: '0 auto' }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold" style={{ color: '#00ff88' }}>PKR {availableBalance.toLocaleString()}</span>
                <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>PKR {minWithdraw.toLocaleString()}</span>
              </div>
              <div style={{ height: 10, borderRadius: 999, background: 'var(--subtle-overlay)', border: '1px solid var(--subtle-border)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${minProgress}%`,
                  borderRadius: 999,
                  background: 'linear-gradient(90deg, #00ff88, var(--neon-cyan))',
                  boxShadow: '0 0 12px rgba(0,255,136,0.5)',
                  transition: 'width 0.6s ease',
                }} />
              </div>
              <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                Just <span style={{ color: '#ffd93d', fontWeight: 700 }}>PKR {(minWithdraw - availableBalance).toLocaleString()}</span> more to go — keep playing to earn! 🎮
              </p>
            </div>
          </div>
        )}

        {/* ── Withdraw Form ── */}
        {showWithdraw && !belowMin && (
          <div className="glass-card p-5 mb-5 animate-fade-in-up">
            <form onSubmit={handleWithdraw}>
              <div className="flex flex-col gap-3">

                {/* Step 1: Amount */}
                {withdrawStep === 1 && (
                  <>
                    <div>
                      <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Amount (PKR)</label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        max={availableBalance}
                        value={withdrawAmount}
                        onChange={e => setWithdrawAmount(e.target.value)}
                        placeholder="Enter amount"
                        required
                        style={{
                          width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, color: '#fff',
                          background: 'var(--input-bg)', border: '1px solid var(--input-border)', outline: 'none',
                        }}
                      />
                    </div>
                    <button type="button" onClick={() => {
                      const amt = Number(withdrawAmount);
                      if (!amt || amt <= 0) { flash('Enter a valid amount', 'error'); return; }
                      if (amt > availableBalance) { flash('Insufficient available balance', 'error'); return; }
                      setWithdrawStep(2);
                    }} className="btn-neon btn-neon-primary text-sm">
                      Next → Choose Payment Method
                    </button>
                  </>
                )}

                {/* Step 2: Method + Details */}
                {withdrawStep === 2 && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Withdrawing <span style={{ color: '#ffd93d', fontWeight: 800 }}>PKR {Number(withdrawAmount).toLocaleString()}</span></p>
                      <button type="button" onClick={() => setWithdrawStep(1)} className="text-xs" style={{ color: 'var(--neon-cyan)' }}>← Change amount</button>
                    </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--text-muted)' }}>Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'bank', icon: '🏦', label: 'Bank Transfer' },
                      { key: 'easypaisa', icon: '📱', label: 'EasyPaisa' },
                      { key: 'jazzcash', icon: '📲', label: 'JazzCash' },
                    ].map(m => (
                      <button type="button" key={m.key} onClick={() => { setPayMethod(m.key); setPayDetails({}); }}
                        className="flex flex-col items-center gap-1 p-3 rounded-xl text-xs font-semibold transition-all"
                        style={{
                          background: payMethod === m.key ? 'rgba(0,255,136,0.1)' : 'var(--subtle-overlay)',
                          border: `1.5px solid ${payMethod === m.key ? 'rgba(0,255,136,0.35)' : 'var(--subtle-border)'}`,
                          color: payMethod === m.key ? '#00ff88' : 'var(--text-muted)',
                          transform: payMethod === m.key ? 'scale(1.03)' : 'scale(1)',
                        }}>
                        <span style={{ fontSize: 22 }}>{m.icon}</span>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Bank Fields ── */}
                {payMethod === 'bank' && (
                  <div className="flex flex-col gap-3 animate-fade-in-up">
                    <div>
                      <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Bank Name</label>
                      <input
                        list="pk-banks"
                        value={payDetails.bankName || ''}
                        onChange={e => setPayDetails(p => ({ ...p, bankName: e.target.value }))}
                        placeholder="Select or type bank name"
                        required
                        style={{
                          width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, color: '#fff',
                          background: 'var(--input-bg)', border: '1px solid var(--input-border)', outline: 'none',
                        }}
                      />
                      <datalist id="pk-banks">
                        {['Allied Bank (ABL)','Askari Bank','Bank Alfalah','Bank Al-Habib','Bank of Punjab (BOP)','BankIslami','Faysal Bank','Habib Bank (HBL)','Habib Metropolitan Bank','JS Bank','MCB Bank','Meezan Bank','National Bank of Pakistan (NBP)','Samba Bank','Silk Bank','Soneri Bank','Standard Chartered Pakistan','Summit Bank','UBL (United Bank)','Al Baraka Bank','Dubai Islamic Bank Pakistan','First Women Bank','Khushhali Microfinance Bank','NRSP Microfinance Bank','U Microfinance Bank','Telenor Microfinance Bank (Easypaisa)','Mobilink Microfinance Bank (JazzCash)'].map(b => (
                          <option key={b} value={b} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Account Title</label>
                      <input
                        value={payDetails.accountTitle || ''}
                        onChange={e => setPayDetails(p => ({ ...p, accountTitle: e.target.value }))}
                        placeholder="Name on bank account"
                        required
                        style={{
                          width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, color: '#fff',
                          background: 'var(--input-bg)', border: '1px solid var(--input-border)', outline: 'none',
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Account Number / IBAN</label>
                      <input
                        value={payDetails.accountNumber || ''}
                        onChange={e => setPayDetails(p => ({ ...p, accountNumber: e.target.value }))}
                        placeholder="e.g. PK36SCBL0000001123456702"
                        required
                        style={{
                          width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, color: '#fff',
                          background: 'var(--input-bg)', border: '1px solid var(--input-border)', outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* ── EasyPaisa / JazzCash Fields ── */}
                {(payMethod === 'easypaisa' || payMethod === 'jazzcash') && (
                  <div className="flex flex-col gap-3 animate-fade-in-up">
                    <div>
                      <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Account Holder Name</label>
                      <input
                        value={payDetails.accountTitle || ''}
                        onChange={e => setPayDetails(p => ({ ...p, accountTitle: e.target.value }))}
                        placeholder="Name on account"
                        required
                        style={{
                          width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, color: '#fff',
                          background: 'var(--input-bg)', border: '1px solid var(--input-border)', outline: 'none',
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Phone Number</label>
                      <input
                        value={payDetails.phoneNumber || ''}
                        onChange={e => setPayDetails(p => ({ ...p, phoneNumber: e.target.value }))}
                        placeholder="e.g. 03001234567"
                        required
                        style={{
                          width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, color: '#fff',
                          background: 'var(--input-bg)', border: '1px solid var(--input-border)', outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Note (optional) */}
                {payMethod && (
                  <div className="animate-fade-in-up">
                    <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Note (optional)</label>
                    <input
                      value={withdrawNote}
                      onChange={e => setWithdrawNote(e.target.value)}
                      placeholder="Any extra info for admin"
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, color: '#fff',
                        background: 'var(--input-bg)', border: '1px solid var(--input-border)', outline: 'none',
                      }}
                    />
                  </div>
                )}

                <button type="submit" className="btn-neon btn-neon-primary text-sm" disabled={submitting || !payMethod}>
                  {submitting ? 'Submitting...' : 'Submit Withdrawal Request'}
                </button>
                  </>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Flash */}
        {msg && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium animate-fade-in-up" style={{
            background: msg.type === 'error' ? 'rgba(255,45,120,0.12)' : 'rgba(0,255,136,0.12)',
            color: msg.type === 'error' ? '#ff5c8a' : '#00ff88',
            border: `1px solid ${msg.type === 'error' ? 'rgba(255,45,120,0.25)' : 'rgba(0,255,136,0.25)'}`,
          }}>{msg.text}</div>
        )}

        {/* ── Transaction History ── */}
        <div>
          <h2 className="text-base font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Transaction History</h2>
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'rgba(0,229,255,0.3)', borderTopColor: 'transparent' }} />
            </div>
          ) : visibleTransactions.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <span style={{ fontSize: 40, display: 'block', marginBottom: 8 }}>📭</span>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No transactions yet. Play games and earn rewards!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {visibleTransactions.map((txn) => {
                const cfg = typeConfig[txn.type] || typeConfig.credit;
                const sc = statusColors[txn.status] || statusColors.completed;
                return (
                  <div key={txn._id} className="glass-card px-4 py-3 flex items-center gap-3">
                    <span style={{ fontSize: 22 }}>{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{txn.description || cfg.label}</span>
                        {txn.game && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,229,255,0.08)', color: 'var(--neon-cyan)' }}>{txn.game}</span>}
                        {(txn.status !== 'completed' || txn.type === 'withdrawal') && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{txn.status}</span>
                        )}
                      </div>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {new Date(txn.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })} · {new Date(txn.createdAt).toLocaleTimeString(undefined, { timeStyle: 'short' })}
                        {txn.createdBy?.name && <span> · by {txn.createdBy.name}</span>}
                      </p>
                    </div>
                    <span className="text-base font-bold whitespace-nowrap" style={{ color: txn.status === 'rejected' ? '#ffd93d' : cfg.color }}>
                      {cfg.sign}PKR {txn.amount.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showTopUp && (
        <TopUpModal
          onClose={() => setShowTopUp(false)}
          onSuccess={(amt) => {
            setShowTopUp(false);
            fetchBalance();
            flash(`PKR ${amt.toLocaleString()} added to your wallet!`);
          }}
        />
      )}
    </div>
  );
}
