/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/

const API_URL = "https://music.youtube.com/youtubei/v1";
let globalVisitorData = null;

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
  } catch (e) {
    return null;
  }
}

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

  // Parsing JSON YouTube yang berantakan
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
