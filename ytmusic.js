/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/

import {
  YTMUSIC_BASE,
  YTMUSIC_API,
  WEB_REMIX_CLIENT_NAME,
  WEB_REMIX_CLIENT_ID,
  DEFAULT_WEB_REMIX_VERSION,
  ANDROID_MUSIC_CLIENT_NAME,
  ANDROID_MUSIC_CLIENT_VERSION,
  ANDROID_MUSIC_CLIENT_ID,
  VISIONOS_CLIENT_NAME,
  VISIONOS_CLIENT_VERSION,
  VISIONOS_CLIENT_ID,
  USER_AGENT,
  ANDROID_USER_AGENT,
  VISIONOS_USER_AGENT,
} from './config.js';

import { fetchWithRotation } from './proxyManager.js';

let _cache = { apiKey: null, webRemixVersion: null, visitorData: null, ts: 0 };
const CACHE_TTL = 1000 * 60 * 60; // 1 jam

async function fetchConfig(force = false) {
  const now = Date.now();
  if (!force && _cache.apiKey && now - _cache.ts < CACHE_TTL) {
    return _cache;
  }

  const res = await fetchWithRotation(YTMUSIC_BASE + '/', {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'en-US,en;q=0.9',
      'Cookie': 'SOCS=CAI',
    },
  });

  if (!res.ok) throw new Error(`Config fetch failed: HTTP ${res.status}`);

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    throw new Error(`Config fetch returned non-HTML (${contentType}). Possible proxy blocked.`);
  }

  const html = await res.text();
  const apiKey = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/)?.[1];
  const clientVer = html.match(/"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"]+)"/)?.[1];
  const visitorData = html.match(/"VISITOR_DATA"\s*:\s*"([^"]+)"/)?.[1];

  if (!apiKey) {
    throw new Error('INNERTUBE_API_KEY not found. Proxy pool may be exhausted or IP blocked.');
  }

  _cache = {
    apiKey,
    webRemixVersion: clientVer || DEFAULT_WEB_REMIX_VERSION,
    visitorData: visitorData || null,
    ts: now,
  };

  return _cache;
}

