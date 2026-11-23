/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/

import { fetch } from 'undici';

const API_URL = "https://music.youtube.com/youtubei/v1";
let globalVisitorData = null;
let visitorDataTs = 0;
const VISITOR_TTL = 10 * 60 * 1000;

const HEADERS_BASE = {
  'content-type': 'application/json',
  'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36',
  'origin': 'https://music.youtube.com',
  'referer': 'https://music.youtube.com/'
};

async function refreshVisitorData() {
  try {
    const body = {
      context: { client: { clientName: "WEB_REMIX", clientVersion: "1.20261117.06.00", gl: "ID", hl: "id" } },
      browseId: "FEmusic_home"
    };
    const res = await fetch(`${API_URL}/browse?prettyPrint=false`, {
      method: 'POST',
      headers: { ...HEADERS_BASE, 'x-youtube-client-name': '67', 'x-youtube-client-version': '1.20261117.06.00' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.responseContext?.visitorData) {
        globalVisitorData = data.responseContext.visitorData;
        visitorDataTs = Date.now();
        return globalVisitorData;
      }
    }
  } catch (e) { console.error("[VisitorData] Gagal refresh:", e.message); }
  return null;
}

export async function searchMusic(query) {
  if (!globalVisitorData) await refreshVisitorData();
  const body = {
    context: { client: { hl: "id", gl: "ID", visitorData: globalVisitorData, clientName: "WEB_REMIX", clientVersion: "1.20261117.06.00" } },
    query: query
  };
  const res = await fetch(`${API_URL}/search?prettyPrint=false`, {
    method: 'POST',
    headers: { ...HEADERS_BASE, 'x-youtube-client-name': '67', 'x-youtube-client-version': '1.20261117.06.00' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Search HTTP Error: ${res.status}`);
  const data = await res.json();
  const findKey = (obj, target) => {
    let result = [];
    if (obj && typeof obj === 'object') {
      if (obj[target]) result.push(obj[target]);
      for (const key in obj) result = result.concat(findKey(obj[key], target));
    }
    return result;
  };
  const renderers = findKey(data, 'musicResponsiveListItemRenderer');
  const results = [];
  for (const r of renderers) {
    try {
      const videoId = r.playlistItemData?.videoId || r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
      const title = r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || "Unknown";
      if (videoId) { results.push({ videoId, title }); if (results.length >= 10) break; }
    } catch (e) { continue; }
  }
  return results;
}

export async function getStreamUrl(videoId) {
  if (!globalVisitorData) await refreshVisitorData();
  
  // Daftar client yang akan dicoba. Urutan dari yang paling mungkin berhasil.
  const clients = [
    { name: 'IOS', version: '20.10.4', ua: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)' },
    { name: 'ANDROID_VR', version: '1.65.10', ua: 'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip' },
    { name: 'TV', version: '7.20250312.16.00', ua: 'Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version' }
  ];

  for (const client of clients) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const body = {
        context: {
          client: {
            clientName: client.name, clientVersion: client.version,
            gl: "US", hl: "en", visitorData: globalVisitorData
          }
        },
        videoId: videoId, contentCheckOk: true, racyCheckOk: true
      };

      const res = await fetch(`${API_URL}/player?prettyPrint=false`, {
        method: 'POST',
        headers: {
          ...HEADERS_BASE,
          'user-agent': client.ua,
          'x-youtube-client-name': client.name === 'IOS' ? '5' : client.name === 'TV' ? '7' : '28',
          'x-youtube-client-version': client.version,
          'x-goog-visitor-id': globalVisitorData
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) continue;
      const data = await res.json();
      const status = data.playabilityStatus?.status;

      if (status === 'LOGIN_REQUIRED' || status === 'UNPLAYABLE') {
        await refreshVisitorData();
        continue;
      }

      if (status === 'OK') {
        const formats = data.streamingData?.adaptiveFormats || [];
        // Prioritas 1: Cari yang ada 'url' langsung
        let audio = formats.find(f => f.mimeType?.startsWith('audio') && f.url);
        
        // Prioritas 2: Jika tidak ada, coba 'signatureCipher'
        if (!audio) {
          const cipher = formats.find(f => f.mimeType?.startsWith('audio') && f.signatureCipher);
          if (cipher) {
            const params = new URLSearchParams(cipher.signatureCipher);
            audio = { url: `${params.get('url')}&${params.get('sp')}=${params.get('sig')}` };
          }
        }

        if (audio) {
          return {
            videoId, title: data.videoDetails?.title, author: data.videoDetails?.author,
            audioUrl: audio.url, expiresInSeconds: data.streamingData.expiresInSeconds
          };
        }
      }
    }
  }
  throw new Error("Semua client gagal. YouTube memblokir IP ini.");
  }
