// ══════════════════════════════════════════════════════════════
//  GameZone SDK — drop-in leaderboard + game-over screen
//
//  Usage in any game:
//    <script src="/sdk/gamezone-sdk.js"></script>
//    <script>
//      const canvas = document.getElementById('myCanvas');
//      const ctx    = canvas.getContext('2d');
//      GameZone.init({ canvas, ctx, slug: 'my-game' });
//
//      // When game ends:
//      GameZone.gameOver(points, timeInSeconds);
//
//      // In your render loop:
//      if (GameZone.isGameOver) { GameZone.drawGameOver(); return; }
//
//      // Optional: add leaderboard button in your hood
//      GameZone.toggleLeaderboard();
//    </script>
// ══════════════════════════════════════════════════════════════

const GameZone = (() => {
    // ── Config ──
    let canvas, ctx, slug, lbContainer;
    const MAX_ENTRIES = 10;
    let playerName = '';

    // ── State ──
    let _isGameOver = false;
    let gameOverResult = null;
    let tryAgainBtn = null;
    let onRestartCb = null;
    let gamePoints = 0;
    let gameTime = 0;
    // PERF: throttle backend leaderboard fetches.
    let _lastRequestAt = 0;
    // PERF: cache the rendered game-over overlay onto an offscreen canvas
    //       so the host game loop only blits, never re-draws the same frame.
    let _gameOverCache = null;
    let _gameOverCacheKey = '';

    // ── Leaderboard data ──
    const defaultEntries = [
        { name: 'Ace', points: 48, time: 35, score: 55 },
        { name: 'Blaze', points: 45, time: 45, score: 51 },
        { name: 'Comet', points: 42, time: 55, score: 47 },
        { name: 'Dash', points: 40, time: 65, score: 44 },
        { name: 'Echo', points: 38, time: 75, score: 41 },
        { name: 'Flare', points: 35, time: 85, score: 37 },
        { name: 'Glow', points: 32, time: 95, score: 33 },
        { name: 'Haze', points: 28, time: 110, score: 29 },
        { name: 'Ion', points: 24, time: 120, score: 24 },
        { name: 'Jinx', points: 20, time: 140, score: 20 },
    ];
    let entries = [...defaultEntries];

    // ── Score calc ──
    // Score is essentially equal to points, with a SMALL time-bonus so two
    // players who tie on points still get sorted by speed.
    //
    //   bonus = 1 + max(0, 300 − t) / 6000      (t in seconds)
    //
    //   t = 0s   → 1.0500  (max +5%)
    //   t = 60s  → 1.0400
    //   t = 120s → 1.0300
    //   t = 300s → 1.0000  (no bonus past 5 minutes)
    //
    // Example: 40 points
    //   • 0s   → 42.00     • 30s → 41.80     • 60s → 41.60
    //   • 120s → 41.20     • 300s → 40.00
    // The numbers stay close to the raw points but the two-decimal precision
    // guarantees a unique ordering for tied-point players.
    function calcScore(points, timeSec) {
        if (points <= 0) return 0;
        if (timeSec <= 0) timeSec = 1;
        const timeBonus = 1 + Math.max(0, 300 - timeSec) / 6000;
        return parseFloat((points * timeBonus).toFixed(2));
    }

    function formatTime(sec) {
        sec = Math.round(sec);
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
    }

    function formatTimeClock(sec) {
        sec = Math.round(sec);
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    // ── Init ──
    function init(opts) {
        canvas = opts.canvas;
        ctx = opts.ctx;
        slug = opts.slug;
        if (opts.onRestart) onRestartCb = opts.onRestart;
        if (opts.container) lbContainer = opts.container;

        // Listen for clicks (Try Again)
        canvas.addEventListener('click', handleCanvasClick);
        canvas.addEventListener('touchend', handleCanvasTouch);

        // Listen for leaderboard data from parent
        window.addEventListener('message', handleMessage);

        // Request leaderboard data
        requestData();

        // Inject leaderboard panel styles
        injectStyles();
    }

    function handleMessage(e) {
        if (e.data?.type === 'LEADERBOARD_DATA') {
            const apiEntries = e.data.entries;
            if (!Array.isArray(apiEntries)) return;
            if (e.data.playerName) playerName = e.data.playerName;

            const mapped = apiEntries.map(entry => ({
                name: entry.name || 'Unknown',
                points: entry.points || 0,
                time: entry.time || 0,
                score: entry.score || 0,
                isPlayer: playerName && (entry.name || '').toLowerCase() === playerName.toLowerCase(),
            }));

            entries = mapped.slice(0, MAX_ENTRIES);

            if (lbIsOpen) renderLbRows();

            if (_isGameOver && gameOverResult) {
                const playerScore = gameOverResult.score;
                const playerIdx = mapped.findIndex(en => en.isPlayer);
                const rank = playerIdx >= 0 ? playerIdx + 1 : mapped.length + 1;
                gameOverResult = { entries: mapped.slice(0, 10), score: playerScore, rank };
                // Force end-screen to re-render once with the fresh data
                _gameOverCacheKey = '';
            }
        }
    }

    function requestData() {
        // PERF: Throttle leaderboard fetches. Each request is a parent → backend
        // round-trip; spamming it (e.g. user toggling the panel quickly, or the
        // game-over screen redrawing on every frame) caused noticeable lag.
        // We allow at most one request per CACHE_MS window.
        const CACHE_MS = 5000;
        const now = Date.now();
        if (now - _lastRequestAt < CACHE_MS) return;
        _lastRequestAt = now;
        try {
            window.parent.postMessage({ type: 'REQUEST_LEADERBOARD', game: slug }, '*');
        } catch (e) {}
    }

    // ── Add entry locally ──
    // The leaderboard table always shows the player's BEST run (matching
    // the backend's best-score-only logic) — never a worse current run.
    // The current run's score is still returned for the big header number.
    function addEntry(name, points, timeSec) {
        const sc = calcScore(points, timeSec);
        const newEntry = { name, points, time: Math.round(timeSec), score: sc, isPlayer: true };
        const existing = entries.find(e => e.isPlayer);
        const playerEntry = (existing && existing.score > sc) ? existing : newEntry;
        const merged = [...entries.filter(e => !e.isPlayer), playerEntry];
        merged.sort((a, b) => b.score - a.score);
        const top = merged.slice(0, MAX_ENTRIES);
        entries = top;
        const rank = top.findIndex(e => e.isPlayer) + 1;
        return { entries: top, score: sc, rank: rank || top.length + 1 };
    }

    // ══════════════════════════════════════════
    //  Game Over — Canvas Drawing
    // ══════════════════════════════════════════

    function gameOver(points, timeSec) {
        _isGameOver = true;
        gamePoints = points;
        gameTime = Math.round(timeSec);
        gameOverResult = null;
        tryAgainBtn = null;
        _gameOverCache = null;
        _gameOverCacheKey = '';
    }

    // PERF: Public entry point. Game-over screen content is static once
    // the leaderboard data lands, so we render it ONCE into an offscreen
    // canvas keyed by (size, score, rank, entries-snapshot). Subsequent
    // calls just blit that cached bitmap — saves dozens of fillText /
    // gradient / stroke ops per frame at 60fps.
    function drawGameOver() {
        if (!_isGameOver) return;

        // Build a cache-busting key. If anything that affects the visuals
        // changes, the key changes and we re-render once.
        const entriesSig = gameOverResult
            ? gameOverResult.entries.map(e => `${e.name}:${e.score}`).join('|')
            : '';
        const key = `${canvas.width}x${canvas.height}|${gamePoints}|${gameTime}|${gameOverResult ? gameOverResult.rank : 'no'}|${entriesSig}`;

        if (key !== _gameOverCacheKey || !_gameOverCache) {
            // (Re)render into the offscreen cache canvas.
            if (!_gameOverCache
                || _gameOverCache.width !== canvas.width
                || _gameOverCache.height !== canvas.height) {
                _gameOverCache = document.createElement('canvas');
                _gameOverCache.width = canvas.width;
                _gameOverCache.height = canvas.height;
            }
            const realCtx = ctx;
            const realCanvas = canvas;
            ctx = _gameOverCache.getContext('2d');
            canvas = _gameOverCache;
            // tryAgainBtn coords stay valid since cache is same size as canvas.
            _drawGameOverInner();
            ctx = realCtx;
            canvas = realCanvas;
            _gameOverCacheKey = key;
        }

        // Blit the cached overlay onto the real canvas.
        ctx.drawImage(_gameOverCache, 0, 0);
    }

    function _drawGameOverInner() {
        const finalScore = calcScore(gamePoints, gameTime);
        const cx = canvas.width / 2;
        const W = canvas.width;
        const H = canvas.height;

        if (!gameOverResult) {
            const displayName = playerName || 'You';
            gameOverResult = addEntry(displayName, gamePoints, gameTime);
            try {
                window.parent.postMessage({
                    type: 'GAME_OVER',
                    game: slug,
                    points: gamePoints,
                    time: gameTime,
                    score: finalScore
                }, '*');
            } catch (e) {}
        }

        const lbEntries = gameOverResult.entries.slice(0, 10);
        const playerRank = gameOverResult.rank;

        // ── Full overlay ──
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const F = (px) => Math.round(W * px / 400);

        // ── Card ──
        const cardW = W * 0.92;
        const cardH = H * 0.88;
        const cardL = (W - cardW) / 2;
        const cardT = (H - cardH) / 2;
        const cardR = F(14);
        const pad = F(14);

        // Vertical scale factor: how much vertical space we have vs ideal
        const idealCardH = F(480); // ideal card height at 400px wide
        const vScale = Math.min(1, cardH / idealCardH);
        const V = (px) => Math.round(F(px) * vScale);

        ctx.fillStyle = '#0c0c24';
        ctx.beginPath();
        ctx.roundRect(cardL, cardT, cardW, cardH, cardR);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(cardL, cardT, cardW, cardH, cardR);
        ctx.stroke();

        // Top accent
        ctx.fillStyle = 'rgba(255, 71, 87, 0.15)';
        ctx.fillRect(cardL + 1, cardT + 1, cardW - 2, F(4));

        let y = cardT + V(36);

        // ══ GAME OVER ══
        ctx.fillStyle = '#ff4757';
        ctx.font = `bold ${V(28)}px Arial`;
        ctx.fillText('GAME OVER', cx, y);
        y += V(40);

        // ══ Big score ══
        ctx.fillStyle = '#ffd93d';
        ctx.font = `bold ${V(44)}px Arial`;
        ctx.fillText(finalScore, cx, y);
        y += V(28);

        ctx.fillStyle = '#666';
        ctx.font = `bold ${V(10)}px Arial`;
        ctx.fillText('S C O R E', cx, y);
        y += V(18);

        // ══ Stats row ══
        const boxGap = F(8);
        const boxW = (cardW - pad * 2 - boxGap * 2) / 3;
        const boxH = V(48);          // taller box → more breathing room around labels
        const boxL = cardL + pad;
        const boxR2 = F(8);

        const timeStr = formatTimeClock(gameTime);

        const statBoxes = [
            { label: 'POINTS', value: String(gamePoints), color: '#ff6b6b' },
            { label: 'TIME', value: timeStr, color: '#00e5ff' },
            { label: 'RANK', value: `#${playerRank}`, color: playerRank <= 3 ? '#ffd93d' : '#a855f7' },
        ];

        statBoxes.forEach((s, i) => {
            const bx = boxL + i * (boxW + boxGap);

            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.beginPath();
            ctx.roundRect(bx, y, boxW, boxH, boxR2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(bx, y, boxW, boxH, boxR2);
            ctx.stroke();

            const bcx = bx + boxW / 2;

            ctx.fillStyle = '#555';
            ctx.font = `bold ${V(9)}px Arial`;
            ctx.fillText(s.label, bcx, y + boxH * 0.36);

            ctx.fillStyle = s.color;
            ctx.font = `bold ${V(15)}px Arial`;
            ctx.fillText(s.value, bcx, y + boxH * 0.74);
        });

        y += boxH + V(20);

        // ══ Button (reserve space at bottom first) ══
        const btnH = V(38);
        const btnBottomMargin = V(16);
        const btnY = cardT + cardH - btnBottomMargin - btnH;
        const btnW = cardW * 0.65;
        const btnX = cx - btnW / 2;
        const btnR3 = F(6);

        // ══ Leaderboard section (fills space between stats and button) ══
        const lbBottom = btnY - V(10); // gap above button
        const lbAvailable = lbBottom - y;

        if (lbAvailable > V(30)) {
            // Leaderboard header
            ctx.fillStyle = '#ffd93d';
            ctx.font = `bold ${V(13)}px Arial`;
            ctx.textAlign = 'left';
            ctx.fillText('🏆  TOP 10', cardL + pad, y);
            ctx.textAlign = 'center';

            y += V(10);
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cardL + pad, y);
            ctx.lineTo(cardL + cardW - pad, y);
            ctx.stroke();
            y += V(6);

            // Column headers
            const innerW = cardW - pad * 2;
            const cols = {
                rank:  cardL + pad + innerW * 0.06,
                name:  cardL + pad + innerW * 0.30,
                pts:   cardL + pad + innerW * 0.54,
                time:  cardL + pad + innerW * 0.74,
                score: cardL + pad + innerW * 0.93,
            };

            ctx.fillStyle = '#555';
            ctx.font = `bold ${V(9)}px Arial`;
            ['#', 'NAME', 'PTS', 'TIME', 'SCORE'].forEach((lbl, i) => {
                ctx.fillText(lbl, [cols.rank, cols.name, cols.pts, cols.time, cols.score][i], y);
            });
            y += V(12);

            // Rows — fit as many as possible
            const rowSpace = lbBottom - y;
            const idealRowH = V(20);
            const maxRows = Math.max(1, Math.floor(rowSpace / idealRowH));
            const rowH = Math.min(idealRowH, Math.floor(rowSpace / Math.min(lbEntries.length, maxRows)));
            const visibleEntries = lbEntries.slice(0, maxRows);
            const rowFont = Math.min(V(11), Math.round(rowH * 0.5));
            const medals = ['🥇', '🥈', '🥉'];
            const medalColors = ['#ffd93d', '#c0c0c0', '#cd7f32'];
            const rowTextColors = ['#e8d48f', '#c8c8c8', '#c9a06c'];

            visibleEntries.forEach((e, i) => {
                const ry = y + rowH * i;
                const rcy = ry + rowH / 2;
                const isP = !!e.isPlayer;

                if (isP) {
                    ctx.fillStyle = 'rgba(0, 229, 255, 0.1)';
                    ctx.beginPath();
                    ctx.roundRect(cardL + pad - F(4), ry, innerW + F(8), rowH, F(4));
                    ctx.fill();
                    ctx.fillStyle = '#00e5ff';
                    ctx.beginPath();
                    ctx.roundRect(cardL + pad - F(4), ry + F(3), F(3), rowH - F(6), 2);
                    ctx.fill();
                } else if (i % 2 === 0) {
                    ctx.fillStyle = 'rgba(255,255,255,0.02)';
                    ctx.fillRect(cardL + pad, ry, innerW, rowH);
                }

                const baseCol = i < 3 ? rowTextColors[i] : (isP ? '#00e5ff' : '#aaa');
                const rkCol   = i < 3 ? medalColors[i] : (isP ? '#00e5ff' : '#aaa');

                ctx.fillStyle = rkCol;
                ctx.font = `bold ${Math.min(V(13), Math.round(rowH * 0.6))}px Arial`;
                if (i < 3) {
                    ctx.fillText(medals[i], cols.rank, rcy);
                } else {
                    ctx.fillText(String(i + 1), cols.rank, rcy);
                }

                ctx.fillStyle = isP ? '#00e5ff' : baseCol;
                ctx.font = isP ? `bold ${rowFont}px Arial` : `${rowFont}px Arial`;
                ctx.fillText(isP ? `${e.name} ✦` : e.name, cols.name, rcy);

                ctx.fillStyle = baseCol;
                ctx.font = `${rowFont}px Arial`;
                ctx.fillText(e.points, cols.pts, rcy);
                ctx.fillText(formatTime(e.time), cols.time, rcy);

                ctx.fillStyle = isP ? '#00e5ff' : (i < 3 ? medalColors[i] : '#00e5ff');
                ctx.font = `bold ${rowFont}px Arial`;
                ctx.fillText(e.score, cols.score, rcy);
            });
        }

        // ══ Try Again button ══

        // Drop shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.roundRect(btnX + 2, btnY + 3, btnW, btnH, btnR3);
        ctx.fill();

        // Gradient body — matches Start Game button (game color → purple)
        ctx.save();
        const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY + btnH);
        btnGrad.addColorStop(0, '#00e5ff');
        btnGrad.addColorStop(1, '#a855f7');
        ctx.fillStyle = btnGrad;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, btnR3);
        ctx.fill();

        // Subtle glow shadow
        ctx.shadowColor = 'rgba(0,229,255,0.35)';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, btnR3);
        ctx.fill();
        ctx.restore();

        // Button text
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${F(17)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⟳  Try Again', cx, btnY + btnH / 2);

        tryAgainBtn = { x: btnX, y: btnY, w: btnW, h: btnH };
    }

    // ── Click / Touch handling ──
    function getCanvasPos(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
        };
    }

    function hitTest(px, py) {
        if (!tryAgainBtn) return false;
        const b = tryAgainBtn;
        return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
    }

    function handleCanvasClick(e) {
        if (!_isGameOver || !tryAgainBtn) return;
        const pos = getCanvasPos(e.clientX, e.clientY);
        if (hitTest(pos.x, pos.y)) {
            restart();
        }
    }

    function handleCanvasTouch(e) {
        if (!_isGameOver || !tryAgainBtn) return;
        e.preventDefault();
        const touch = e.changedTouches[0];
        if (!touch) return;
        const pos = getCanvasPos(touch.clientX, touch.clientY);
        if (hitTest(pos.x, pos.y)) {
            restart();
        }
    }

    function restart() {
        // Notify parent so paid games can intercept
        try {
            window.parent.postMessage({ type: 'TRY_AGAIN', game: slug }, '*');
        } catch (e) {}
        _isGameOver = false;
        gameOverResult = null;
        tryAgainBtn = null;
        gamePoints = 0;
        gameTime = 0;
        if (onRestartCb) onRestartCb();
    }

    // ══════════════════════════════════════════
    //  Leaderboard Panel (DOM)
    // ══════════════════════════════════════════

    let lbPanel = null;
    let lbIsOpen = false;
    let lbOnOpenCb = null;
    let lbOnCloseCb = null;

    function injectStyles() {
        if (document.getElementById('gz-sdk-styles')) return;
        const style = document.createElement('style');
        style.id = 'gz-sdk-styles';
        style.textContent = `
#gz-lb-panel {
    position: absolute;
    top: 0;
    left: 100%;
    width: 300px;
    height: auto;
    background: linear-gradient(180deg, #13132e 0%, #0a0a1e 100%);
    border: 2px solid rgba(0, 255, 255, 0.25);
    border-left: 1px solid rgba(0, 255, 255, 0.12);
    border-radius: 0 14px 14px 0;
    box-shadow: 4px 0 30px rgba(0,255,255,0.12), 2px 0 20px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transform: translateX(0);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1000;
    font-family: Arial, sans-serif;
}
#gz-lb-panel.gz-lb-open {
    opacity: 1;
    pointer-events: auto;
}
#gz-lb-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    background: linear-gradient(180deg, rgba(255,255,255,0.05), transparent);
    border-bottom: 1px solid rgba(255,255,255,0.08);
}
#gz-lb-title {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: #ffd93d;
    text-shadow: 0 0 10px rgba(255,217,61,0.4);
}
#gz-lb-close {
    background: none;
    border: 1px solid rgba(255,255,255,0.15);
    color: #aaa;
    font-size: 20px;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, color 0.2s;
}
#gz-lb-close:hover {
    background: rgba(255,80,80,0.2);
    color: #ff6b6b;
}
#gz-lb-table-wrap {
    overflow-y: auto;
    padding: 10px 16px 16px;
}
#gz-lb-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}
#gz-lb-table thead th {
    text-transform: uppercase;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #6c7a89;
    padding: 7px 5px;
    text-align: left;
    border-bottom: 1px solid rgba(255,255,255,0.06);
}
#gz-lb-table thead th:first-child { text-align: center; width: 24px; }
#gz-lb-table thead th:last-child  { text-align: right; }
#gz-lb-table tbody tr {
    transition: background 0.15s;
}
#gz-lb-table tbody tr:hover {
    background: rgba(255,255,255,0.03);
}
#gz-lb-table tbody td {
    padding: 8px 5px;
    color: #bbb;
    border-bottom: 1px solid rgba(255,255,255,0.03);
}
#gz-lb-table tbody td:first-child {
    text-align: center;
    font-weight: 700;
    color: #666;
}
#gz-lb-table tbody td:last-child {
    text-align: right;
}
.gz-lb-score {
    font-weight: 800;
    color: #00e5ff !important;
    text-shadow: 0 0 6px rgba(0,229,255,0.3);
}
.gz-lb-gold td:first-child   { color: #ffd93d !important; text-shadow: 0 0 6px rgba(255,217,61,0.5); }
.gz-lb-silver td:first-child  { color: #c0c0c0 !important; text-shadow: 0 0 4px rgba(192,192,192,0.4); }
.gz-lb-bronze td:first-child  { color: #cd7f32 !important; text-shadow: 0 0 4px rgba(205,127,50,0.4); }
.gz-lb-gold td   { color: #e8d48f !important; }
.gz-lb-silver td { color: #c8c8c8 !important; }
.gz-lb-bronze td { color: #c9a06c !important; }
.gz-lb-you td { color: #00e5ff !important; font-weight: 700; }

@media (max-width: 768px) {
    #gz-lb-panel {
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%) scale(0.9);
        opacity: 0;
        pointer-events: none;
        width: 88vw;
        height: auto;
        max-height: 75vh;
        border-radius: 14px;
        border: 2px solid rgba(0, 255, 255, 0.25);
        transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease;
    }
    #gz-lb-panel.gz-lb-open {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
        pointer-events: auto;
    }
    #gz-lb-panel.gz-lb-open::before {
        content: '';
        position: fixed;
        inset: -200vh -200vw;
        background: rgba(0,0,0,0.6);
        z-index: -1;
    }
}
        `;
        document.head.appendChild(style);
    }

    function createLbPanel() {
        if (lbPanel) return;

        // Use provided container, or parent of canvas, or body
        const container = lbContainer || canvas.parentElement || document.body;

        lbPanel = document.createElement('div');
        lbPanel.id = 'gz-lb-panel';
        lbPanel.innerHTML = `
            <div id="gz-lb-header">
                <span id="gz-lb-title">🏆 Leaderboard</span>
                <button id="gz-lb-close">&times;</button>
            </div>
            <div id="gz-lb-table-wrap">
                <table id="gz-lb-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Name</th>
                            <th>Pts</th>
                            <th>Time</th>
                            <th>Score</th>
                        </tr>
                    </thead>
                    <tbody id="gz-lb-body"></tbody>
                </table>
            </div>
        `;
        container.appendChild(lbPanel);

        document.getElementById('gz-lb-close').addEventListener('click', () => closeLeaderboard());
    }

    function renderLbRows() {
        const tbody = document.getElementById('gz-lb-body');
        if (!tbody) return;
        const data = entries.slice(0, MAX_ENTRIES);
        tbody.innerHTML = '';
        data.forEach((e, i) => {
            const tr = document.createElement('tr');
            if (i === 0) tr.classList.add('gz-lb-gold');
            else if (i === 1) tr.classList.add('gz-lb-silver');
            else if (i === 2) tr.classList.add('gz-lb-bronze');
            if (e.isPlayer) tr.classList.add('gz-lb-you');
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td>${e.name}${e.isPlayer ? ' (you)' : ''}</td>
                <td>${e.points}</td>
                <td>${formatTime(e.time)}</td>
                <td class="gz-lb-score">${e.score}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function openLeaderboard() {
        requestData();
        createLbPanel();
        renderLbRows();
        lbPanel.classList.add('gz-lb-open');
        lbIsOpen = true;
        if (lbOnOpenCb) lbOnOpenCb();
    }

    function closeLeaderboard() {
        if (lbPanel) lbPanel.classList.remove('gz-lb-open');
        lbIsOpen = false;
        if (lbOnCloseCb) lbOnCloseCb();
    }

    function toggleLeaderboard() {
        lbIsOpen ? closeLeaderboard() : openLeaderboard();
    }

    // ── Public API ──
    return {
        init,
        gameOver,
        drawGameOver,
        restart,
        toggleLeaderboard,
        openLeaderboard,
        closeLeaderboard,
        onLeaderboardOpen(cb) { lbOnOpenCb = cb; },
        onLeaderboardClose(cb) { lbOnCloseCb = cb; },
        calcScore,
        formatTime,
        requestData,
        get isGameOver() { return _isGameOver; },
        get isLeaderboardOpen() { return lbIsOpen; },
        get entries() { return entries.slice(0, MAX_ENTRIES); },
    };
})();
