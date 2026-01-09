const CONFIG = {
  MAX_WRITE_OPERATIONS_PER_MINUTE: 120,
  STATS_DEBOUNCE_DELAY: 1000,
  BATCH_WINDOW: 50,
  MAX_BATCH_SIZE: 10,
};

const DEFAULTS = {
  enabled: true,
  filterBell: true,
  filterNotificationsPage: true,
  redirectShorts: true,
  theme: "system",
  whitelistChannels: [],
  stats: { blocked: 0, allowed: 0 }
};

const Logger = {
  enabled: true,
  metrics: {
    storageWrites: 0,
    storageReads: 0,
    messagesProcessed: 0,
    errors: 0,
    coalescedRequests: 0,
    batchedWrites: 0,
    lastWriteTime: null,
    writeLatencies: []
  },

  log(type, ...args) {
    if (!this.enabled) return;
    const timestamp = new Date().toISOString();
    const prefix = `[YT-Shorts-Filter][${timestamp}][${type}]`;
    console.log(prefix, ...args);
  },

  metric(name, value) {
    if (this.metrics[name] !== undefined) {
      if (typeof value === 'number') {
        this.metrics[name] = value;
      } else if (Array.isArray(this.metrics[name])) {
        this.metrics[name].push(value);
      } else {
        this.metrics[name]++;
      }
    }
  },

  timeOperation(name) {
    return {
      start: performance.now(),
      end() {
        const duration = performance.now() - this.start;
        Logger.metric(`${name}Latency`, duration);
        return duration;
      }
    };
  },

  getMetrics() {
    return { ...this.metrics };
  },

  resetMetrics() {
    this.metrics = {
      storageWrites: 0,
      storageReads: 0,
      messagesProcessed: 0,
      errors: 0,
      coalescedRequests: 0,
      batchedWrites: 0,
      lastWriteTime: null,
      writeLatencies: []
    };
  }
};

class BatchProcessor {
  constructor() {
    this.queue = new Map();
    this.flushTimer = null;
    this.writeCount = 0;
    this.lastMinuteReset = Date.now();
  }

  async addToBatch(key, operation) {

    if (Date.now() - this.lastMinuteReset > 60000) {
      this.writeCount = 0;
      this.lastMinuteReset = Date.now();
    }


    if (this.writeCount >= CONFIG.MAX_WRITE_OPERATIONS_PER_MINUTE) {
      Logger.log('RATE_LIMIT', `Rate limit reached, queuing for later`);
      await this.flush();
    }


    if (this.queue.has(key)) {
      Logger.metric('coalescedRequests');
      const existing = this.queue.get(key);
      existing.pending = true;
      // Schedule flush BEFORE returning the promise to prevent deadlock
      this.scheduleFlush();
      return new Promise((resolve) => {
        existing.resolvers.push(resolve);
      });
    }

    // Create the promise that will resolve when flush() is called
    const promise = new Promise((resolve) => {
      this.queue.set(key, {
        operation,
        resolvers: [resolve],
        pending: false
      });
    });

    // Schedule flush BEFORE returning the promise to prevent deadlock
    // This ensures flush() will be called even if caller awaits this method
    this.scheduleFlush();

    return promise;
  }

  async flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.queue.size === 0) return;

    const operations = Array.from(this.queue.entries());
    this.queue.clear();

    const batch = {};
    const pendingPromises = [];

    for (const [key, data] of operations) {
      const result = await data.operation();
      Object.assign(batch, result);
      pendingPromises.push(...data.resolvers);
      data.resolvers.forEach(r => r({ ok: true }));
    }


    const timer = Logger.timeOperation('batchWrite');
    try {
      await chrome.storage.sync.set(batch);
      Logger.metric('storageWrites');
      Logger.metric('batchedWrites');
      this.writeCount++;
      Logger.metric('lastWriteTime', Date.now());
      timer.end();
      Logger.log('BATCH', `Wrote ${operations.length} operations in ${timer.end().toFixed(2)}ms`);
    } catch (error) {
      Logger.metric('errors');
      Logger.log('ERROR', `Batch write failed: ${error.message}`);
      throw error;
    }
  }

  scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flush();
    }, CONFIG.BATCH_WINDOW);
  }
}


