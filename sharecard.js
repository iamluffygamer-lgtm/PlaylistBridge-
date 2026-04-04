/**
 * PlaylistBridge — sharecard.js
 * Generates a shareable playlist image card using Canvas
 * Shows album art, song titles, artists, branding
 */

const ShareCard = (() => {

    const CARD_W   = 1080;
    const CARD_H   = 1350; // 4:5 ratio — perfect for Instagram
    const MAX_SONGS = 5;

    // ── Main entry point ──────────────────────────────────
    async function generate(tracks) {
        const songs = tracks.slice(0, MAX_SONGS);

        const canvas  = document.createElement('canvas');
        canvas.width  = CARD_W;
        canvas.height = CARD_H;
        const ctx     = canvas.getContext('2d');

        // 1. Background
        await drawBackground(ctx, songs);

        // 2. Header
        drawHeader(ctx);

        // 3. Song rows
        await drawSongs(ctx, songs);

        // 4. Footer
        drawFooter(ctx);

        return canvas;
    }

    // ── Background ────────────────────────────────────────
    async function drawBackground(ctx, songs) {
        // Try to use first song's album art as blurred bg
        const firstImage = songs[0]?.image;
        if (firstImage) {
            try {
                const img = await loadImage(firstImage);
                // Draw blurred scaled image
                ctx.save();
                ctx.filter = 'blur(60px) brightness(0.25) saturate(1.5)';
                ctx.drawImage(img, -100, -100, CARD_W + 200, CARD_H + 200);
                ctx.restore();
                ctx.filter = 'none';
            } catch { drawFallbackBg(ctx); }
        } else {
            drawFallbackBg(ctx);
        }

        // Dark overlay for readability
        const overlay = ctx.createLinearGradient(0, 0, 0, CARD_H);
        overlay.addColorStop(0,   'rgba(8, 8, 14, 0.85)');
        overlay.addColorStop(0.5, 'rgba(8, 8, 14, 0.75)');
        overlay.addColorStop(1,   'rgba(8, 8, 14, 0.92)');
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, CARD_W, CARD_H);

        // Subtle purple glow top-left
        const glow = ctx.createRadialGradient(200, 200, 0, 200, 200, 600);
        glow.addColorStop(0,   'rgba(108, 99, 255, 0.18)');
        glow.addColorStop(1,   'rgba(108, 99, 255, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, CARD_W, CARD_H);
    }

    function drawFallbackBg(ctx) {
        const grad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
        grad.addColorStop(0,   '#0a0a14');
        grad.addColorStop(0.5, '#0f0f1a');
        grad.addColorStop(1,   '#08080f');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CARD_W, CARD_H);
    }

    // ── Header ────────────────────────────────────────────
    function drawHeader(ctx) {
        const pad = 72;
        const y   = 90;

        // PB logo circle
        ctx.beginPath();
        ctx.arc(pad + 28, y + 28, 28, 0, Math.PI * 2);
        const logoGrad = ctx.createLinearGradient(pad, y, pad + 56, y + 56);
        logoGrad.addColorStop(0, '#6c63ff');
        logoGrad.addColorStop(1, '#9d97ff');
        ctx.fillStyle = logoGrad;
        ctx.fill();

        // PB text inside circle
        ctx.fillStyle    = '#ffffff';
        ctx.font         = 'bold 22px system-ui';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PB', pad + 28, y + 29);

        // Brand name
        ctx.fillStyle    = '#ffffff';
        ctx.font         = 'bold 36px system-ui';
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('PlaylistBridge', pad + 72, y + 38);

        // Tagline
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font      = '26px system-ui';
        ctx.fillText('My playlist, ready to play', pad + 72, y + 72);

        // Divider line
        ctx.strokeStyle = 'rgba(108,99,255,0.4)';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(pad, y + 108);
        ctx.lineTo(CARD_W - pad, y + 108);
        ctx.stroke();
    }

    // ── Songs ─────────────────────────────────────────────
    async function drawSongs(ctx, songs) {
        const pad      = 72;
        const startY   = 260;
        const rowH     = 176;
        const artSize  = 110;
        const radius   = 16;

        for (let i = 0; i < songs.length; i++) {
            const song = songs[i];
            const y    = startY + i * rowH;

            // Row background pill
            ctx.save();
            roundRect(ctx, pad - 16, y - 16, CARD_W - (pad - 16) * 2, rowH - 20, 20);
            ctx.fillStyle = i === 0
                ? 'rgba(108,99,255,0.18)'
                : 'rgba(255,255,255,0.04)';
            ctx.fill();
            ctx.restore();

            // Track number
            ctx.fillStyle    = i === 0 ? '#6c63ff' : 'rgba(255,255,255,0.25)';
            ctx.font         = `${i === 0 ? 'bold' : 'normal'} 28px system-ui`;
            ctx.textAlign    = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(i + 1, pad + 24, y + artSize / 2);

            // Album art
            const artX = pad + 40;
            const artY = y;
            if (song.image) {
                try {
                    const img = await loadImage(song.image);
                    ctx.save();
                    roundRect(ctx, artX, artY, artSize, artSize, radius);
                    ctx.clip();
                    ctx.drawImage(img, artX, artY, artSize, artSize);
                    ctx.restore();

                    // Subtle art border
                    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                    ctx.lineWidth   = 2;
                    ctx.save();
                    roundRect(ctx, artX, artY, artSize, artSize, radius);
                    ctx.stroke();
                    ctx.restore();
                } catch { drawArtFallback(ctx, artX, artY, artSize, radius, song.title); }
            } else {
                drawArtFallback(ctx, artX, artY, artSize, radius, song.title);
            }

            // Song title
            const textX = artX + artSize + 28;
            const maxW  = CARD_W - textX - pad;
            ctx.fillStyle    = '#f0f0f2';
            ctx.font         = `bold ${i === 0 ? '38px' : '34px'} system-ui`;
            ctx.textAlign    = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(truncate(ctx, song.title || song.query, maxW), textX, y + 48);

            // Artist
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font      = '28px system-ui';
            ctx.fillText(truncate(ctx, song.artist || '', maxW), textX, y + 88);

            // Now playing indicator for first song
            if (i === 0) {
                drawNowPlaying(ctx, textX, y + 120);
            }
        }
    }

    function drawArtFallback(ctx, x, y, size, radius, title) {
        ctx.save();
        roundRect(ctx, x, y, size, size, radius);
        const grad = ctx.createLinearGradient(x, y, x + size, y + size);
        grad.addColorStop(0, '#1f1f2e');
        grad.addColorStop(1, '#2a2a40');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();

        ctx.fillStyle    = 'rgba(255,255,255,0.2)';
        ctx.font         = 'bold 36px system-ui';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((title || '?')[0].toUpperCase(), x + size / 2, y + size / 2);
    }

    function drawNowPlaying(ctx, x, y) {
        // Three animated bars (static in canvas)
        const barW = 6;
        const gap  = 5;
        const heights = [22, 34, 18, 28, 14];
        ctx.fillStyle = '#6c63ff';
        heights.forEach((h, i) => {
            const bx = x + i * (barW + gap);
            ctx.beginPath();
            ctx.roundRect?.(bx, y + 34 - h, barW, h, 3) ||
                ctx.rect(bx, y + 34 - h, barW, h);
            ctx.fill();
        });

        ctx.fillStyle    = '#6c63ff';
        ctx.font         = ''  + '22px system-ui';
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('Now Playing', x + heights.length * (barW + gap) + 12, y + 18);
    }

    // ── Footer ────────────────────────────────────────────
    function drawFooter(ctx) {
        const pad = 72;
        const y   = CARD_H - 110;

        // Divider
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(CARD_W - pad, y);
        ctx.stroke();

        // Left — URL
        ctx.fillStyle    = 'rgba(255,255,255,0.35)';
        ctx.font         = '26px system-ui';
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('playlistbridge.netlify.app', pad, y + 54);

        // Right — CTA
        ctx.fillStyle    = '#6c63ff';
        ctx.font         = 'bold 26px system-ui';
        ctx.textAlign    = 'right';
        ctx.fillText('Play this playlist →', CARD_W - pad, y + 54);
    }

    // ── Helpers ───────────────────────────────────────────
    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img   = new Image();
            img.crossOrigin = 'anonymous';
            img.onload  = () => resolve(img);
            img.onerror = reject;
            // Use higher res iTunes art (replace 60 with 300)
            img.src = src.replace('60x60', '300x300').replace('100x100', '300x300');
        });
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function truncate(ctx, text, maxWidth) {
        if (!text) return '';
        if (ctx.measureText(text).width <= maxWidth) return text;
        while (text.length > 0 && ctx.measureText(text + '…').width > maxWidth) {
            text = text.slice(0, -1);
        }
        return text + '…';
    }

    // ── Share / Download ──────────────────────────────────
    async function shareOrDownload(tracks) {
        const canvas = await generate(tracks);

        canvas.toBlob(async (blob) => {
            const file = new File([blob], 'my-playlist.png', { type: 'image/png' });

            // Try native share first (mobile)
            if (navigator.share && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'My Playlist — PlaylistBridge',
                        text:  'Check out this playlist I made with PlaylistBridge 🎧',
                    });
                    return;
                } catch (e) {
                    if (e.name === 'AbortError') return; // user cancelled
                }
            }

            // Fallback: download the image
            const url = URL.createObjectURL(blob);
            const a   = document.createElement('a');
            a.href     = url;
            a.download = 'my-playlist.png';
            a.click();
            URL.revokeObjectURL(url);
        }, 'image/png');
    }

    // ── Public ────────────────────────────────────────────
    return { shareOrDownload };

})();

// Expose globally
window.ShareCard = ShareCard;
