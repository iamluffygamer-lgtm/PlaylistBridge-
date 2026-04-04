/**
 * PlaylistBridge — ui.js (v2.1)
 * Pure UI layer. No business logic lives here.
 */
(function () {
    'use strict';

    window.UI = window.UI || {};

    /* ─── Platform metadata (colours + labels) ─── */
    const PLATFORM = {
        spotify:  { label: 'Spotify',  color: '#1db954', bg: 'rgba(29,185,84,0.14)',  border: 'rgba(29,185,84,0.45)'  },
        yt_music: { label: 'YT Music', color: '#f1f1f1', bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.22)' },
        youtube:  { label: 'YouTube',  color: '#ff4444', bg: 'rgba(255,68,68,0.14)',   border: 'rgba(255,68,68,0.45)'  },
    };

    /* ─── Intersection Observer — fade cards in as they scroll into view ─── */
    const cardObserver = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('visible');
                cardObserver.unobserve(e.target);
            }
        });
    }, { threshold: 0.05 });

    /* ─── Navbar shadow on scroll ─── */
    const navbar = document.getElementById('navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            navbar.style.boxShadow = window.scrollY > 10
                ? '0 1px 0 rgba(255,255,255,0.06)'
                : 'none';
        }, { passive: true });
    }

    /* ══════════════════════════════════════════
       PLATFORM THEMING
       Called by script.js whenever platform changes
    ══════════════════════════════════════════ */
    window.UI.applyPlatformTheme = function (platform) {
        document.querySelectorAll('.platform-btn').forEach(btn => {
            const isSelected = btn.classList.contains('selected');
            if (isSelected) {
                const p = PLATFORM[btn.dataset.platform] || PLATFORM.yt_music;
                btn.style.background  = p.bg;
                btn.style.borderColor = p.border;
                btn.style.color       = p.color;
                btn.style.boxShadow   = `0 0 14px ${p.border}`;
            } else {
                btn.style.cssText = '';
            }
        });
    };

    /* ══════════════════════════════════════════
       LOADING STATE
    ══════════════════════════════════════════ */
    window.UI.setLoading = function (isLoading) {
        const btn    = document.getElementById('generateBtn');
        const text   = btn?.querySelector('.btn-generate-text');
        const loader = btn?.querySelector('.btn-generate-loader');
        const kbd    = btn?.querySelector('.btn-kbd');
        if (!btn) return;
        btn.disabled = isLoading;
        text?.classList.toggle('hidden', isLoading);
        loader?.classList.toggle('hidden', !isLoading);
        if (kbd) kbd.style.display = isLoading ? 'none' : '';
    };

    /* ══════════════════════════════════════════
       SKELETON LOADERS
       Grid matches the real card grid so height
       is identical — zero layout shift guaranteed.
    ══════════════════════════════════════════ */
    window.UI.showSkeletons = function (count = 6) {
        const list = document.getElementById('resultsList');
        if (!list) return;
        list.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const li = document.createElement('li');
            li.className = 'skeleton-card';
            li.setAttribute('aria-hidden', 'true');
            li.style.animationDelay = `${i * 70}ms`;
            li.innerHTML = `
                <div class="skeleton skeleton-num"></div>
                <div class="skeleton skeleton-art"></div>
                <div style="flex:1;min-width:0">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-artist"></div>
                </div>
                <div class="skeleton skeleton-btn"></div>`;
            list.appendChild(li);
        }
    };

    /* ══════════════════════════════════════════
       TRACK CARD
    ══════════════════════════════════════════ */
    window.UI.createTrackCard = function ({ index, title, artist, href, platform, image }) {
        const li = document.createElement('li');
        li.className = 'track-card';

        const p = PLATFORM[platform] || { label: 'Open', color: 'var(--accent)', bg: 'var(--accent-soft)', border: 'var(--accent)' };

        li.innerHTML = `
            <div class="track-num">
                <span class="num-val">${index}</span>
                <svg class="track-play-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5v14l11-7z"/>
                </svg>
            </div>
            <div class="track-art-wrap">
                ${image
                    ? `<img class="track-art track-thumb" src="${escapeHTML(image)}" alt="" loading="lazy" crossorigin="anonymous"
        onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">`
                            
                    : ''}
                <div class="track-art-fallback" style="${image ? 'display:none' : ''}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                        <path d="M9 18V5l12-2v13M9 18c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-2c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"/>
                    </svg>
                </div>
            </div>
            <div class="track-info">
                <div class="track-title">${escapeHTML(title)}</div>
                ${artist ? `<div class="track-artist">${escapeHTML(artist)}</div>` : ''}
            </div>
            <a class="track-open"
               href="${escapeHTML(href)}"
               target="_blank"
               rel="noopener noreferrer"
               aria-label="Open ${escapeHTML(title)} on ${p.label}"
               style="color:${p.color};border-color:${p.border};background:${p.bg}20"
            >${p.label} <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity:.55"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>
        `;

        // hover: swap number → play icon
        const numEl  = li.querySelector('.num-val');
        const playEl = li.querySelector('.track-play-icon');
        li.addEventListener('mouseenter', () => { numEl.style.display = 'none'; playEl.style.display = 'block'; });
        li.addEventListener('mouseleave', () => { numEl.style.display = ''; playEl.style.display = 'none'; });

        // click card body → open link
        li.addEventListener('click', (e) => {
            if (e.target.closest('.track-open')) return;
            window.open(href, '_blank', 'noopener,noreferrer');
        });

        cardObserver.observe(li);
        return li;
    };

    window.UI.appendTrackCard = function (opts) {
        const list = document.getElementById('resultsList');
        if (!list) return;
        // First real card clears skeletons
        if (list.querySelector('.skeleton-card')) list.innerHTML = '';
        const card = window.UI.createTrackCard(opts);
        if (opts.query) card.dataset.query = opts.query;
        list.appendChild(card);
    };

    /* ══════════════════════════════════════════
       UPDATE EXISTING CARDS when platform changes
       (in-place update, no re-render, no flicker)
    ══════════════════════════════════════════ */
    window.UI.updateCardLinks = function (getLink, platform) {
        const p = PLATFORM[platform] || PLATFORM.yt_music;
        document.querySelectorAll('.track-card').forEach(card => {
            const query = card.dataset.query;
            if (!query) return;
            const newHref = getLink(query);
            const link = card.querySelector('.track-open');
            if (link) {
                link.href            = newHref;
                link.textContent     = '';        // clear then rebuild
                link.style.color     = p.color;
                link.style.borderColor = p.border;
                link.style.background  = `${p.bg}20`;
                link.innerHTML = `${p.label} <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity:.55"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
            }
            // Also update card click listener
            const oldHandler = card._clickHandler;
            if (oldHandler) card.removeEventListener('click', oldHandler);
            card._clickHandler = (e) => {
                if (e.target.closest('.track-open')) return;
                window.open(newHref, '_blank', 'noopener,noreferrer');
            };
            card.addEventListener('click', card._clickHandler);
        });
    };

    /* ══════════════════════════════════════════
       COUNTS / STATUS / STATUS BAR
    ══════════════════════════════════════════ */
    window.UI.setCount = function (n) {
        const el = document.getElementById('countDisplay');
        if (el) el.textContent = n;
    };

    window.UI.showResults = function () {
        document.getElementById('resultsSection')?.classList.remove('hidden');
    };
    window.UI.hideResults = function () {
        document.getElementById('resultsSection')?.classList.add('hidden');
    };

    window.UI.setStatus = function (msg, type = 'info') {
        const el = document.getElementById('statusMsg');
        if (!el) return;
        el.textContent = msg;
        el.className = 'status-message' + (type === 'error' ? ' error' : '');
    };
    window.UI.clearStatus = function () { window.UI.setStatus(''); };

    window.UI.showStatusBar = function (text = 'Processing…') {
        const bar = document.getElementById('statusBar');
        const txt = document.getElementById('statusText');
        if (txt) txt.textContent = text;
        bar?.classList.remove('hidden');
    };
    window.UI.updateStatusBar = function (text) {
        const el = document.getElementById('statusText');
        if (el) el.textContent = text;
    };
    window.UI.hideStatusBar = function () {
        document.getElementById('statusBar')?.classList.add('hidden');
    };

    /* ══════════════════════════════════════════
       AI BADGE
    ══════════════════════════════════════════ */
    window.UI.showAIBadge = function () { document.getElementById('aiBadge')?.classList.remove('hidden'); };
    window.UI.hideAIBadge = function () { document.getElementById('aiBadge')?.classList.add('hidden'); };

    /* ══════════════════════════════════════════
       PLAY ALL
    ══════════════════════════════════════════ */
    window.UI.showPlayAll = function (href) {
        const btn = document.getElementById('playAllBtn');
        const row = document.getElementById('playAllRow');
        if (btn) { btn.href = href; btn.style.display = 'inline-flex'; }
        if (row) row.style.display = 'block';
    };
    window.UI.hidePlayAll = function () {
        const btn = document.getElementById('playAllBtn');
        const row = document.getElementById('playAllRow');
        if (btn) btn.style.display = 'none';
        if (row) row.style.display = 'none';
        const subtext = document.getElementById('playAllSubtext');
        if (subtext) subtext.textContent = '';
    };

    /* ══════════════════════════════════════════
       SHARE BUTTON SUCCESS STATE
    ══════════════════════════════════════════ */
    window.UI.setShareSuccess = function () {
        const btn = document.getElementById('shareBtn');
        if (!btn) return;
        const orig = btn.innerHTML;
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
        btn.style.borderColor = 'var(--green)';
        btn.style.color = 'var(--green)';
        setTimeout(() => {
            btn.innerHTML = orig;
            btn.style.borderColor = '';
            btn.style.color = '';
        }, 2200);
    };

    /* ══════════════════════════════════════════
       COMMUNITY MODAL
    ══════════════════════════════════════════ */
    window.UI.renderCommunityCard = function (data, id, onOpen) {
        const p = PLATFORM[data.platform] || { label: data.platform, color: 'var(--accent)' };
        const preview = data.songs.slice(0, 3).map(s => escapeHTML(s)).join('<br>');
        const more    = data.songs.length > 3 ? `<br><em style="color:var(--text-muted)">+${data.songs.length - 3} more</em>` : '';
        const card = document.createElement('div');
        card.className = 'community-card';
        card.innerHTML = `
            <div class="community-info">
                <span class="community-platform" style="color:${p.color}">${p.label}</span>
                <div class="community-tracks">${preview}${more}</div>
                <div class="community-meta">${data.songs.length} tracks · ${data.views || 0} plays</div>
            </div>
            <button class="btn-primary open-btn" style="font-size:13px;padding:8px 14px;flex-shrink:0">Open →</button>`;
        card.querySelector('.open-btn').addEventListener('click', () => onOpen(id));
        return card;
    };
    window.UI.appendCommunityCard = function (data, id, onOpen) {
        document.getElementById('modalTrendingList')?.appendChild(window.UI.renderCommunityCard(data, id, onOpen));
    };
    window.UI.clearCommunityList = function () {
        const el = document.getElementById('modalTrendingList');
        if (el) el.innerHTML = '';
    };
    window.UI.showModalEmpty = function () {
        const el = document.getElementById('modalTrendingList');
        if (el) el.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:24px;text-align:center">No community playlists yet.</p>';
    };
    window.UI.showModalError = function () {
        const el = document.getElementById('modalTrendingList');
        if (el) el.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:24px;text-align:center">Failed to load. Try again later.</p>';
    };
    window.UI.showModalLoading = function () {
        const el = document.getElementById('modalTrendingList');
        if (!el) return;
        el.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const sk = document.createElement('div');
            sk.className = 'skeleton-card';
            sk.style.cssText = 'min-height:80px;border-radius:var(--r-md)';
            sk.style.animationDelay = `${i * 100}ms`;
            sk.setAttribute('aria-hidden', 'true');
            el.appendChild(sk);
        }
    };

    /* ══════════════════════════════════════════
       FEEDBACK
    ══════════════════════════════════════════ */
    window.UI.setFeedbackStatus = function (msg, isError = false) {
        const el = document.getElementById('feedbackStatus');
        if (!el) return;
        el.textContent = msg;
        el.style.color = isError ? 'var(--red)' : 'var(--green)';
        el.classList.remove('hidden');
    };

    /* ══════════════════════════════════════════
       FULL RESET
    ══════════════════════════════════════════ */
    window.UI.reset = function () {
        window.UI.hideResults();
        window.UI.hideStatusBar();
        window.UI.clearStatus();
        window.UI.hideAIBadge();
        window.UI.setCount(0);
        window.UI.hidePlayAll();
        window.UI.setLoading(false);
        const list = document.getElementById('resultsList');
        if (list) list.innerHTML = '';
        document.getElementById('feedbackSection')?.classList.add('hidden');
        document.getElementById('bulkActions')?.classList.add('hidden');
        document.getElementById('copyAllBtn')?.classList.add('hidden');
        document.getElementById('openAllBtn')?.classList.add('hidden');
    };

    /* ══════════════════════════════════════════
       MICRO-INTERACTIONS
    ══════════════════════════════════════════ */

    // Textarea auto-grow
    const textarea = document.getElementById('songInput');
    if (textarea) {
        textarea.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 420) + 'px';
        });
    }

    // Example chip flash on click
    document.querySelectorAll('.example-chip').forEach(chip => {
        chip.addEventListener('click', function () {
            this.style.background   = 'var(--accent-soft)';
            this.style.borderColor  = 'var(--accent)';
            this.style.color        = 'var(--accent)';
            setTimeout(() => { this.style.cssText = ''; }, 500);
        });
    });

    /* ─── util ─── */
    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
    window.UI.escapeHTML = escapeHTML;

    console.log('[PlaylistBridge UI] v2.1 ready');
})();
