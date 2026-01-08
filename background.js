const DEFAULTS = {
  enabled: true,
  filterBell: true,
  filterNotificationsPage: true,
  redirectShorts: true,
  theme: "system",
  whitelistChannels: [],
  stats: { blocked: 0, allowed: 0 }
};

async function getState() {
  const data = await chrome.storage.sync.get(DEFAULTS);
  data.stats = { ...DEFAULTS.stats, ...(data.stats || {}) };
  data.whitelistChannels = data.whitelistChannels || [];
  return data;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const state = await getState();

    if (msg?.type === "GET_STATE") {
      sendResponse({ ok: true, state });
      return;
    }

    if (msg?.type === "SET_STATE") {
      const next = { ...state, ...(msg.patch || {}) };
      if (msg.patch?.stats) next.stats = { ...state.stats, ...msg.patch.stats };
      await chrome.storage.sync.set(next);
      sendResponse({ ok: true });
      return;
    }

    if (msg?.type === "INCR_STAT") {
      const key = msg.key === "blocked" ? "blocked" : "allowed";
      const nextStats = { ...state.stats, [key]: (state.stats[key] || 0) + 1 };
      await chrome.storage.sync.set({ stats: nextStats });
      sendResponse({ ok: true, stats: nextStats });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message" });
  })();

  return true;
});
