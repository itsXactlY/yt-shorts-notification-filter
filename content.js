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
  return t.includes("shorts") || t.includes("#shorts");
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
      chrome.runtime.sendMessage({ type: "INCR_STAT", key: "allowed" });
      continue;
    }

    if (isOnNotificationsPage()) {
      if (!state.filterNotificationsPage) continue;
    } else {
      if (!state.filterBell) continue;
    }

    item.style.display = "none";
    item.setAttribute("data-yt-shorts-filtered", "true");
    chrome.runtime.sendMessage({ type: "INCR_STAT", key: "blocked" });
  }
}

function redirectShortsIfNeeded() {
  if (!state.enabled || !state.redirectShorts) return;

  const m = location.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{6,})/);
  if (m) {
    const id = m[1];
    const target = `${location.origin}/watch?v=${id}`;
    location.replace(target);
  }
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
  const mo = new MutationObserver((mutations) => {
    for (const mu of mutations) {
      for (const node of mu.addedNodes) {
        if (!(node instanceof Element)) continue;
        processNotifications(node);
      }
    }
  });

  mo.observe(document.documentElement, { childList: true, subtree: true });

  setInterval(() => processNotifications(document), 1500);
}

async function loadState() {
  const res = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  const st = res?.state || {};
  Object.assign(state, st);
  state.loaded = true;
}

(async function main() {
  await loadState();
  redirectShortsIfNeeded();
  applyTheme();
  observe();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => processNotifications(document));
  } else {
    processNotifications(document);
  }
})();
