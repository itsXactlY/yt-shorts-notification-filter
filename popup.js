const $ = (id) => document.getElementById(id);

async function safeSendMessage(message, maxRetries = 3, timeout = 1000) {
  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    try {
      // Check if extension context is valid
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        throw new Error('Extension context invalidated');
      }

      const promise = chrome.runtime.sendMessage(message);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Message timeout')), timeout)
      );

      const result = await Promise.race([promise, timeoutPromise]);
      return result;

    } catch (err) {
      attempt++;
      lastError = err;
      console.debug(`[YT-Shorts-Filter] Message attempt ${attempt} failed:`, err.message || err);

      if (attempt >= maxRetries) {
        console.error('[YT-Shorts-Filter] Max retries reached, giving up');
        return null;
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 100 * attempt));
    }
  }

  return null;
}

async function getState(retryCount = 3) {
  // Local caching to reduce background communication
  const CACHE_TTL = 5000; // 5 seconds
  if (window.popupStateCache && window.lastCacheUpdate &&
      (Date.now() - window.lastCacheUpdate) < CACHE_TTL) {
    console.log('[Popup] Returning cached state');
    return {...window.popupStateCache};
  }

  try {
    const res = await safeSendMessage({ type: "GET_STATE" });

    console.log('[Popup] GET_STATE response:', res);
    if (!res) {
      console.error('[Popup] GET_STATE returned null/undefined');
      if (retryCount > 0) {
        console.log('[Popup] Retrying GET_STATE... (attempts left:', retryCount, ')');
        await new Promise(resolve => setTimeout(resolve, 200));
        return getState(retryCount - 1);
      }
      // Return cached state if available, otherwise defaults
      return window.popupStateCache || { enabled: true, filterBell: true, filterNotificationsPage: true, redirectShorts: true, whitelistChannels: [], stats: { blocked: 0, allowed: 0 } };
    }
    if (res.error) {
      console.error('[Popup] GET_STATE error:', res.error);
      return window.popupStateCache || { enabled: true, filterBell: true, filterNotificationsPage: true, redirectShorts: true, whitelistChannels: [], stats: { blocked: 0, allowed: 0 } };
    }

    // Cache successful response
    window.popupStateCache = res.state;
    window.lastCacheUpdate = Date.now();
    return res.state;
  } catch (error) {
    console.error('[Popup] GET_STATE exception:', error);
    if (retryCount > 0) {
      console.log('[Popup] Retrying GET_STATE... (attempts left:', retryCount, ')');
      await new Promise(resolve => setTimeout(resolve, 200));
      return getState(retryCount - 1);
    }
    return window.popupStateCache || { enabled: true, filterBell: true, filterNotificationsPage: true, redirectShorts: true, whitelistChannels: [], stats: { blocked: 0, allowed: 0 } };
  }
}

async function setState(patch) {
  const result = await safeSendMessage({ type: "SET_STATE", patch });
  // Invalidate cache on successful state update
  if (result && result.ok) {
    window.popupStateCache = null;
    window.lastCacheUpdate = 0;
  }
  return result;
}

function createToggle(elementId, isActive, onChange) {
  const toggle = $(elementId);
  toggle.classList.toggle("active", isActive);
  toggle.onclick = () => {
    const newState = !toggle.classList.contains("active");
    toggle.classList.toggle("active", newState);
    onChange(newState);
  };
}

function renderWhitelist(list) {
  const container = $("whitelistContainer");
  container.innerHTML = "";
  
  if (list.length === 0) {
    container.innerHTML = '<div style="padding: 10px 12px; color: var(--color-text-secondary); font-size: 12px;">No whitelist entries yet</div>';
    return;
  }
  
  list.forEach((ch, idx) => {
    const item = document.createElement("div");
    item.className = "filter-item";
    item.innerHTML = `
      <span class="filter-item-text">${ch}</span>
      <button class="filter-remove" data-idx="${idx}">Remove</button>
    `;
    container.appendChild(item);
  });

  container.querySelectorAll(".filter-remove").forEach(btn => {
    btn.onclick = async () => {
      const idx = parseInt(btn.dataset.idx);
      const state = await getState();
      const next = state.whitelistChannels.filter((_, i) => i !== idx);
      await setState({ whitelistChannels: next });
      init();
    };
  });
}

async function init() {
  const st = await getState();
  
  
  $("blockedCount").textContent = st.stats?.blocked || 0;
  $("allowedCount").textContent = st.stats?.allowed || 0;
  
  
  $("statusText").textContent = st.enabled ? "Active - Filtering Shorts" : "Inactive - All Shorts shown";
  $("statusText").parentElement.querySelector(".status-badge")?.remove();
  if (!st.enabled) {
    const badge = document.createElement("span");
    badge.className = "status-badge status-inactive";
    badge.textContent = "DISABLED";
    $("statusText").parentElement.appendChild(badge);
  }

  
  createToggle("extensionToggle", st.enabled, async (val) => {
    await setState({ enabled: val });
    init();
  });
  
  createToggle("bellToggle", st.filterBell, async (val) => {
    await setState({ filterBell: val });
  });
  
  createToggle("notificationsToggle", st.filterNotificationsPage, async (val) => {
    await setState({ filterNotificationsPage: val });
  });
  
  createToggle("redirectToggle", st.redirectShorts, async (val) => {
    await setState({ redirectShorts: val });
  });

  
  renderWhitelist(st.whitelistChannels || []);
}

async function addWhitelist() {
  const v = $("whitelistInput").value.trim();
  if (!v) return;
  const st = await getState();
  const next = [...(st.whitelistChannels || []), v];
  await setState({ whitelistChannels: next });
  $("whitelistInput").value = "";
  init();
}

async function resetStats() {
  await setState({ stats: { blocked: 0, allowed: 0 } });
  init();
}

async function reloadYouTube() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.reload(tab.id);
}

$("addWhitelistBtn").onclick = addWhitelist;
$("whitelistInput").onkeypress = (e) => {
  if (e.key === "Enter") addWhitelist();
};
$("resetBtn").onclick = resetStats;
$("reloadBtn").onclick = reloadYouTube;

init();
