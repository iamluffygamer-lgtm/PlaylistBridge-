/**
 * PlaylistBridge — player.js (v3.0)
 * Mini bar + expandable full-screen player
 * Video / Audio toggle — YouTube Music style
 */

const Player = (() => {

  // ── State ──────────────────────────────────────────────
  let ytPlayer     = null;
  let playlist     = [];
  let currentIndex = -1;
  let isReady      = false;
  let isShuffle    = false;
  let isExpanded   = false;
  let isVideoMode  = false;
  let progressTimer = null;
  const cache      = {};

  // ── DOM refs ───────────────────────────────────────────
  const $  = id => document.getElementById(id);
  const bar         = () => $('pb-player-bar');
  const expanded    = () => $('pb-expanded');
  const btnPlay     = () => $('pb-btn-play');
  const btnPrev     = () => $('pb-btn-prev');
  const btnNext     = () => $('pb-btn-next');
  const btnShuffle  = () => $('pb-btn-shuffle');
  const btnClose    = () => $('pb-btn-close');
  const btnExpand   = () => $('pb-btn-expand');
  const btnCollapse = () => $('pb-btn-collapse');
  const btnVideo    = () => $('pb-btn-video');
  const btnAudio    = () => $('pb-btn-audio');
  const progressEl  = () => $('pb-progress');
  const progressBar = () => $('pb-progress-bar');
  const progressExp = () => $('pb-progress-exp');
  const progressExpBar = () => $('pb-progress-exp-bar');
  const timeEl      = () => $('pb-time');
  const timeExpEl   = () => $('pb-time-exp');
  const loadingEl   = () => $('pb-loading');
  const queueEl     = () => $('pb-queue');

  // ── YouTube IFrame API ─────────────────────────────────
  function loadYTApi() {
    if (window.YT && window.YT.Player) { onYTReady(); return; }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }

  window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('pb-yt-iframe', {
      height: '100%', width: '100%',
      playerVars: { autoplay: 1, controls: 0, playsinline: 1, modestbranding: 1, rel: 0 },
      events: {
        onReady:       () => { isReady = true; },
        onStateChange: onStateChange,
        onError:       onError,
      }
    });
  };

  function onYTReady() { window.onYouTubeIframeAPIReady(); }

  function onStateChange(e) {
    if (e.data === YT.PlayerState.PLAYING) {
      setPlayBtn(true);
      startProgressTimer();
    }
    if (e.data === YT.PlayerState.PAUSED) {
      setPlayBtn(false);
      stopProgressTimer();
    }
    if (e.data === YT.PlayerState.ENDED) playNext();
  }

  function onError() {
    playlist[currentIndex].status = 'error';
    renderQueue();
    playNext();
  }

  // ── Fetch video ID ─────────────────────────────────────
  async function getVideoId(query) {
    if (cache[query]) return cache[query];

    const key = query.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    if (window.firebaseDb) {
      try {
        const snap = await window.firebaseGetDoc(
          window.firebaseDoc(window.firebaseDb, 'songs', key)
        );
        if (snap.exists()) {
          cache[query] = snap.data().videoId;
          return cache[query];
        }
      } catch {}
    }

    setTrackLoading(true);
    try {
      const res  = await fetch('/.netlify/functions/ytsearch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (data.videoId) {
        cache[query] = data.videoId;
        if (window.firebaseDb) {
          window.firebaseSetDoc(
            window.firebaseDoc(window.firebaseDb, 'songs', key),
            { videoId: data.videoId, source: data.source || 'ytsearch', createdAt: window.firebaseServerTimestamp() }
          ).catch(() => {});
        }
        return data.videoId;
      }
    } catch (e) {
      console.warn('ytsearch failed for:', query);
    } finally {
      setTrackLoading(false);
    }
    return null;
  }

  // ── Playback ───────────────────────────────────────────
  async function playSong(index) {
    if (index < 0 || index >= playlist.length) return;
    currentIndex = index;

    const track = playlist[index];
    updateNowPlaying(track);
    renderQueue();

    let videoId = track.videoId;
    if (!videoId) {
      videoId = await getVideoId(track.query);
      if (!videoId) {
        playlist[index].status = 'error';
        renderQueue();
        playNext();
        return;
      }
      playlist[index].videoId = videoId;
      playlist[index].status  = 'loaded';
    }

    if (isReady && ytPlayer) ytPlayer.loadVideoById(videoId);
    prefetchNext(index + 1);
  }

  async function prefetchNext(index) {
    if (index >= playlist.length) return;
    const track = playlist[index];
    if (track.videoId || track.status === 'error') return;
    const id = await getVideoId(track.query);
    if (id) { playlist[index].videoId = id; playlist[index].status = 'loaded'; }
  }

  function playNext() {
    let next = currentIndex + 1;
    if (isShuffle) {
      const avail = playlist.map((_,i) => i)
        .filter(i => i !== currentIndex && playlist[i].status !== 'error');
      if (!avail.length) return;
      next = avail[Math.floor(Math.random() * avail.length)];
    }
    if (next < playlist.length) playSong(next);
    else stopPlayer();
  }

  function playPrev() { if (currentIndex > 0) playSong(currentIndex - 1); }

  function togglePlayPause() {
    if (!ytPlayer) return;
    ytPlayer.getPlayerState() === YT.PlayerState.PLAYING
      ? ytPlayer.pauseVideo()
      : ytPlayer.playVideo();
  }

  function stopPlayer() {
    if (ytPlayer) ytPlayer.stopVideo();
    setPlayBtn(false);
    stopProgressTimer();
  }

  // ── Progress ───────────────────────────────────────────
  function startProgressTimer() {
    stopProgressTimer();
    progressTimer = setInterval(() => {
      if (!ytPlayer?.getDuration) return;
      const cur = ytPlayer.getCurrentTime() || 0;
      const dur = ytPlayer.getDuration()    || 0;
      if (!dur) return;
      const pct = (cur / dur) * 100;
      if (progressBar())    progressBar().style.width    = pct + '%';
      if (progressExpBar()) progressExpBar().style.width = pct + '%';
      const str = `${fmt(cur)} / ${fmt(dur)}`;
      if (timeEl())    timeEl().textContent    = str;
      if (timeExpEl()) timeExpEl().textContent = str;
    }, 500);
  }

  function stopProgressTimer() { clearInterval(progressTimer); progressTimer = null; }

  function fmt(s) {
    const m = Math.floor(s / 60);
    return `${m}:${Math.floor(s % 60).toString().padStart(2,'0')}`;
  }

  function seekTo(e, el) {
    if (!ytPlayer?.getDuration) return;
    const rect = el.getBoundingClientRect();
    ytPlayer.seekTo(ytPlayer.getDuration() * ((e.clientX - rect.left) / rect.width), true);
  }

  // ── UI helpers ─────────────────────────────────────────
  function setPlayBtn(playing) {
    const icon = playing
      ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
    [$('pb-btn-play'), $('pb-btn-play-exp')].forEach(b => { if(b) b.innerHTML = icon; });
  }

  function setTrackLoading(on) {
    if (loadingEl()) loadingEl().style.display = on ? 'flex' : 'none';
    if (btnPlay())   btnPlay().style.display   = on ? 'none' : 'flex';
    const pe = $('pb-btn-play-exp');
    if (pe) pe.style.display = on ? 'none' : 'flex';
  }

  function updateNowPlaying(track) {
    // Mini bar
    const t = $('pb-now-title');  if(t) t.textContent  = track.title  || track.query;
    const a = $('pb-now-artist'); if(a) a.textContent  = track.artist || '';
    const th = $('pb-now-thumb');
    if (th) { th.src = track.image || ''; th.style.display = track.image ? 'block' : 'none'; }

    // Expanded
    const et = $('pb-exp-title');  if(et) et.textContent  = track.title  || track.query;
    const ea = $('pb-exp-artist'); if(ea) ea.textContent  = track.artist || '';

    // Expanded art (audio mode)
    const art = $('pb-exp-art');
    if (art) {
      if (track.image) { art.src = track.image; art.style.display = 'block'; }
      else art.style.display = 'none';
    }

    // Update video/audio view
    updateExpandedView();
  }

  function updateExpandedView() {
    const videoWrap = $('pb-exp-video');
    const artWrap   = $('pb-exp-art-wrap');
    if (!videoWrap || !artWrap) return;

    videoWrap.style.display = isVideoMode ? 'block' : 'none';
    artWrap.style.display   = isVideoMode ? 'none'  : 'flex';

    if ($('pb-btn-video')) $('pb-btn-video').classList.toggle('pb-mode-active', isVideoMode);
    if ($('pb-btn-audio')) $('pb-btn-audio').classList.toggle('pb-mode-active', !isVideoMode);

    // VIDEO MODE
    if (isVideoMode && playlist[currentIndex]?.videoId) {
        const container = $('pb-exp-yt-container');
        if (container) {
            const videoId = playlist[currentIndex].videoId;
            const currentTime = ytPlayer?.getCurrentTime?.() || 0;

            container.innerHTML = `
                <iframe 
                    src="https://www.youtube.com/embed/${videoId}?autoplay=1&start=${Math.floor(currentTime)}&controls=1&modestbranding=1&rel=0&playsinline=1"
                    allow="autoplay; encrypted-media"
                    allowfullscreen
                    style="width:100%;height:100%;border-radius:16px;border:none;">
                </iframe>
            `;
        }
    } else {
        // AUDIO MODE → clear video
        const container = $('pb-exp-yt-container');
        if (container) container.innerHTML = '';
    }
      }

  function renderQueue() {
    const el = queueEl();
    if (!el) return;
    el.innerHTML = '';
    playlist.forEach((track, i) => {
      const item = document.createElement('div');
      item.className = 'pb-queue-item'
        + (i === currentIndex ? ' pb-queue-active' : '')
        + (track.status === 'error'  ? ' pb-queue-error'  : '');
      item.innerHTML = `
        <span class="pb-queue-num">${i + 1}</span>
        <span class="pb-queue-title">${track.title || track.query}</span>
        ${track.status === 'error' ? '<span class="pb-queue-skip">skipped</span>' : ''}
      `;
      if (track.status !== 'error') item.addEventListener('click', () => playSong(i));
      el.appendChild(item);
    });
  }

  // ── Expand / Collapse ──────────────────────────────────
  function expand() {
    isExpanded = true;
    expanded().classList.add('pb-expanded-open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
        renderQueue();
        updateExpandedView();
    }, 50); }
  function collapse() {
    isExpanded = false;
    expanded().classList.remove('pb-expanded-open');
    document.body.style.overflow = '';
  }

  // ── Init ───────────────────────────────────────────────
  function init(tracks) {
    playlist = tracks.map(t => ({ ...t, videoId: null, status: 'pending' }));
    currentIndex = -1;
    isShuffle    = false;
    isVideoMode  = false;

    bar().style.display = 'flex';
    document.body.classList.add('player-open');

    if (!ytPlayer || !isReady) {
      loadYTApi();
    } else {
      playSong(0);
    }
    renderQueue();

    // Mini bar controls
    btnPlay()   .onclick = togglePlayPause;
    btnNext()   .onclick = playNext;
    btnPrev()   .onclick = playPrev;
    btnClose()  .onclick = close;
    btnShuffle().onclick = toggleShuffle;
    if (progressEl()) progressEl().onclick = e => seekTo(e, progressEl());
    const vol = $('pb-volume');
    if (vol) vol.oninput = () => { if (ytPlayer) ytPlayer.setVolume(vol.value); };

    // Expand on bar click (not buttons)
    bar().onclick = (e) => {
      if (e.target.closest('.pb-ctrl, .pb-volume, .pb-queue-toggle, .pb-progress')) return;
      expand();
    };

    // Expanded controls
    if (btnCollapse()) btnCollapse().onclick = collapse;
    const pe = $('pb-btn-play-exp');
    if (pe) pe.onclick = togglePlayPause;
    const neBtn = $('pb-btn-next-exp');
    if (neBtn) neBtn.onclick = playNext;
    const pvBtn = $('pb-btn-prev-exp');
    if (pvBtn) pvBtn.onclick = playPrev;
    const shBtn = $('pb-btn-shuffle-exp');
    if (shBtn) shBtn.onclick = toggleShuffle;
    if (progressExp()) progressExp().onclick = e => seekTo(e, progressExp());

    // Video / Audio toggle
    if ($('pb-btn-video')) $('pb-btn-video').onclick = () => { isVideoMode = true;  updateExpandedView(); };
    if ($('pb-btn-audio')) $('pb-btn-audio').onclick = () => { isVideoMode = false; updateExpandedView(); };

    playSong(0);
  }

  function close() {
    stopPlayer();
    collapse();
    bar().style.display = 'none';
    document.body.classList.remove('player-open');
    document.body.style.overflow = '';
    playlist  = [];
    isReady   = false;
    ytPlayer  = null;
    const iframe = $('pb-yt-iframe');
    if (iframe) iframe.innerHTML = '';
  }

  function toggleShuffle() {
    isShuffle = !isShuffle;
    [$('pb-btn-shuffle'), $('pb-btn-shuffle-exp')]
      .forEach(b => b?.classList.toggle('pb-active', isShuffle));
  }

  return { init, close };

})();

// ── Hook ───────────────────────────────────────────────────
function initPlayerFromCards() {
  const cards = document.querySelectorAll('.track-card');
  if (!cards.length) return;
  Player.init(Array.from(cards).map(card => ({
    query:  card.dataset.query  || '',
    title:  card.querySelector('.track-title')?.textContent  || '',
    artist: card.querySelector('.track-artist')?.textContent || '',
    image:  card.querySelector('.track-thumb')?.src          || '',
  })));
}
window.PlayerBridge = { init: initPlayerFromCards };
