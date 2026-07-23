'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import AdminRoute from '@/components/AdminRoute';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function SettingsContent() {
  const { authFetch } = useAuth();
  const [signupReward, setSignupReward] = useState('');
  const [referralBonusPercent, setReferralBonusPercent] = useState('');
  const [referralDurationDays, setReferralDurationDays] = useState('');
  const [maxReferralsPerUser, setMaxReferralsPerUser] = useState('');
  const [referralIPRestriction, setReferralIPRestriction] = useState(true);
  const [minWithdrawalAmount, setMinWithdrawalAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await authFetch('/settings');
        if (data.success) {
          setSignupReward(data.settings.signupReward ?? 0);
          setReferralBonusPercent(data.settings.referralBonusPercent ?? 10);
          setReferralDurationDays(data.settings.referralDurationDays ?? 30);
          setMaxReferralsPerUser(data.settings.maxReferralsPerUser ?? 50);
          setReferralIPRestriction(data.settings.referralIPRestriction === true || data.settings.referralIPRestriction === 'true');
          setMinWithdrawalAmount(data.settings.minWithdrawalAmount ?? 200);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const data = await authFetch('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          signupReward: Number(signupReward) || 0,
          referralBonusPercent: Number(referralBonusPercent) || 0,
          referralDurationDays: Number(referralDurationDays) || 30,
          maxReferralsPerUser: Number(maxReferralsPerUser) || 50,
          referralIPRestriction,
          minWithdrawalAmount: Number(minWithdrawalAmount) || 0,
        }),
      });
      if (data.success) {
        setMsg({ type: 'success', text: 'Settings saved!' });
        setSignupReward(data.settings.signupReward ?? 0);
        setReferralBonusPercent(data.settings.referralBonusPercent ?? 10);
        setReferralDurationDays(data.settings.referralDurationDays ?? 30);
        setMaxReferralsPerUser(data.settings.maxReferralsPerUser ?? 50);
        setReferralIPRestriction(data.settings.referralIPRestriction === true || data.settings.referralIPRestriction === 'true');
        setMinWithdrawalAmount(data.settings.minWithdrawalAmount ?? 200);
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to save' });
    }
    setSaving(false);
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div className="bg-grid relative min-h-screen" style={{ overflow: 'hidden' }}>
      <div className="glow-orb" style={{ width: '28vw', height: '28vw', maxWidth: 340, maxHeight: 340, background: 'var(--neon-cyan)', top: '4%', right: '8%', opacity: 0.18 }} />
      <div className="glow-orb" style={{ width: '24vw', height: '24vw', maxWidth: 300, maxHeight: 300, background: 'var(--neon-purple)', bottom: '8%', left: '6%', opacity: 0.13 }} />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="btn-neon text-sm" style={{ textDecoration: 'none' }}>
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            ⚙️ App Settings
          </h1>
        </div>

        {loading ? (
          <div className="glass-card p-8 text-center">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{
              borderColor: 'color-mix(in srgb, var(--neon-cyan) 30%, transparent)',
              borderTopColor: 'transparent',
            }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading settings...</p>
          </div>
        ) : (
          <div className="space-y-5">

            {/* ── Signup Reward Card ── */}
            <div className="glass-card p-5 sm:p-6" style={{ border: '1px solid var(--glass-border)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{
                  background: 'linear-gradient(135deg, #00ff88, var(--neon-cyan))',
                }}>🎁</div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Signup Reward</h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Amount credited to new user wallets on signup. Set to 0 to disable.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: 'var(--text-muted)' }}>PKR</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={signupReward}
                    onChange={e => setSignupReward(e.target.value)}
                    className="w-full rounded-xl py-2.5 pl-12 pr-4 text-sm font-semibold outline-none transition-all"
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      color: 'var(--text-primary)',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--neon-cyan)'}
                    onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
                  />
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-neon btn-neon-primary text-sm px-5 py-2.5"
                  style={{ opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>

              {msg && (
                <div className="mt-3 px-4 py-2.5 rounded-xl text-sm font-medium animate-fade-in-up" style={{
                  background: msg.type === 'success' ? 'rgba(0,255,136,0.1)' : 'rgba(255,45,120,0.1)',
                  border: `1px solid ${msg.type === 'success' ? 'rgba(0,255,136,0.3)' : 'rgba(255,45,120,0.3)'}`,
                  color: msg.type === 'success' ? '#00ff88' : '#ff2d78',
                }}>
                  {msg.text}
                </div>
              )}

              <p className="mt-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {Number(signupReward) > 0
                  ? `New users will receive PKR ${signupReward} in their wallet on signup. A modal will prompt guests to sign up.`
                  : 'Signup reward is disabled. No reward modal will be shown to guests.'}
              </p>
            </div>

            {/* ── Minimum Withdrawal Card ── */}
            <div className="glass-card p-5 sm:p-6" style={{ border: '1px solid var(--glass-border)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{
                  background: 'linear-gradient(135deg, #ffd93d, var(--neon-cyan))',
                }}>💸</div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Minimum Withdrawal</h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Users can send a withdrawal request only once their available balance reaches this amount. Set to 0 to disable.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: 'var(--text-muted)' }}>PKR</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={minWithdrawalAmount}
                    onChange={e => setMinWithdrawalAmount(e.target.value)}
                    className="w-full rounded-xl py-2.5 pl-12 pr-4 text-sm font-semibold outline-none transition-all"
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      color: 'var(--text-primary)',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--neon-cyan)'}
                    onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
                  />
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-neon btn-neon-primary text-sm px-5 py-2.5"
                  style={{ opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>

              {msg && (
                <div className="mt-3 px-4 py-2.5 rounded-xl text-sm font-medium animate-fade-in-up" style={{
                  background: msg.type === 'success' ? 'rgba(0,255,136,0.1)' : 'rgba(255,45,120,0.1)',
                  border: `1px solid ${msg.type === 'success' ? 'rgba(0,255,136,0.3)' : 'rgba(255,45,120,0.3)'}`,
                  color: msg.type === 'success' ? '#00ff88' : '#ff2d78',
                }}>
                  {msg.text}
                </div>
              )}

              <p className="mt-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {Number(minWithdrawalAmount) > 0
                  ? `Users need at least PKR ${minWithdrawalAmount} in available balance before they can send a withdrawal request.`
                  : 'No minimum — users can request a withdrawal with any balance.'}
              </p>
            </div>

            {/* ── Referral Program Card ── */}
            <div className="glass-card p-5 sm:p-6" style={{ border: '1px solid var(--glass-border)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{
                  background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-pink))',
                }}>🤝</div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Referral Program</h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Configure referral rewards. Referrers earn a % bonus when their referred users play games.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Bonus % */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Bonus Percentage</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={referralBonusPercent}
                      onChange={e => setReferralBonusPercent(e.target.value)}
                      className="w-full rounded-xl py-2.5 pl-4 pr-10 text-sm font-semibold outline-none transition-all"
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                      onFocus={e => e.target.style.borderColor = 'var(--neon-purple)'}
                      onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: 'var(--text-muted)' }}>%</span>
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Duration (days)</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    step="1"
                    value={referralDurationDays}
                    onChange={e => setReferralDurationDays(e.target.value)}
                    className="w-full rounded-xl py-2.5 px-4 text-sm font-semibold outline-none transition-all"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                    onFocus={e => e.target.style.borderColor = 'var(--neon-purple)'}
                    onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
                  />
                </div>

                {/* Max Referrals */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Max per User</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    step="1"
                    value={maxReferralsPerUser}
                    onChange={e => setMaxReferralsPerUser(e.target.value)}
                    className="w-full rounded-xl py-2.5 px-4 text-sm font-semibold outline-none transition-all"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                    onFocus={e => e.target.style.borderColor = 'var(--neon-purple)'}
                    onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
                  />
                </div>
              </div>

              {/* Same-IP Restriction Toggle */}
              <label className="flex items-center gap-3 mt-4 cursor-pointer select-none">
                <span
                  role="checkbox"
                  aria-checked={referralIPRestriction}
                  tabIndex={0}
                  onClick={() => setReferralIPRestriction(v => !v)}
                  onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setReferralIPRestriction(v => !v); } }}
                  className="relative inline-flex items-center shrink-0 rounded-full transition-colors duration-200"
                  style={{
                    width: 40, height: 22,
                    background: referralIPRestriction ? 'var(--neon-purple)' : 'var(--glass-border)',
                  }}
                >
                  <span
                    className="inline-block rounded-full shadow transition-transform duration-200"
                    style={{
                      width: 16, height: 16,
                      background: '#fff',
                      transform: referralIPRestriction ? 'translateX(20px)' : 'translateX(3px)',
                    }}
                  />
                </span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Block same-IP referrals
                </span>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {referralIPRestriction
                    ? 'Referrals from the same IP will be flagged.'
                    : 'Same-IP check is disabled — all referrals are accepted.'}
                </span>
              </label>

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-neon btn-neon-primary text-sm px-5 py-2.5"
                  style={{ opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? 'Saving...' : 'Save All'}
                </button>
                <Link href="/dashboard/referrals" className="btn-neon text-sm px-4 py-2.5" style={{ textDecoration: 'none', color: 'var(--neon-purple)' }}>
                  📊 View Referrals
                </Link>
              </div>

              {msg && (
                <div className="mt-3 px-4 py-2.5 rounded-xl text-sm font-medium animate-fade-in-up" style={{
                  background: msg.type === 'success' ? 'rgba(0,255,136,0.1)' : 'rgba(255,45,120,0.1)',
                  border: `1px solid ${msg.type === 'success' ? 'rgba(0,255,136,0.3)' : 'rgba(255,45,120,0.3)'}`,
                  color: msg.type === 'success' ? '#00ff88' : '#ff2d78',
                }}>
                  {msg.text}
                </div>
              )}

              <p className="mt-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {Number(referralBonusPercent) > 0
                  ? `Referrers earn ${referralBonusPercent}% bonus on referred users' game rewards for ${referralDurationDays} days. Max ${maxReferralsPerUser} referrals per user.`
                  : 'Referral program is disabled (0% bonus).'}
              </p>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardSettingsPage() {
  return (
    <AdminRoute>
      <SettingsContent />
    </AdminRoute>
  );
}
