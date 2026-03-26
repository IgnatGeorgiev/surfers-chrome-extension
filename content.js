const POSITION_KEY = 'subway-surfers-position';
const SITES_KEY = 'sites';

function patternToRegExp(pattern) {
  let escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  if (escaped.startsWith('*://')) {
    escaped = '(https?|ftp)://' + escaped.slice(4);
  }
  escaped = escaped.replace(/\*/g, '.*');
  return new RegExp('^' + escaped + '$');
}

function isValidPattern(pattern) {
  return /^(https?|ftp|\*):\/\//.test(pattern) && pattern.trim().length > 0;
}

function clampPosition(x, y, viewportWidth, viewportHeight) {
  return {
    x: Math.max(0, Math.min(x, viewportWidth - 200)),
    y: Math.max(0, Math.min(y, viewportHeight - 355)),
  };
}

let hostDiv = null; // reference to the injected host element

function injectOverlay() {
  if (hostDiv) return;

  hostDiv = document.createElement('div');
  hostDiv.id = 'subway-surfers-host';
  Object.assign(hostDiv.style, {
    position: 'fixed',
    width: '200px',
    height: '355px',
    zIndex: '2147483647',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    cursor: 'grab',
    userSelect: 'none',
  });

  const shadow = hostDiv.attachShadow({ mode: 'open' });

  // ── Styles ──────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .wrap { position: relative; width: 200px; height: 355px; background: #000; }
    video { width: 200px; height: 355px; display: block; object-fit: cover; }

    .controls {
      position: absolute; bottom: 0; left: 0; right: 0;
      padding: 6px 8px 8px;
      background: linear-gradient(transparent, rgba(0,0,0,0.75));
      display: flex; flex-direction: column; gap: 5px;
      transition: opacity 0.3s;
    }
    .controls.hidden { opacity: 0; pointer-events: none; }

    .close-btn {
      position: absolute; top: 6px; right: 6px;
      width: 22px; height: 22px; border-radius: 50%;
      background: rgba(0,0,0,0.55); border: none; cursor: pointer;
      color: #fff; font-size: 12px; display: flex; align-items: center; justify-content: center;
      transition: opacity 0.3s;
    }
    .close-btn.hidden { opacity: 0; pointer-events: none; }

    .seek {
      width: 100%; height: 3px; cursor: pointer;
      accent-color: #fff; appearance: auto;
    }
    .btn-row { display: flex; align-items: center; gap: 8px; }
    .ctrl-btn {
      background: none; border: none; color: #fff; font-size: 16px;
      cursor: pointer; padding: 0; line-height: 1;
    }
  `;
  shadow.appendChild(style);

  // ── DOM ──────────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.className = 'wrap';

  const video = document.createElement('video');
  video.src = chrome.runtime.getURL('video.mp4');
  video.loop = true;
  video.muted = true;
  wrap.appendChild(video);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.textContent = '✕';
  closeBtn.title = 'Close';
  wrap.appendChild(closeBtn);

  // Controls overlay
  const controls = document.createElement('div');
  controls.className = 'controls';

  const seekInput = document.createElement('input');
  seekInput.type = 'range';
  seekInput.className = 'seek';
  seekInput.min = '0';
  seekInput.max = '1';
  seekInput.step = 'any';
  seekInput.value = '0';

  const btnRow = document.createElement('div');
  btnRow.className = 'btn-row';

  const playBtn = document.createElement('button');
  playBtn.className = 'ctrl-btn';
  playBtn.textContent = '⏸';
  playBtn.title = 'Play/Pause';

  const muteBtn = document.createElement('button');
  muteBtn.className = 'ctrl-btn';
  muteBtn.textContent = '🔇';
  muteBtn.title = 'Mute/Unmute';

  btnRow.appendChild(playBtn);
  btnRow.appendChild(muteBtn);
  controls.appendChild(seekInput);
  controls.appendChild(btnRow);
  wrap.appendChild(controls);

  shadow.appendChild(wrap);
  hostDiv.style.left = '-9999px';
  document.body.appendChild(hostDiv);

  // ── Controls fade logic ──────────────────────────────────
  let fadeTimer = null;
  let autoplayBlocked = false;

  function showControls() {
    controls.classList.remove('hidden');
    closeBtn.classList.remove('hidden');
  }
  function scheduleHide() {
    if (autoplayBlocked) return;
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => {
      controls.classList.add('hidden');
      closeBtn.classList.add('hidden');
    }, 2000);
  }
  function resetTimer() {
    showControls();
    scheduleHide();
  }

  hostDiv.addEventListener('mouseenter', showControls);
  hostDiv.addEventListener('mouseleave', scheduleHide);
  hostDiv.addEventListener('mousemove', resetTimer);
  wrap.addEventListener('mousedown', resetTimer);

  // ── Video events ─────────────────────────────────────────
  video.addEventListener('timeupdate', () => {
    if (video.duration) seekInput.value = video.currentTime / video.duration;
  });
  video.addEventListener('play', () => { playBtn.textContent = '⏸'; });
  video.addEventListener('pause', () => { playBtn.textContent = '▶'; });
  video.addEventListener('error', () => removeOverlay());

  // ── Control interactions ──────────────────────────────────
  playBtn.addEventListener('click', () => {
    if (video.paused) {
      video.play().then(() => {
        autoplayBlocked = false;
        scheduleHide();
      });
    } else {
      video.pause();
    }
    resetTimer();
  });

  muteBtn.addEventListener('click', () => {
    video.muted = !video.muted;
    muteBtn.textContent = video.muted ? '🔇' : '🔊';
    resetTimer();
  });

  seekInput.addEventListener('input', () => {
    video.currentTime = seekInput.value * video.duration;
    resetTimer();
  });

  closeBtn.addEventListener('click', () => removeOverlay());

  // ── Autoplay ──────────────────────────────────────────────
  video.play().then(() => {
    scheduleHide();
  }).catch(() => {
    autoplayBlocked = true;
    showControls();
    playBtn.textContent = '▶';
  });

  // ── Position ─────────────────────────────────────────────
  chrome.storage.local.get(POSITION_KEY, (data) => {
    const pos = data[POSITION_KEY];
    let x, y;
    if (pos) {
      ({ x, y } = clampPosition(pos.x, pos.y, window.innerWidth, window.innerHeight));
    } else {
      x = window.innerWidth - 216;
      y = (window.innerHeight - 355) / 2;
      ({ x, y } = clampPosition(x, y, window.innerWidth, window.innerHeight));
    }
    hostDiv.style.left = x + 'px';
    hostDiv.style.top = y + 'px';
  });

  // ── Drag ─────────────────────────────────────────────────
  let dragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  hostDiv.addEventListener('mousedown', (e) => {
    e.stopPropagation();

    // Don't start drag if clicking a control element
    const path = e.composedPath();
    const onControl = path.some(el => el instanceof Element && (el.tagName === 'BUTTON' || el.tagName === 'INPUT'));
    if (onControl) return;

    dragging = true;
    const rect = hostDiv.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    hostDiv.style.cursor = 'grabbing';

    const onMove = (e) => {
      if (!dragging) return;
      e.preventDefault();
      const newX = e.clientX - dragOffsetX;
      const newY = e.clientY - dragOffsetY;
      const clamped = clampPosition(newX, newY, window.innerWidth, window.innerHeight);
      hostDiv.style.left = clamped.x + 'px';
      hostDiv.style.top = clamped.y + 'px';
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      hostDiv.style.cursor = 'grab';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      const x = parseInt(hostDiv.style.left, 10);
      const y = parseInt(hostDiv.style.top, 10);
      chrome.storage.local.set({ [POSITION_KEY]: { x, y } });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function removeOverlay() {
  if (!hostDiv) return;
  const video = hostDiv.shadowRoot && hostDiv.shadowRoot.querySelector('video');
  if (video) video.pause();
  hostDiv.remove();
  hostDiv = null;
}

function urlMatchesSites(url, sites) {
  return sites
    .filter(isValidPattern)
    .some((pattern) => patternToRegExp(pattern).test(url));
}

function checkAndToggle() {
  chrome.storage.sync.get(SITES_KEY, (data) => {
    const sites = data[SITES_KEY] || [];
    if (urlMatchesSites(window.location.href, sites)) {
      injectOverlay();
    } else {
      removeOverlay();
    }
  });
}

checkAndToggle();