async function innerTubePost(endpoint, body, opts = {}) {
  const { apiKey, webRemixVersion } = await fetchConfig();

  const {
    clientName = WEB_REMIX_CLIENT_NAME,
    clientId = WEB_REMIX_CLIENT_ID,
    clientVersion = webRemixVersion,
    userAgent = USER_AGENT,
    extraHeaders = {},
  } = opts;

  const url = `${YTMUSIC_API}/${endpoint}?key=${apiKey}&prettyPrint=false`;

  const res = await fetchWithRotation(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': userAgent,
      'Origin': YTMUSIC_BASE,
      'Referer': YTMUSIC_BASE + '/',
      'X-YouTube-Client-Name': clientId,
      'X-YouTube-Client-Version': clientVersion,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 400) {
    const errText = await res.text();
    if (errText.includes('INVALID_ARGUMENT') || errText.includes('clientVersion')) {
      await fetchConfig(true); // refresh config
      throw new Error('Client version expired. Config refreshed, please retry request.');
    }
    throw new Error(`InnerTube ${endpoint} 400: ${errText.slice(0, 200)}`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`InnerTube ${endpoint} HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

function walkFor(obj, key, results = []) {
  if (!obj || typeof obj !== 'object') return results;
  if (Array.isArray(obj)) {
    for (const item of obj) walkFor(item, key, results);
    return results;
  }
  if (obj[key]) results.push(obj[key]);
  for (const k of Object.keys(obj)) {
    if (k !== key) walkFor(obj[k], key, results);
  }
  return results;
}

function getTextRuns(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (obj.simpleText) return obj.simpleText;
  if (obj.runs) return obj.runs.map((r) => r.text).join('');
  return '';
}

function parseResponsiveItem(r) {
  const videoId = r.playlistItemData?.videoId;
  if (!videoId) return null;
  const title = getTextRuns(r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text);
  const subtitleRuns = r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
  const subtitle = subtitleRuns.map((x) => x.text).join('');
  const thumb = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || null;
  const duration = r.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs?.map((x) => x.text).join('') || null;
  return { type: 'song', videoId, title, subtitle, thumbnail: thumb, duration };
}

function parseTwoRowItem(r) {
  const title = getTextRuns(r.title);
  const subtitle = getTextRuns(r.subtitle);
  const browseEndpoint = r.navigationEndpoint?.browseEndpoint;
  const watchEndpoint = r.navigationEndpoint?.watchEndpoint;
  const id = browseEndpoint?.browseId || watchEndpoint?.videoId || null;
  const pageType = browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;

  if (!id) return null;
  const thumb = r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || null;

  return {
    type: pageType === 'MUSIC_PAGE_TYPE_ALBUM' ? 'album' : pageType === 'MUSIC_PAGE_TYPE_PLAYLIST' ? 'playlist' : pageType === 'MUSIC_PAGE_TYPE_ARTIST' ? 'artist' : 'unknown',
    id, title, subtitle, thumbnail: thumb,
  };
}

function extractMusicItems(data) {
  const items = [];
  for (const r of walkFor(data, 'musicResponsiveListItemRenderer')) {
    const item = parseResponsiveItem(r);
    if (item) items.push(item);
  }
  for (const r of walkFor(data, 'musicTwoRowItemRenderer')) {
    const item = parseTwoRowItem(r);
    if (item) items.push(item);
  }
  return items;
}

export async function getHomeFeed() {
  const { webRemixVersion, visitorData } = await fetchConfig();

  const body = {
    context: {
      client: {
        clientName: WEB_REMIX_CLIENT_NAME,
        clientVersion: webRemixVersion,
        gl: 'US',
        hl: 'en',
        originalUrl: YTMUSIC_BASE,
        ...(visitorData ? { visitorData } : {}),
      },
    },
    browseId: 'FEmusic_home',
  };

  const data = await innerTubePost('browse', body);

  const sections = [];
  for (const s of walkFor(data, 'musicCarouselShelfRenderer')) {
    const title = getTextRuns(s.header?.musicCarouselShelfBasicHeaderRenderer?.title);
    const sectionItems = [];
    for (const r of walkFor(s, 'musicTwoRowItemRenderer')) {
      const item = parseTwoRowItem(r);
      if (item) sectionItems.push(item);
    }
    for (const r of walkFor(s, 'musicResponsiveListItemRenderer')) {
      const item = parseResponsiveItem(r);
      if (item) sectionItems.push(item);
    }
    if (sectionItems.length > 0) sections.push({ title, items: sectionItems });
  }

  return { sections, allItems: extractMusicItems(data) };
}

export async function searchMusic(query, { limit = 20 } = {}) {
  const { webRemixVersion, visitorData } = await fetchConfig();

  const body = {
    context: {
      client: {
        clientName: WEB_REMIX_CLIENT_NAME,
        clientVersion: webRemixVersion,
        gl: 'US',
        hl: 'en',
        originalUrl: YTMUSIC_BASE,
        ...(visitorData ? { visitorData } : {}),
      },
    },
    query,
    params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D',
  };

  const data = await innerTubePost('search', body);
  return extractMusicItems(data).slice(0, limit);
}

export async function browseMusic(browseId) {
  const { webRemixVersion, visitorData } = await fetchConfig();

  const body = {
    context: {
      client: {
        clientName: WEB_REMIX_CLIENT_NAME,
        clientVersion: webRemixVersion,
        gl: 'US',
        hl: 'en',
        originalUrl: YTMUSIC_BASE,
        ...(visitorData ? { visitorData } : {}),
      },
    },
    browseId,
  };

  const data = await innerTubePost('browse', body);

  const header = data.header?.musicDetailHeaderRenderer || data.header?.musicEditablePlaylistDetailHeaderRenderer || null;
  const tracks = [];
  for (const r of walkFor(data, 'musicResponsiveListItemRenderer')) {
    const item = parseResponsiveItem(r);
    if (item) tracks.push(item);
  }

  return {
    browseId,
    title: getTextRuns(header?.title),
    subtitle: getTextRuns(header?.subtitle),
    thumbnail: header?.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || null,
    tracks,
  };
}

async function tryPlayerWithClient(videoId, clientConfig) {
  const { apiKey } = await fetchConfig();
  const url = `${YTMUSIC_API}/player?key=${apiKey}&prettyPrint=false`;

  const body = {
    context: { client: clientConfig.context },
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
  };

  const res = await fetchWithRotation(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': clientConfig.userAgent,
      'X-YouTube-Client-Name': clientConfig.clientId,
      'X-YouTube-Client-Version': clientConfig.clientVersion,
      'Origin': YTMUSIC_BASE,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  const data = await res.json();

  const status = data.playabilityStatus?.status;
  if (status !== 'OK') return { ok: false, error: status };

  const adaptiveFormats = data.streamingData?.adaptiveFormats || [];
  const audioFormats = adaptiveFormats
    .filter((f) => f.mimeType?.startsWith('audio/') && f.url)
    .map((f) => ({
      itag: f.itag,
      mimeType: f.mimeType,
      bitrate: f.bitrate,
      codec: f.mimeType?.includes('opus') ? 'opus' : 'm4a',
      url: f.url,
    }))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  if (audioFormats.length === 0) return { ok: false, error: 'no pre-signed audio URLs' };

  const expiresInSeconds = parseInt(data.streamingData?.expiresInSeconds || '21600', 10);
  const expiresAt = Date.now() + expiresInSeconds * 1000;

  return {
    ok: true,
    videoId,
    title: data.videoDetails?.title,
    author: data.videoDetails?.author,
    lengthSeconds: data.videoDetails?.lengthSeconds,
    thumbnail: data.videoDetails?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || null,
    audioFormats,
    bestAudio: audioFormats[0],
    expiresInSeconds,
    expiresAt,
    clientUsed: clientConfig.name,
  };
}

export async function getStreamUrl(videoId) {
  const clients = [
    {
      name: 'ANDROID_MUSIC',
      clientId: ANDROID_MUSIC_CLIENT_ID,
      clientVersion: ANDROID_MUSIC_CLIENT_VERSION,
      userAgent: ANDROID_USER_AGENT,
      context: {
        clientName: ANDROID_MUSIC_CLIENT_NAME,
        clientVersion: ANDROID_MUSIC_CLIENT_VERSION,
        androidSdkVersion: 30,
        osName: 'Android',
        osVersion: '11',
        gl: 'US',
        hl: 'en',
      },
    },
    {
      name: 'VISIONOS',
      clientId: VISIONOS_CLIENT_ID,
      clientVersion: VISIONOS_CLIENT_VERSION,
      userAgent: VISIONOS_USER_AGENT,
      context: {
        clientName: VISIONOS_CLIENT_NAME,
        clientVersion: VISIONOS_CLIENT_VERSION,
        deviceMake: 'Apple',
        deviceModel: 'RealityDevice17,1',
        osName: 'visionOS',
        osVersion: '26.5.23O471',
        gl: 'US',
        hl: 'en',
      },
    },
  ];

  const errors = [];
  for (const client of clients) {
    try {
      const result = await tryPlayerWithClient(videoId, client);
      if (result.ok) return result;
      errors.push(`${client.name}: ${result.error}`);
    } catch (e) {
      errors.push(`${client.name}: ${e.message}`);
    }
  }
  throw new Error(`All stream clients failed: ${errors.join(' | ')}`);
}
