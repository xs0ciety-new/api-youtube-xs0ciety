/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/

import { ProxyAgent, fetch as undiciFetch } from 'undici';

// Sumber daftar proxy gratis (JSON / TXT)
const PROXY_SOURCES = [
  {
    name: 'ProxyScrape',
    url: 'https://cdn.jsdelivr.net/gh/proxyscrape/free-proxy-list@main/proxies/all/data.json',
    parse: (data) => (Array.isArray(data) ? data.map((p) => `${p.protocol}://${p.ip}:${p.port}`) : []),
  },
  {
    name: 'Monosans',
    url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/all.txt',
    parse: (text) => text.split('\n').filter(Boolean).map((line) => `http://${line.trim()}`),
  },
  {
    name: 'Fyvri',
    url: 'https://raw.githubusercontent.com/fyvri/fresh-proxy-list/archive/storage/classic/proxies.json',
    parse: (data) => (Array.isArray(data) ? data.map((p) => `http://${p.ip}:${p.port}`) : []),
  },
  {
    name: 'HProxy',
    url: 'https://hproxy.com/api/proxy-list?limit=50&protocols=http,socks5',
    parse: (data) => (Array.isArray(data?.data) ? data.data.map((p) => `${p.protocol}://${p.ip}:${p.port}`) : []),
  },
];

// State global (per cold-start function)
let proxyPool = [];
let lastRefresh = 0;
let currentIndex = 0;
const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 menit
const MAX_RETRIES = 3; // maksimal proxy dicoba per request

/**
 * Normalisasi format proxy agar kompatibel dengan undici.ProxyAgent.
 * ProxyAgent mendukung HTTP, HTTPS, SOCKS4, SOCKS5 (via URL scheme).
 */
function normalizeProxy(proxyUrl) {
  // Pastikan ada skema (default http)
  if (!proxyUrl.includes('://')) return `http://${proxyUrl}`;
  return proxyUrl;
}

/**
 * Ambil & gabungkan daftar proxy dari semua sumber.
 * Sumber yang gagal diabaikan.
 */
async function refreshProxyPool() {
  console.log('[proxyManager] Refreshing proxy pool...');
  const results = [];

  await Promise.allSettled(
    PROXY_SOURCES.map(async (src) => {
      try {
        const res = await fetch(src.url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return;
        const contentType = res.headers.get('content-type') || '';
        let proxies = [];
        if (contentType.includes('application/json')) {
          const data = await res.json();
          proxies = src.parse(data);
        } else {
          const text = await res.text();
          proxies = src.parse(text);
        }
        if (proxies.length > 0) {
          results.push(...proxies.map(normalizeProxy));
          console.log(`[proxyManager] ${src.name}: ${proxies.length} proxies`);
        }
      } catch (err) {
        console.warn(`[proxyManager] ${src.name} failed: ${err.message}`);
      }
    })
  );

  // Deduplikasi & acak ringan
  proxyPool = [...new Set(results)];
  // Acak agar tidak selalu IP yang sama di awal
  for (let i = proxyPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [proxyPool[i], proxyPool[j]] = [proxyPool[j], proxyPool[i]];
  }

  lastRefresh = Date.now();
  console.log(`[proxyManager] Pool ready: ${proxyPool.length} proxies`);
}

/**
 * Pastikan pool sudah terisi & tidak kadaluarsa.
 */
async function ensurePool() {
  if (proxyPool.length === 0 || Date.now() - lastRefresh > REFRESH_INTERVAL_MS) {
    await refreshProxyPool();
  }
}

/**
 * Ambil proxy berikutnya (round-robin).
 */
function nextProxy() {
  if (proxyPool.length === 0) return null;
  const proxy = proxyPool[currentIndex % proxyPool.length];
  currentIndex++;
  return proxy;
}

/**
 * Hapus proxy yang dianggap mati dari pool.
 */
function markDead(proxy) {
  proxyPool = proxyPool.filter((p) => p !== proxy);
}

/**
 * Fetch dengan auto-rotasi proxy & retry.
 *
 * @param {string} url - URL target
 * @param {object} options - opsi fetch (headers, body, method, dll)
 * @param {object} config - { retries: number, timeout: number }
 * @returns {Promise<Response>}
 */
export async function fetchWithRotation(url, options = {}, config = {}) {
  const { retries = MAX_RETRIES, timeout = 15000 } = config;

  await ensurePool();

  let lastError = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    const proxy = nextProxy();
    if (!proxy) throw new Error('No proxies available in pool.');

    const dispatcher = new ProxyAgent(proxy);
    console.log(`[proxyManager] Attempt ${attempt + 1}/${retries} via ${proxy}`);

    try {
      const res = await undiciFetch(url, {
        ...options,
        dispatcher,
        signal: AbortSignal.timeout(timeout),
      });

      // Cek apakah respons valid (bukan HTML block dari YouTube)
      const contentType = res.headers.get('content-type') || '';
      if (res.status === 403 || res.status === 429) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (contentType.includes('text/html') && url.includes('youtubei')) {
        throw new Error('Received HTML (possible IP block)');
      }

      // Proxy berhasil
      return res;
    } catch (err) {
      lastError = err;
      console.warn(`[proxyManager] Proxy ${proxy} failed: ${err.message}`);
      markDead(proxy); // buang proxy yang gagal
      // Lanjut ke proxy berikutnya
    }
  }

  throw new Error(`All ${retries} proxy attempts failed. Last error: ${lastError?.message}`);
}
