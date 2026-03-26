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
  if (hostDiv) return; // already injected

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
  });

  const shadow = hostDiv.attachShadow({ mode: 'open' });

  // Video element
  const video = document.createElement('video');
  video.src = chrome.runtime.getURL('video.mp4');
  video.loop = true;
  video.muted = true;
  video.style.cssText = 'width:200px;height:355px;display:block;object-fit:cover;';
  video.addEventListener('error', () => removeOverlay());

  shadow.appendChild(video);
  hostDiv.style.left = '-9999px';
  document.body.appendChild(hostDiv);

  // Position
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

  // Autoplay
  video.play().catch(() => {
    // autoplay blocked — controls will stay visible (handled in later task)
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
