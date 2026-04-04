/**
 * PlaylistBridge — sharecard.js (v2.0 Redesign)
 * Catchy shareable card with album art collage header
 * Instagram 4:5 ratio — optimized for stories and feed
 */

const ShareCard = (() => {

    const CARD_W    = 1080;
    const MAX_SONGS = 5;

    // ── Main ──────────────────────────────────────────────
    async function generate(tracks) {
        const songs   = tracks.slice(0, MAX_SONGS);
        const CARD_H  = 420 + songs.length * 158 + 140;

        const canvas  = document.createElement('canvas');
        canvas.width  = CARD_W;
        canvas.height = CARD_H;
        const ctx     = canvas.getContext('2d');

        // Load all images first
        const images = await Promise.all(
            songs.map(s => s.image ? loadImage(s.image).catch(() => null) : Promise.resolve(null))
        );

        await drawBackground(ctx, images, CARD_H);
        await drawArtCollage(ctx, images, songs);
        drawSongList(ctx, songs, images, CARD_H);
        drawBranding(ctx, CARD_H);

        return canvas;
    }

    // ── Background — full bleed blurred art ───────────────
    async function drawBackground(ctx, images, CARD_H) {
        const hero = images.find(Boolean);
        if (hero) {
            ctx.save();
            ctx.filter = 'blur(80px) brightness(0.18) saturate(2)';
            ctx.drawImage(hero, -150, -150, CARD_W + 300, CARD_H + 300);
            ctx.restore();
            ctx.filter = 'none';
        }

        // Base dark fill over blur
        const base = ctx.createLinearGradient(0, 0, 0, CARD_H);
        base.addColorStop(0,    'rgba(6,5,15,0.7)');
        base.addColorStop(0.45, 'rgba(6,5,15,0.82)');
        base.addColorStop(1,    'rgba(6,5,15,0.97)');
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, CARD_W, CARD_H);

        // Purple glow — top right
        const g1 = ctx.createRadialGradient(CARD_W, 0, 0, CARD_W, 0, 700);
        g1.addColorStop(0, 'rgba(108,99,255,0.22)');
        g1.addColorStop(1, 'rgba(108,99,255,0)');
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, CARD_W, CARD_H);

        // Pink glow — bottom left
        const g2 = ctx.createRadialGradient(0, CARD_H, 0, 0, CARD_H, 600);
        g2.addColorStop(0, 'rgba(255,80,180,0.12)');
        g2.addColorStop(1, 'rgba(255,80,180,0)');
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, CARD_W, CARD_H);
    }

    // ── Album art collage — top hero area ─────────────────
    async function drawArtCollage(ctx, images, songs) {
        const collageH = 380;
        const pad      = 56;

        const validImgs = images.map((img, i) => ({ img, song: songs[i] })).filter(x => x.img);

        if (validImgs.length === 0) {
            drawCollgeFallback(ctx, collageH);
            return;
        }

        // Layout: one big left + grid right
        const bigSize  = collageH;
        const smallW   = (CARD_W - pad * 2 - bigSize - 16) / 2;
        const smallH   = (collageH - 8) / 2;

        // Big left art
        if (validImgs[0]) {
            ctx.save();
            roundRect(ctx, pad, pad, bigSize, bigSize, 24);
            ctx.clip();
            ctx.drawImage(validImgs[0].img, pad, pad, bigSize, bigSize);
            ctx.restore();
            // Glow border
            ctx.save();
            ctx.strokeStyle = 'rgba(108,99,255,0.6)';
            ctx.lineWidth   = 3;
            roundRect(ctx, pad, pad, bigSize, bigSize, 24);
            ctx.stroke();
            ctx.restore();
        }

        // Right grid — up to 4 small arts
        const rightX = pad + bigSize + 16;
        const positions = [
            [rightX,           pad],
            [rightX + smallW + 8, pad],
            [rightX,           pad + smallH + 8],
            [rightX + smallW + 8, pad + smallH + 8],
        ];

        for (let i = 0; i < Math.min(4, validImgs.length - 1); i++) {
            const [x, y] = positions[i];
            const item   = validImgs[i + 1];
            if (!item) continue;
            ctx.save();
            roundRect(ctx, x, y, smallW, smallH, 16);
            ctx.clip();
            ctx.drawImage(item.img, x, y, smallW, smallH);
            ctx.restore();
        }

        // Gradient fade bottom of collage into song list
        const fade = ctx.createLinearGradient(0, collageH - 40, 0, collageH + pad + 20);
        fade.addColorStop(0, 'rgba(6,5,15,0)');
        fade.addColorStop(1, 'rgba(6,5,15,1)');
        ctx.fillStyle = fade;
        ctx.fillRect(0, collageH - 40, CARD_W, pad + 60);
    }

    function drawCollgeFallback(ctx, collageH) {
        const grad = ctx.createLinearGradient(0, 0, CARD_W, collageH);
        grad.addColorStop(0, '#1a1730');
        grad.addColorStop(1, '#0d0d1a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CARD_W, collageH);

        ctx.fillStyle    = 'rgba(108,99,255,0.15)';
        ctx.font         = '180px system-ui';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎧', CARD_W / 2, collageH / 2);
    }

    // ── Song list ─────────────────────────────────────────
    function drawSongList(ctx, songs, images, CARD_H) {
        const pad    = 56;
        const startY = 460;
        const rowH   = 158;

        // "MY PLAYLIST" label
        ctx.fillStyle    = 'rgba(108,99,255,0.9)';
        ctx.font         = 'bold 22px system-ui';
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.letterSpacing = '3px';
        ctx.fillText('MY PLAYLIST', pad, startY - 28);
        ctx.letterSpacing = '0px';

        for (let i = 0; i < songs.length; i++) {
            const song  = songs[i];
            const img   = images[i];
            const y     = startY + i * rowH;
            const isTop = i === 0;

            // Row bg — glassy pill
            ctx.save();
            roundRect(ctx, pad - 20, y - 12, CARD_W - (pad - 20) * 2, rowH - 20, 22);
            ctx.fillStyle = isTop
                ? 'rgba(108,99,255,0.2)'
                : 'rgba(255,255,255,0.03)';
            ctx.fill();
            if (isTop) {
                ctx.strokeStyle = 'rgba(108,99,255,0.4)';
                ctx.lineWidth   = 1.5;
                ctx.stroke();
            }
            ctx.restore();

            // Track number
            ctx.fillStyle    = isTop ? '#6c63ff' : 'rgba(255,255,255,0.2)';
            ctx.font         = `bold 30px system-ui`;
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(i + 1, pad + 18, y + 55);

            // Album art — small thumbnail
            const artX = pad + 48;
            const artY = y + 8;
            const artS = 102;
            if (img) {
                ctx.save();
                roundRect(ctx, artX, artY, artS, artS, 14);
                ctx.clip();
                ctx.drawImage(img, artX, artY, artS, artS);
                ctx.restore();
            } else {
                drawMiniArtFallback(ctx, artX, artY, artS, song.title);
            }

            // Text
            const tx   = artX + artS + 24;
            const maxW = CARD_W - tx - pad - 10;

            ctx.fillStyle    = isTop ? '#ffffff' : 'rgba(255,255,255,0.88)';
            ctx.font         = `bold ${isTop ? '40px' : '36px'} system-ui`;
            ctx.textAlign    = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(truncate(ctx, song.title || song.query, maxW), tx, y + 52);

            ctx.fillStyle = isTop ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.38)';
            ctx.font      = '28px system-ui';
            ctx.fillText(truncate(ctx, song.artist || '', maxW), tx, y + 92);

            // Now playing pill on first track
            if (isTop) {
                drawNowPlayingPill(ctx, tx, y + 108);
            }
        }
    }

    function drawMiniArtFallback(ctx, x, y, size, title) {
        ctx.save();
        roundRect(ctx, x, y, size, size, 14);
        const g = ctx.createLinearGradient(x, y, x + size, y + size);
        g.addColorStop(0, '#1e1b3a');
        g.addColorStop(1, '#2d2850');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();

        ctx.fillStyle    = 'rgba(108,99,255,0.5)';
        ctx.font         = `bold 38px system-ui`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((title || '♪')[0].toUpperCase(), x + size / 2, y + size / 2);
    }

    function drawNowPlayingPill(ctx, x, y) {
        // Pill background
        const pillW = 200;
        const pillH = 38;
        ctx.save();
        roundRect(ctx, x, y, pillW, pillH, pillH / 2);
        ctx.fillStyle = 'rgba(108,99,255,0.25)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(108,99,255,0.5)';
        ctx.lineWidth   = 1;
        ctx.stroke();
        ctx.restore();

        // Bars
        const barW = 4;
        const gap  = 4;
        const bx   = x + 14;
        const heights = [14, 22, 10, 18, 12];
        ctx.fillStyle = '#6c63ff';
        heights.forEach((h, i) => {
            const barX = bx + i * (barW + gap);
            ctx.beginPath();
            ctx.roundRect?.(barX, y + (pillH - h) / 2, barW, h, 2) ||
                ctx.rect(barX, y + (pillH - h) / 2, barW, h);
            ctx.fill();
        });

        ctx.fillStyle    = '#a09aff';
        ctx.font         = 'bold 20px system-ui';
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('Now Playing', bx + heights.length * (barW + gap) + 10, y + pillH / 2);
    }

    // ── Branding footer ───────────────────────────────────
    function drawBranding(ctx, CARD_H) {
        const pad = 56;
        const y   = CARD_H - 118;

        // Thin line
        const lineGrad = ctx.createLinearGradient(pad, 0, CARD_W - pad, 0);
        lineGrad.addColorStop(0,   'rgba(108,99,255,0)');
        lineGrad.addColorStop(0.3, 'rgba(108,99,255,0.5)');
        lineGrad.addColorStop(0.7, 'rgba(108,99,255,0.5)');
        lineGrad.addColorStop(1,   'rgba(108,99,255,0)');
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(CARD_W - pad, y);
        ctx.stroke();

        // Logo dot
        ctx.beginPath();
        ctx.arc(pad + 22, y + 55, 22, 0, Math.PI * 2);
        const lg = ctx.createLinearGradient(pad, y + 33, pad + 44, y + 77);
        lg.addColorStop(0, '#6c63ff');
        lg.addColorStop(1, '#9d97ff');
        ctx.fillStyle = lg;
        ctx.fill();

        ctx.fillStyle    = '#fff';
        ctx.font         = 'bold 18px system-ui';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PB', pad + 22, y + 56);

        // Brand name
        ctx.fillStyle    = '#ffffff';
        ctx.font         = 'bold 30px system-ui';
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('PlaylistBridge', pad + 54, y + 46);

        // URL
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font      = '22px system-ui';
        ctx.fillText('playlistbridge.netlify.app', pad + 54, y + 72);

        // CTA right
        // Button pill
        const btnW = 290;
        const btnH = 56;
        const btnX = CARD_W - pad - btnW;
        const btnY = y + 28;
        ctx.save();
        roundRect(ctx, btnX, btnY, btnW, btnH, btnH / 2);
        const btnG = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY);
        btnG.addColorStop(0, '#6c63ff');
        btnG.addColorStop(1, '#9d97ff');
        ctx.fillStyle = btnG;
        ctx.fill();
        ctx.restore();

        ctx.fillStyle    = '#ffffff';
        ctx.font         = 'bold 26px system-ui';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('▶  Play this playlist', btnX + btnW / 2, btnY + btnH / 2);
    }

    // ── Helpers ───────────────────────────────────────────
    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload  = () => resolve(img);
            img.onerror = reject;
            img.src = src
                .replace('60x60bb',  '300x300bb')
                .replace('100x100bb','300x300bb')
                .replace('60x60',    '300x300')
                .replace('100x100',  '300x300');
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
            const file = new File([blob], 'my-playlist-playlistbridge.png', { type: 'image/png' });

            if (navigator.share && navigator.canShare?.({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'My Playlist — PlaylistBridge',
                        text:  '🎧 Check out this playlist — play it instantly at playlistbridge.netlify.app',
                    });
                    return;
                } catch (e) {
                    if (e.name === 'AbortError') return;
                }
            }

            // Desktop fallback — download
            const url = URL.createObjectURL(blob);
            const a   = document.createElement('a');
            a.href     = url;
            a.download = 'my-playlist-playlistbridge.png';
            a.click();
            URL.revokeObjectURL(url);
        }, 'image/png');
    }

    return { shareOrDownload };

})();

window.ShareCard = ShareCard;
