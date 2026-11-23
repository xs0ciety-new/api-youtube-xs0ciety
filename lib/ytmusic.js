/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/

const API_URL = "https://music.youtube.com/youtubei/v1";
let globalVisitorData = null;

// Helper untuk dapet VisitorData (Biar gak kena block YouTube)
async function getVisitorData() {
  if (globalVisitorData) return globalVisitorData;
  try {
    const res = await fetch(`${API_URL}/browse?prettyPrint=false`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'x-youtube-client-name': '67',
        'x-youtube-client-version': '1.20261117.06.00'
      },
      body: JSON.stringify({
        context: { client: { clientName: "WEB_REMIX", clientVersion: "1.20261117.06.00", gl: "ID", hl: "id" } },
        browseId: "FEmusic_home"
      })
    });
    const data = await res.json();
    globalVisitorData = data.responseContext?.visitorData || null;
    return globalVisitorData;
  } catch (e) { return null; }
}

// Parser JSON YouTube yang berantakan
function findKey(obj, target) {
  let result = [];
  if (obj && typeof obj === 'object') {
    if (obj[target]) result.push(obj[target]);
    for (const key in obj) result = result.concat(findKey(obj[key], target));
  }
  return result;
}

// ==========================================
// 1. SEARCH MUSIC
// ==========================================
export async function searchMusic(query) {
  const visitorData = await getVisitorData();
  const res = await fetch(`${API_URL}/search?prettyPrint=false`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'x-youtube-client-name': '67',
      'x-youtube-client-version': '1.20261117.06.00'
    },
    body: JSON.stringify({
      context: { client: { hl: "id", gl: "ID", visitorData, clientName: "WEB_REMIX", clientVersion: "1.20261117.06.00" } },
      query: query
    })
  });

  if (!res.ok) throw new Error(`Search Error: ${res.status}`);
  const data = await res.json();
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

// ==========================================
// 2. HOME FEED
// ==========================================
export async function getHomeFeed() {
  const visitorData = await getVisitorData();
  const res = await fetch(`${API_URL}/browse?prettyPrint=false`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'x-youtube-client-name': '67',
      'x-youtube-client-version': '1.20261117.06.00'
    },
    body: JSON.stringify({
      context: { client: { hl: "id", gl: "ID", visitorData, clientName: "WEB_REMIX", clientVersion: "1.20261117.06.00" } },
      browseId: "FEmusic_home"
    })
  });

  if (!res.ok) throw new Error(`Home Feed Error: ${res.status}`);
  const data = await res.json();

  const sections = [];
  const carousels = findKey(data, 'musicCarouselShelfRenderer');
  
  for (const carousel of carousels) {
    const title = carousel.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text || "Rekomendasi";
    const items = [];
    const renderers = findKey(carousel, 'musicTwoRowItemRenderer');
    
    for (const r of renderers) {
      const videoId = r.navigationEndpoint?.watchEndpoint?.videoId;
      const browseId = r.navigationEndpoint?.browseEndpoint?.browseId;
      const itemTitle = r.title?.runs?.[0]?.text || "Unknown";
      const thumbnail = r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url;
      
      if (videoId) items.push({ type: 'song', videoId, title: itemTitle, thumbnail });
      else if (browseId) items.push({ type: 'playlist', browseId, title: itemTitle, thumbnail });
    }
    if (items.length > 0) sections.push({ title, items });
  }
  return { sections };
}

// ==========================================
// 3. GET LYRICS
// ==========================================
export async function getLyrics(videoId) {
  const visitorData = await getVisitorData();
  const res = await fetch(`${API_URL}/next?prettyPrint=false`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'x-youtube-client-name': '67',
      'x-youtube-client-version': '1.20261117.06.00'
    },
    body: JSON.stringify({
      context: { client: { hl: "id", gl: "ID", visitorData, clientName: "WEB_REMIX", clientVersion: "1.20261117.06.00" } },
      videoId: videoId
    })
  });

  if (!res.ok) throw new Error(`Lyrics Error: ${res.status}`);
  const data = await res.json();

  // Cari browseId lirik (biasanya berawalan MPLYt)
  const allBrowseIds = findKey(data, 'browseId');
  const lyricsBrowseId = allBrowseIds.find(id => id?.startsWith('MPLYt'));

  if (!lyricsBrowseId) {
    return { available: false, message: "Lirik tidak tersedia untuk lagu ini." };
  }

  const lyricsRes = await fetch(`${API_URL}/browse?prettyPrint=false`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'x-youtube-client-name': '67',
      'x-youtube-client-version': '1.20261117.06.00'
    },
    body: JSON.stringify({
      context: { client: { hl: "id", gl: "ID", visitorData, clientName: "WEB_REMIX", clientVersion: "1.20261117.06.00" } },
      browseId: lyricsBrowseId
    })
  });

  const lyricsData = await lyricsRes.json();
  
  // Ekstrak teks lirik
  let lyricsText = findKey(lyricsData, 'description')[0]?.runs?.map(r => r.text).join('') 
    || findKey(lyricsData, 'lyrics')[0] 
    || null;

  if (!lyricsText) {
    return { available: false, message: "Gagal mengekstrak teks lirik." };
  }

  return { available: true, lyrics: lyricsText };
}