const SELECTORS = {
  notificationItem: "ytd-notification-renderer, ytd-notification-multi-renderer",
  anchors: "a[href]",
  thumbs: "ytd-thumbnail img, img#img"
};

const state = {
  enabled: true,
  filterBell: true,
  filterNotificationsPage: true,
  redirectShorts: true,
  theme: "system",
  whitelistChannels: [],
  loaded: false
};

function normalizeChannelName(s) {
  return (s || "").trim().toLowerCase();
}

function isWhitelisted(itemEl) {
  const txt = (itemEl.innerText || "").toLowerCase();
  return state.whitelistChannels.some(ch => ch && txt.includes(normalizeChannelName(ch)));
}

function hasShortsUrl(itemEl) {
  const anchors = itemEl.querySelectorAll(SELECTORS.anchors);
  for (const a of anchors) {
    const href = a.getAttribute("href") || "";
    if (href.includes("/shorts/")) return true;
  }
  return false;
}

function looksLikeShortsBadge(itemEl) {
  const t = (itemEl.innerText || "").toLowerCase();

  if (/^\s*shorts\b|^\s*[•·]\s*shorts\b|\bshorts\s*[•·]|\bnew\s+shorts\b|\bcheck\s+out\s+shorts\b/i.test(t)) {
    return true;
  }
  if (/#shorts\b(?!\s*(collection|style|summer|winter|fashion|clothing|outfit|pants|swim))/i.test(t)) {
    return true;
  }
  return false;
}

async function thumbLooksVertical(itemEl) {
  const img = itemEl.querySelector(SELECTORS.thumbs);
  if (!img) return false;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return false;
  return h / w > 1.15;
}

async function shouldBlock(itemEl) {
  if (!state.enabled) return false;
  if (isWhitelisted(itemEl)) return false;

  if (hasShortsUrl(itemEl)) return true;

  if (looksLikeShortsBadge(itemEl)) {
    const vertical = await thumbLooksVertical(itemEl);
    if (vertical) return true;
  }
  return false;
}

function isOnNotificationsPage() {
  return location.pathname.startsWith("/feed/notifications");
}

async function processNotifications(root = document) {
  const items = root.querySelectorAll(SELECTORS.notificationItem);
  for (const item of items) {
    if (item.__ytShortsFiltered) continue;
    item.__ytShortsFiltered = true;

    const block = await shouldBlock(item);
    if (!block) {
      safeSendMessage({ type: "INCR_STAT", key: "allowed" });
      continue;
    }

    if (isOnNotificationsPage()) {
      if (!state.filterNotificationsPage) continue;
    } else {
      if (!state.filterBell) continue;
    }

    item.style.display = "none";
    item.setAttribute("data-yt-shorts-filtered", "true");
    safeSendMessage({ type: "INCR_STAT", key: "blocked" });
  }
}

let lastPathname = location.pathname;

function redirectShortsIfNeeded() {
  
  if (!state.loaded || !state.enabled || !state.redirectShorts) return;

  const m = location.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{6,})/);
  if (m) {
    const id = m[1];
    const target = `${location.origin}/watch?v=${id}`;
    location.replace(target);
  }
}

function observeUrlChanges() {
  let urlTimeout;
  const checkUrlChange = () => {
    if (location.pathname !== lastPathname) {
      lastPathname = location.pathname;
      clearTimeout(urlTimeout);
      urlTimeout = setTimeout(() => {
        redirectShortsIfNeeded();
      }, 100);
    }
  };

  if (window.PerformanceNavigationTiming) {
    window.addEventListener("navigate", checkUrlChange);
  }
  setInterval(checkUrlChange, 500);
}

function applyTheme() {
  if (!state.theme || state.theme === "system") {
    document.cookie = "PREF=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    return;
  }

  const prefValue = state.theme === "dark" ? "f6=40000000" : "f6=10000000";
  document.cookie = `PREF=${prefValue}; path=/; domain=.youtube.com; max-age=31536000`;

  if (location.hostname === "www.youtube.com") {
    location.reload();
  }
}

function observe() {
  let debounceTimer = null;
  const DEBOUNCE_DELAY = 100;
  
  const processBatchedMutations = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    const items = document.querySelectorAll(SELECTORS.notificationItem + ":not([__ytShortsFiltered])");
    for (const item of items) {
      if (item.__ytShortsFiltered) continue;
      item.__ytShortsFiltered = true;
      processSingleNotification(item);
    }
  };
  
  const mo = new MutationObserver((mutations) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(processBatchedMutations, DEBOUNCE_DELAY);
  });

  mo.observe(document.documentElement, { childList: true, subtree: true });

  setInterval(() => {
    const items = document.querySelectorAll(SELECTORS.notificationItem + ":not([__ytShortsFiltered])");
    for (const item of items) {
      if (item.__ytShortsFiltered) continue;
      item.__ytShortsFiltered = true;
      processSingleNotification(item);
    }
  }, 5000);
}

async function processSingleNotification(itemEl) {
  const block = await shouldBlock(itemEl);
  if (!block) {
    safeSendMessage({ type: "INCR_STAT", key: "allowed" });
    return;
  }

  if (isOnNotificationsPage()) {
    if (!state.filterNotificationsPage) return;
  } else {
    if (!state.filterBell) return;
  }

  itemEl.style.display = "none";
  itemEl.setAttribute("data-yt-shorts-filtered", "true");
  safeSendMessage({ type: "INCR_STAT", key: "blocked" });
}

function safeSendMessage(message) {
  try {
    const promise = chrome.runtime.sendMessage(message);
    return promise.catch(err => {
      console.debug('[YT-Shorts-Filter] Message failed (extension context may be invalidated):', err.message || err);
      return null;
    });
  } catch (err) {
    console.debug('[YT-Shorts-Filter] Message failed (extension context may be invalidated):', err.message || err);
    return Promise.resolve(null);
  }
}

async function loadState() {
  try {
    const res = await safeSendMessage({ type: "GET_STATE" });
    if (res?.state) {
      Object.assign(state, res.state);
    }
    state.loaded = true;
  } catch (e) {
    console.debug('[YT-Shorts-Filter] Failed to load state:', e);
    state.loaded = true;
  }
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.enabled) state.enabled = changes.enabled.newValue;
    if (changes.filterBell) state.filterBell = changes.filterBell.newValue;
    if (changes.filterNotificationsPage) state.filterNotificationsPage = changes.filterNotificationsPage.newValue;
    if (changes.redirectShorts) state.redirectShorts = changes.redirectShorts.newValue;
    if (changes.theme) state.theme = changes.theme.newValue;
    if (changes.whitelistChannels) state.whitelistChannels = changes.whitelistChannels.newValue || [];
  }
});

(async function main() {
  await loadState();
  redirectShortsIfNeeded();
  applyTheme();
  observe();
  observeUrlChanges();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => processNotifications(document));
  } else {
    processNotifications(document);
  }
})();