class StatsBatcher {
  constructor() {
    this.pendingStats = { blocked: 0, allowed: 0 };
    this.writeTimer = null;
  }

  increment(statType) {
    this.pendingStats[statType]++;
  }

  async flush() {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }

    if (this.pendingStats.blocked === 0 && this.pendingStats.allowed === 0) {
      return;
    }

    const timer = Logger.timeOperation('statsWrite');
    try {
      const currentState = await getState();
      const newStats = {
        blocked: (currentState.stats.blocked || 0) + this.pendingStats.blocked,
        allowed: (currentState.stats.allowed || 0) + this.pendingStats.allowed
      };

      await chrome.storage.sync.set({ stats: newStats });
      Logger.metric('storageWrites');
      this.pendingStats = { blocked: 0, allowed: 0 };
      timer.end();
      Logger.log('STATS', `Flushed stats in ${timer.end().toFixed(2)}ms`);
    } catch (error) {
      Logger.metric('errors');
      Logger.log('ERROR', `Stats write failed: ${error.message}`);
    }
  }

  scheduleFlush() {
    if (this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.flush();
    }, CONFIG.STATS_DEBOUNCE_DELAY);
  }
}


class StorageErrorHandler {
  static isQuotaError(error) {
    return error.message?.includes('QUOTA_BYTES') ||
      error.message?.includes('quota') ||
      error.message?.includes('storage');
  }

  static async handle(error, operation) {
    Logger.metric('errors');
    Logger.log('ERROR', `Storage error during ${operation}: ${error.message}`);

    if (this.isQuotaError(error)) {

      try {
        const keys = await chrome.storage.sync.get(null);

        const essentialKeys = ['enabled', 'filterBell', 'filterNotificationsPage', 'redirectShorts', 'theme', 'whitelistChannels'];
        const toRemove = Object.keys(keys).filter(k => !essentialKeys.includes(k));

        if (toRemove.length > 0) {
          await chrome.storage.sync.remove(toRemove);
          Logger.log('CLEANUP', `Freed ${toRemove.length} non-essential keys`);
        }
      } catch (cleanupError) {
        Logger.log('ERROR', `Cleanup failed: ${cleanupError.message}`);
      }
    }

    throw error;
  }
}


let cachedState = null;
let stateCacheTime = null;
const STATE_CACHE_DURATION = 5000;
const FAST_CACHE_DURATION = 100;
let isReady = false;

isReady = true;

async function getState(fastMode = false) {
  const timer = Logger.timeOperation('getState');


  if (fastMode && cachedState && stateCacheTime && (Date.now() - stateCacheTime) < FAST_CACHE_DURATION) {
    Logger.metric('cacheHits');
    return { ...cachedState };
  }


  if (cachedState && stateCacheTime && (Date.now() - stateCacheTime) < STATE_CACHE_DURATION) {
    Logger.metric('cacheHits');
    return { ...cachedState };
  }

  try {
    const data = await chrome.storage.sync.get(DEFAULTS);

    data.stats = { ...DEFAULTS.stats, ...(data.stats || {}) };
    data.whitelistChannels = data.whitelistChannels || [];
    data.enabled = data.enabled ?? DEFAULTS.enabled;
    data.filterBell = data.filterBell ?? DEFAULTS.filterBell;
    data.filterNotificationsPage = data.filterNotificationsPage ?? DEFAULTS.filterNotificationsPage;
    data.redirectShorts = data.redirectShorts ?? DEFAULTS.redirectShorts;
    data.theme = data.theme ?? DEFAULTS.theme;


    cachedState = { ...data };
    stateCacheTime = Date.now();

    Logger.metric('storageReads');
    timer.end();
    Logger.log('STATE', `Loaded state in ${timer.end().toFixed(2)}ms`);

    return data;
  } catch (error) {
    Logger.metric('errors');
    Logger.log('ERROR', `getState failed: ${error.message}, returning defaults`);

    return { ...DEFAULTS };
  }
}

