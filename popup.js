const $ = (id) => document.getElementById(id);

async function getState() {
  const res = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  return res.state;
}

async function setState(patch) {
  await chrome.runtime.sendMessage({ type: "SET_STATE", patch });
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
  
  // Stats
  $("blockedCount").textContent = st.stats?.blocked || 0;
  $("allowedCount").textContent = st.stats?.allowed || 0;
  
  // Status toggle
  $("statusText").textContent = st.enabled ? "Active - Filtering Shorts" : "Inactive - All Shorts shown";
  $("statusText").parentElement.querySelector(".status-badge")?.remove();
  if (!st.enabled) {
    const badge = document.createElement("span");
    badge.className = "status-badge status-inactive";
    badge.textContent = "DISABLED";
    $("statusText").parentElement.appendChild(badge);
  }

  // Create toggles
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

  // Theme dropdown
  $("themeSelect").value = st.theme || "system";
  $("themeSelect").onchange = async (e) => {
    await setState({ theme: e.target.value });
  };

  // Whitelist
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

// Event listeners
$("addWhitelistBtn").onclick = addWhitelist;
$("whitelistInput").onkeypress = (e) => {
  if (e.key === "Enter") addWhitelist();
};
$("resetBtn").onclick = resetStats;
$("reloadBtn").onclick = reloadYouTube;

// Initialize
init();
