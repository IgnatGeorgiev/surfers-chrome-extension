const SITES_KEY = 'sites';

function isValidPattern(pattern) {
  return /^(https?|ftp|\*):\/\//.test(pattern) && pattern.trim().length > 0;
}

const input = document.getElementById('pattern-input');
const addBtn = document.getElementById('add-btn');
const errorEl = document.getElementById('error');
const listEl = document.getElementById('site-list');

function renderList(sites) {
  listEl.innerHTML = '';
  sites.forEach((pattern, i) => {
    const li = document.createElement('li');
    li.textContent = pattern;
    const del = document.createElement('button');
    del.textContent = '✕';
    del.title = 'Remove';
    del.addEventListener('click', () => {
      const updated = sites.filter((_, j) => j !== i);
      chrome.storage.sync.set({ [SITES_KEY]: updated }, () => renderList(updated));
    });
    li.appendChild(del);
    listEl.appendChild(li);
  });
}

function loadAndRender() {
  chrome.storage.sync.get(SITES_KEY, (data) => {
    renderList(data[SITES_KEY] || []);
  });
}

addBtn.addEventListener('click', () => {
  const pattern = input.value.trim();
  errorEl.textContent = '';

  if (!pattern) {
    errorEl.textContent = 'Please enter a pattern.';
    return;
  }
  if (!isValidPattern(pattern)) {
    errorEl.textContent = 'Invalid pattern. Must start with http://, https://, ftp://, or *://';
    return;
  }

  chrome.storage.sync.get(SITES_KEY, (data) => {
    const sites = data[SITES_KEY] || [];
    if (sites.includes(pattern)) {
      errorEl.textContent = 'Pattern already exists.';
      return;
    }
    const updated = [...sites, pattern];
    chrome.storage.sync.set({ [SITES_KEY]: updated }, () => {
      input.value = '';
      renderList(updated);
    });
  });
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addBtn.click();
});

loadAndRender();