function invalidateCache() {
  cachedState = null;
  stateCacheTime = null;
}


const batchProcessor = new BatchProcessor();
const statsBatcher = new StatsBatcher();

setInterval(() => {
  statsBatcher.flush();
}, 30000);

setInterval(() => {
  batchProcessor.flush();
}, 10000);


const MessageHandler = {
  handlers: {},

  register(type, handler) {
    this.handlers[type] = handler;
  },

  async handle(msg, sender, sendResponse) {
    Logger.metric('messagesProcessed');
    const timer = Logger.timeOperation(`handle_${msg?.type}`);

    try {
      const type = msg?.type;

      if (!type) {
        throw new Error('Missing message type');
      }


      if (type === 'GET_STATE') {
        Logger.log('MESSAGE', 'GET_STATE request received');
        try {
          const state = await getState(true);
          Logger.log('MESSAGE', `GET_STATE returning state with keys: ${Object.keys(state).join(', ')}`);
          sendResponse({ ok: true, state });
        } catch (error) {
          Logger.log('ERROR', `GET_STATE failed: ${error.message}`);
          sendResponse({ ok: false, error: error.message, state: { ...DEFAULTS } });
        }
        timer.end();
        Logger.log('MESSAGE', `GET_STATE completed in ${timer.end().toFixed(2)}ms`);
        return true;
      }


      if (type === 'SET_STATE') {
        const state = await getState();
        const next = { ...state, ...(msg.patch || {}) };
        if (msg.patch?.stats) next.stats = { ...state.stats, ...msg.patch.stats };

        const key = `SET_STATE_${Date.now()}`;
        await batchProcessor.addToBatch(key, async () => {
          const timer2 = Logger.timeOperation('SET_STATE');
          await chrome.storage.sync.set(next);
          invalidateCache();
          timer2.end();
          Logger.log('MESSAGE', `SET_STATE completed in ${timer2.end().toFixed(2)}ms`);
          return next;
        });

        batchProcessor.scheduleFlush();
        sendResponse({ ok: true });
        return true;
      }


      if (type === 'INCR_STAT') {
        const key = msg.key === 'blocked' ? 'blocked' : 'allowed';
        statsBatcher.increment(key);
        statsBatcher.scheduleFlush();


        const state = await getState();
        const approxStats = {
          ...state.stats,
          [key]: (state.stats[key] || 0) + statsBatcher.pendingStats[key]
        };
        sendResponse({ ok: true, stats: approxStats });
        return true;
      }


      if (type === 'RECORD_STATS') {

        statsBatcher.increment(msg.key || 'blocked');
        statsBatcher.scheduleFlush();
        sendResponse({ ok: true });
        return true;
      }

      if (type === 'INCREMENT_STATS') {

        statsBatcher.increment(msg.key || 'blocked');
        statsBatcher.scheduleFlush();
        sendResponse({ ok: true });
        return true;
      }

      if (type === 'GET_STATS') {
        const state = await getState();
        sendResponse({ ok: true, stats: state.stats });
        return true;
      }

      if (type === 'CLEAR_STATS') {
        const key = 'CLEAR_STATS';
        await batchProcessor.addToBatch(key, async () => {
          await chrome.storage.sync.set({ stats: { blocked: 0, allowed: 0 } });
          invalidateCache();
          return { stats: { blocked: 0, allowed: 0 } };
        });
        batchProcessor.scheduleFlush();
        sendResponse({ ok: true });
        return true;
      }

      if (type === 'ADD_TO_WHITELIST') {
        const state = await getState();
        const next = [...(state.whitelistChannels || []), msg.channel];
        await batchProcessor.addToBatch('WHITELIST', async () => {
          await chrome.storage.sync.set({ whitelistChannels: next });
          invalidateCache();
          return { whitelistChannels: next };
        });
        batchProcessor.scheduleFlush();
        sendResponse({ ok: true });
        return true;
      }

      if (type === 'REMOVE_FROM_WHITELIST') {
        const state = await getState();
        const next = (state.whitelistChannels || []).filter(c => c !== msg.channel);
        await batchProcessor.addToBatch('WHITELIST', async () => {
          await chrome.storage.sync.set({ whitelistChannels: next });
          invalidateCache();
          return { whitelistChannels: next };
        });
        batchProcessor.scheduleFlush();
        sendResponse({ ok: true });
        return true;
      }

      if (type === 'GET_WHITELIST') {
        const state = await getState();
        sendResponse({ ok: true, whitelist: state.whitelistChannels });
        return true;
      }

      if (type === 'CLEAR_WHITELIST') {
        await batchProcessor.addToBatch('WHITELIST', async () => {
          await chrome.storage.sync.set({ whitelistChannels: [] });
          invalidateCache();
          return { whitelistChannels: [] };
        });
        batchProcessor.scheduleFlush();
        sendResponse({ ok: true });
        return true;
      }

      if (type === 'NOTIFY_CONTENT_SCRIPT') {
        const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
        for (const tab of tabs) {
          try {
            await chrome.tabs.sendMessage(tab.id, msg);
          } catch (e) {
          }
        }
        sendResponse({ ok: true });
        return true;
      }

      if (type === 'GET_STORAGE_USAGE') {
        const data = await chrome.storage.sync.get(null);
        const bytes = new Blob([JSON.stringify(data)]).size;
        sendResponse({ ok: true, usage: bytes, quota: 102400 });
        return true;
      }


      Logger.log('WARNING', `Unknown message type: ${type}`);
      sendResponse({ ok: false, error: 'Unknown message type' });
      return true;

    } catch (error) {
      Logger.metric('errors');
      Logger.log('ERROR', `Message handling error: ${error.message}`);
      sendResponse({ ok: false, error: error.message });
      return true;
    }
  }
};


chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    Logger.log('STORAGE', `Storage changed: ${Object.keys(changes).join(', ')}`);
    invalidateCache();
  }
});


chrome.runtime.onInstalled.addListener(async (details) => {
  Logger.log('INSTALL', `Extension ${details.reason}`);
  if (details.reason === 'install') {
    await chrome.storage.sync.set(DEFAULTS);
    Logger.log('INIT', 'Initialized with defaults');
  }
});

chrome.runtime.onSuspend.addListener(() => {

  batchProcessor.flush();
  statsBatcher.flush();
  Logger.log('SUSPEND', 'Flushed pending writes');
});


// Single unified message listener to avoid interference between multiple listeners
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Handle debug messages synchronously if logging is enabled
  if (Logger.enabled) {
    if (msg?.type === '_DEBUG_GET_METRICS') {
      sendResponse({ ok: true, metrics: Logger.getMetrics() });
      return true;
    }
    if (msg?.type === '_DEBUG_RESET_METRICS') {
      Logger.resetMetrics();
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === '_DEBUG_FLUSH') {
      batchProcessor.flush();
      statsBatcher.flush();
      sendResponse({ ok: true });
      return true;
    }
  }

  // Handle all other messages asynchronously
  // Must return true synchronously to indicate async response
  MessageHandler.handle(msg, sender, sendResponse);
  return true;
});

Logger.log('INIT', 'Enhanced background script loaded');
Logger.log('CONFIG', `Rate limit: ${CONFIG.MAX_WRITE_OPERATIONS_PER_MINUTE} ops/min, Stats debounce: ${CONFIG.STATS_DEBOUNCE_DELAY}ms`);
