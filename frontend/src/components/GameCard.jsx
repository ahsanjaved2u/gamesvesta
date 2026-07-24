// ══════════════════════════════════════════════════════════════════════════════
//  GAME CARD — Mode-aware play links
//
//  The "Play" button link includes a query param to tell the game page which mode:
//    - Contest active → /games/{slug}?contestId={id}
//    - Session active (no contest) → /games/{slug}?sessionId={id}
//    - Neither → /games/{slug} (plain)
//
//  This ensures the game page opens in the correct mode (contest vs session)
//  and the HUD displays accordingly (no PKR in contest, PKR in session).
//
//  TAG BADGE: Rendered top-left if contest.tag or session.tag is set (e.g. "Hot", "New").
// ══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import CommentsModal from '@/components/CommentsModal';

const GAMES_BASE = process.env.NEXT_PUBLIC_GAMES_BASE_URL || '/games';
const SITE_URL = 'https://gamevesta.com';

const sharePlatforms = [
  { name: 'WhatsApp', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
  ), color: '#25D366', share: (url, text) => `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}` },
  { name: 'Facebook', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
  ), color: '#1877F2', share: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { name: 'Twitter', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
  ), color: '#000', share: (url, text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
  { name: 'TikTok', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
  ), color: '#ff0050', share: (url, text) => `https://www.tiktok.com/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  { name: 'Instagram', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
  ), color: '#E4405F', share: null },
  { name: 'Telegram', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
  ), color: '#26A5E4', share: (url, text) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  { name: 'LinkedIn', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
  ), color: '#0A66C2', share: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
  { name: 'Copy', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
  ), color: '#00e5ff', share: null },
];

const calcTime = (target) => {
  const diff = Math.max(0, target - new Date());
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
  };
};

/* ── Contest countdown: before-start or time-remaining ── */
function ContestCountdown({ contest, onPhaseChange }) {
  const startDate = new Date(contest.startDate);
  const endDate = new Date(contest.endDate);

  const getPhase = () => {
    const now = new Date();
    if (now < startDate) return 'before';
    if (now < endDate && !contest.prizesDistributed) return 'running';
    return 'ended';
  };

  const [phase, setPhase] = useState(getPhase);
  const [time, setTime] = useState(() => calcTime(getPhase() === 'before' ? startDate : endDate));

  // Notify parent of phase changes via effect (not during render)
  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    if (prevPhaseRef.current !== phase) {
      prevPhaseRef.current = phase;
      if (onPhaseChangeRef.current) onPhaseChangeRef.current(phase);
    }
  }, [phase]);

  useEffect(() => {
    const tick = () => {
      const p = getPhase();
      setPhase(p);
      const target = p === 'before' ? startDate : endDate;
      setTime(calcTime(target));
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contest.startDate, contest.endDate, contest.prizesDistributed]);

  if (phase === 'ended') {
    return (
      <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 10, border: '1px solid rgba(255,92,138,0.22)' }}>
        <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,92,138,0.7)', display: 'inline-block', boxShadow: '0 0 6px rgba(255,92,138,0.7)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#ff5c8a' }}>Competition Ended</span>
        </div>
      </div>
    );
  }

  const fmtDate = (d) => d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const cfg = {
    before: { color: '#ffd93d', icon: '⏳', label: 'Starts in', dot: 'rgba(255,217,61,0.7)' },
    running: { color: '#00e5ff', icon: '🔥', label: 'Competition ends in', dot: 'rgba(0,229,255,0.7)' },
  }[phase];

  const seg = (val, unit) => (
    <div style={{ textAlign: 'center', minWidth: 34 }}>
      <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1, color: cfg.color, fontVariantNumeric: 'tabular-nums', textShadow: `0 0 14px ${cfg.color}90` }}>
        {String(val).padStart(2, '0')}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{unit}</div>
    </div>
  );
  const sep = <span style={{ fontSize: 15, fontWeight: 700, color: cfg.color, opacity: 0.5, alignSelf: 'flex-start', marginTop: 1 }}>:</span>;

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 10, border: `1px solid ${cfg.color}22` }}>
      <div style={{ background: `${cfg.color}0a`, borderBottom: `1px solid ${cfg.color}18`, padding: '6px 10px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 8px', alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', fontWeight: 600 }}>📅 Start</span>
        <span style={{ fontSize: 10, color: cfg.color, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmtDate(startDate)}</span>
        <span style={{ fontSize: 9, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', fontWeight: 600 }}>🏁 End</span>
        <span style={{ fontSize: 10, color: cfg.color, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmtDate(endDate)}</span>
      </div>
      <div style={{ padding: '8px 10px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, display: 'inline-block', boxShadow: `0 0 6px ${cfg.dot}` }} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: cfg.color }}>{cfg.label}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {time.days > 0 && <>{seg(time.days, 'days')}{sep}</>}
          {seg(time.hours, 'hrs')}{sep}
          {seg(time.mins, 'min')}{sep}
          {seg(time.secs, 'sec')}
        </div>
      </div>
    </div>
  );
}

/* ── Session period countdown ── */
function SessionCountdown({ session, slug, onSessionEnd }) {
  const periodMs = ((session.durationDays || 0) * 86400000) + ((session.durationHours || 0) * 3600000) + ((session.durationMinutes || 0) * 60000);
  const anchorMs = session.periodAnchor ? new Date(session.periodAnchor).getTime() : 0;
  const endMs = anchorMs + periodMs;

  const calcRemaining = () => Math.max(0, endMs - Date.now());

  const [time, setTime] = useState(() => {
    const rem = calcRemaining();
    return {
      days: Math.floor(rem / 86400000),
      hours: Math.floor((rem % 86400000) / 3600000),
      mins: Math.floor((rem % 3600000) / 60000),
      secs: Math.floor((rem % 60000) / 1000),
    };
  });

  useEffect(() => {
    if (periodMs <= 0) return;
    const tick = () => {
      const rem = calcRemaining();
      if (rem <= 0) {
        setTime({ days: 0, hours: 0, mins: 0, secs: 0 });
        if (onSessionEnd) onSessionEnd();
        return;
      }
      setTime({
        days: Math.floor(rem / 86400000),
        hours: Math.floor((rem % 86400000) / 3600000),
        mins: Math.floor((rem % 3600000) / 60000),
        secs: Math.floor((rem % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodMs, anchorMs]);

  if (periodMs <= 0) return null;

  return (
    <div className="flex items-center gap-1.5 mt-3" style={{ color: 'rgba(255,217,61,0.9)' }}>
      <span style={{ fontSize: 11, opacity: 0.85, fontWeight: 600, letterSpacing: '0.2px' }}>Session resets in</span>
      <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {time.days > 0 && `${time.days}d `}
        {String(time.hours).padStart(2, '0')}:{String(time.mins).padStart(2, '0')}:{String(time.secs).padStart(2, '0')}
      </span>
    </div>
  );
}

export default function GameCard({ game, contest, session, i, isLoggedIn, reviewData, onToggleLike, onContestLive, onSessionEnd }) {
  const { user } = useAuth();
  // Auto-fallback: if no thumbnail field set in DB, look for the
  // conventional `images/thumbnail.webp` inside the game's folder so dropping
  // that file is enough — no admin form edit needed.
  const thumb = `${GAMES_BASE}/${game.gamePath}/${game.thumbnail || 'images/thumbnail.webp'}`;
  const [thumbBroken, setThumbBroken] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [contestPhase, setContestPhase] = useState(null);
  const shareRef = useRef(null);

  const likes = reviewData?.totalLikes || 0;
  const comments = reviewData?.totalComments || 0;
  const userLiked = reviewData?.userLiked || false;

  const baseGameUrl = `${SITE_URL}/games/${game.slug}`;
  const gameUrl = user?.referralCode ? `${baseGameUrl}?ref=${user.referralCode}` : baseGameUrl;

  // ── Single contest OR session per card ──
  const isLiveContest = contest?.status === 'live' || contestPhase === 'running';
  const isScheduledContest = contest?.status === 'scheduled' && new Date(contest.startDate) > new Date() && contestPhase !== 'running';

  // Determine card accent color
  const accentColor = contest?.color || session?.color || game.color || '#00e5ff';

  // Determine tag
  const tag = contest?.tag || session?.tag || '';

  // Entry fee & pricing
  const contestEntryFee = contest?.entryFee || 0;
  const contestPrizes = contest?.prizes || [];
  const sessionEntryFee = session?.entryFee || 0;
  const sessionAttemptCost = session?.attemptCost || 0;

  // Is the card playable right now?
  const isContestPlayable = isLiveContest;
  const isContestScheduled = !isLiveContest && isScheduledContest;
  const isSessionPlayable = session != null;
  const isPlayable = isContestPlayable || isSessionPlayable;

  const shareText = contestEntryFee > 0 || sessionAttemptCost > 0
    ? `🎮 Play ${game.name} on GameVesta and win real cash!`
    : `🎮 Play ${game.name} for FREE on GameVesta!`;

  // Close share pill on outside click
  useEffect(() => {
    if (!shareOpen) return;
    const handleClick = (e) => { if (shareRef.current && !shareRef.current.contains(e.target)) setShareOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [shareOpen]);

  const handleShareClick = async (platform) => {
    if (platform.name === 'Copy' || platform.name === 'Instagram') {
      try { await navigator.clipboard.writeText(gameUrl); setCopied(true); setTimeout(() => { setCopied(false); setShareOpen(false); }, 1200); } catch {}
      return;
    }
    if (platform.share) {
      window.open(platform.share(gameUrl, shareText), '_blank', 'noopener,noreferrer');
    }
    setShareOpen(false);
  };

  // Prefetch game assets on hover
  const prefetched = useRef(false);
  const prefetchGame = useCallback(() => {
    if (prefetched.current || !game.gamePath) return;
    prefetched.current = true;
    const gUrl = `${GAMES_BASE}/${game.gamePath}/index.html`;
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'PREFETCH_GAME', url: gUrl });
    }
  }, [game.gamePath]);

  // Determine what the play button should say
  const getPlayButton = () => {
    // Not playable at all (only scheduled contest, no sessions)
    if (!isPlayable && isContestScheduled) {
      return { disabled: true, label: '🔒 Coming Soon' };
    }
    if (!isPlayable) {
      return { disabled: true, label: '🔒 Not Available' };
    }
    // Needs login for paid games
    if (!isLoggedIn && (contestEntryFee > 0 || sessionAttemptCost > 0 || sessionEntryFee > 0)) {
      return { disabled: false, label: '🔒 Sign Up to Play', href: '/signup' };
    }
    // Contest with entry fee
    if (isContestPlayable && contestEntryFee > 0) {
      return { disabled: false, label: `🎟️ Enter — PKR ${contestEntryFee}` };
    }
    // Session with attempt cost
    if (isSessionPlayable && sessionAttemptCost > 0) {
      return { disabled: false, label: `🎯 Play — PKR ${sessionAttemptCost}/try` };
    }
    return { disabled: false, label: '▶ Play Now' };
  };

  const playBtn = getPlayButton();

  return (
    <div
      className="glass-card group transition-all duration-300 animate-fade-in-up relative overflow-hidden flex flex-col"
      style={{
        animationDelay: `${i * 0.08}s`,
        opacity: isPlayable ? 1 : 0.7,
        border: `2px solid ${accentColor}30`,
        boxShadow: `0 0 10px ${accentColor}12, inset 0 1px 0 ${accentColor}0a`,
      }}
      onMouseEnter={e => {
        prefetchGame();
        if (!isPlayable) return;
        e.currentTarget.style.borderColor = accentColor + '60';
        e.currentTarget.style.boxShadow = `0 0 24px ${accentColor}28, inset 0 1px 0 ${accentColor}14`;
        e.currentTarget.style.transform = 'translateY(-4px)';
      }}
      onTouchStart={() => { prefetchGame(); }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = accentColor + '30';
        e.currentTarget.style.boxShadow = `0 0 10px ${accentColor}12, inset 0 1px 0 ${accentColor}0a`;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div className="relative h-32 sm:h-48 flex items-center justify-center overflow-hidden card-thumb-shimmer" style={{ borderBottom: `1px solid ${accentColor}15` }}>
        {!thumbBroken ? (
          <>
            <Image src={thumb} alt={game.name} fill className="object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" priority={i < 3} loading={i < 3 ? 'eager' : 'lazy'} onError={() => setThumbBroken(true)} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(11,11,26,0.95) 0%, rgba(11,11,26,0.3) 40%, transparent 100%)' }} />
          </>
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 80%, ${accentColor}18, transparent 70%)` }}>
            <span className="absolute inset-0 flex items-center justify-center text-6xl sm:text-7xl select-none" style={{ filter: `drop-shadow(0 0 20px ${accentColor}60)` }}>🎮</span>
          </div>
        )}

        {/* Tag badge — top left */}
        {tag && (
          <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: 'rgba(0,255,136,0.12)', color: 'var(--neon-green)', border: '1px solid rgba(0,255,136,0.25)' }}>{tag}</span>
        )}

        {/* Pricing badge — top right */}
        {isPlayable && contestEntryFee > 0 && (
          <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}>🎟️ Entry PKR {contestEntryFee}</span>
        )}
        {isPlayable && !contestEntryFee && sessionAttemptCost > 0 && (
          <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,217,61,0.12)', color: '#ffd93d', border: '1px solid rgba(255,217,61,0.3)' }}>🎯 PKR {sessionAttemptCost}/play</span>
        )}
        {isPlayable && !contestEntryFee && !sessionAttemptCost && (
          <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: 'rgba(0,255,136,0.12)', color: 'var(--neon-green)', border: '1px solid rgba(0,255,136,0.25)' }}>FREE</span>
        )}
        {!isPlayable && isContestScheduled && (
          <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,217,61,0.12)', color: '#ffd93d', border: '1px solid rgba(255,217,61,0.3)' }}>⏳ Coming Soon</span>
        )}

        {/* Like + Comment badges — bottom left */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5" style={{ zIndex: 10 }}>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (onToggleLike) onToggleLike(game.slug); }}
            className="flex items-center gap-1.5 transition-all duration-200"
            style={{
              padding: '4px 10px 4px 7px', borderRadius: 20,
              background: 'rgba(11,11,26,0.75)', backdropFilter: 'blur(8px)',
              border: `1px solid ${userLiked ? 'rgba(255,45,120,0.4)' : 'rgba(255,255,255,0.12)'}`,
              color: userLiked ? '#ff2d78' : 'rgba(255,255,255,0.7)',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}
            title={userLiked ? 'Unlike' : 'Like this game'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={userLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
            {likes > 0 && <span>{likes}</span>}
          </button>

          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCommentsOpen(true); }}
            className="flex items-center gap-1 transition-all duration-200"
            style={{
              padding: '5px 10px 5px 7px', borderRadius: 20,
              background: 'rgba(11,11,26,0.75)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}
            title={comments > 0 ? `${comments} comment${comments !== 1 ? 's' : ''}` : 'Add a comment'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            {comments > 0 && <span>{comments}</span>}
          </button>

          {commentsOpen && (
            <CommentsModal slug={game.slug} gameName={game.name} onClose={() => setCommentsOpen(false)} />
          )}
        </div>

        {/* Share button — bottom right */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5" style={{ zIndex: 10 }}>
          <div ref={shareRef}>
            {!shareOpen ? (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShareOpen(true); }}
                className="flex items-center justify-center transition-all duration-200"
                style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,229,255,0.1)', backdropFilter: 'blur(8px)', border: '1px solid rgba(0,229,255,0.3)', color: '#00e5ff', cursor: 'pointer' }}
                title="Share this game"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
              </button>
            ) : (
              <div className="flex items-center gap-1 animate-fade-in-up" style={{ padding: '4px 6px', borderRadius: 20, background: 'rgba(11,11,26,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                {sharePlatforms.map(p => (
                  <button key={p.name} onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleShareClick(p); }} className="flex items-center justify-center transition-all duration-150" style={{ width: 30, height: 30, borderRadius: '50%', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.65)', cursor: 'pointer' }} title={p.name === 'Copy' ? (copied ? 'Copied!' : 'Copy link') : p.name === 'Instagram' ? (copied ? 'Link copied — paste in IG' : 'Share on Instagram') : `Share on ${p.name}`}>
                    {p.name === 'Copy' && copied ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> : p.icon}
                  </button>
                ))}
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShareOpen(false); }} className="flex items-center justify-center transition-all duration-150" style={{ width: 24, height: 24, borderRadius: '50%', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', marginLeft: 2 }} title="Close">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-5 flex flex-col flex-1">

        {/* ── Session: Play & Earn panel ── */}
        {session && (
          <div className="flex-1 flex flex-col items-center justify-center rounded-xl mb-3 px-2 py-3 sm:px-4 sm:py-5 text-center" style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.08), rgba(255,217,61,0.06))', border: '1px solid rgba(0,255,136,0.15)' }}>
            <span className="text-[24px] sm:text-[34px]" style={{ lineHeight: 1, marginBottom: 8 }}>💰</span>
            <span className="font-bold text-[13px] sm:text-[17px]" style={{ color: '#00ff88' }}>{game.name}</span>
            <p className="text-[11px] sm:text-[13.5px]" style={{ color: 'var(--text-secondary)', margin: '6px 0 0' }}>Top scores win real cash prizes!</p>
            <SessionCountdown session={session} slug={game.slug} onSessionEnd={onSessionEnd} />
          </div>
        )}

        {/* ── Contest: Prizes panel ── */}
        {contest && contestPrizes.length > 0 && (
          <div className="mb-3 px-3 py-2 rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(255,217,61,0.08), rgba(168,85,247,0.08))', border: '1px solid rgba(255,217,61,0.15)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span style={{ fontSize: 14 }}>🏆</span>
              <span className="text-[11px] font-bold" style={{ color: '#ffd93d' }}>Compete &amp; Win Prizes</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 ml-6">
              {contestPrizes.slice(0, 3).map((p, j) => {
                const icons = ['🥇', '🥈', '🥉'];
                return <span key={j} className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{icons[j]} PKR {p.toLocaleString()}</span>;
              })}
              {contestPrizes.length > 3 && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>+{contestPrizes.length - 3} more</span>}
            </div>
          </div>
        )}

        {/* ── Contest countdown (before-start or time-remaining) ── */}
        {contest && (
          <ContestCountdown contest={contest} onPhaseChange={(p) => { setContestPhase(p); if (p === 'running' && onContestLive) onContestLive(); }} />
        )}

        {/* ── Play button ── */}
        {playBtn.disabled ? (
          <div className="btn-neon text-sm w-full text-center" style={{ opacity: 0.4, cursor: 'not-allowed' }}>
            {playBtn.label}
          </div>
        ) : playBtn.href ? (
          <Link href={playBtn.href} className="btn-neon text-sm w-full text-center" style={{ textDecoration: 'none', opacity: 0.7 }}>
            {playBtn.label}
          </Link>
        ) : (
          <Link href={`/games/${game.slug}${contest ? `?contestId=${contest._id}` : session ? `?sessionId=${session._id}` : ''}`} className="btn-neon btn-neon-primary text-sm w-full text-center" style={{ textDecoration: 'none' }}>
            {playBtn.label}
          </Link>
        )}
      </div>
    </div>
  );
}
