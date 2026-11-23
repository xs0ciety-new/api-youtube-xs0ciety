/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/

// Daftar instance yang akan dicoba secara berurutan.
// Kamu bisa menambah/mengurangi sesuai kebutuhan.
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net', // Paling andal per mid-2026[reference:7]
  'https://invidious.nerdvpn.de',
  'https://yewtu.be',
];

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks', // Instance resmi[reference:8]
  'https://pipedapi.adminforge.de', // Alternatif populer[reference:9]
  'https://api.piped.yt', // Cadangan[reference:10]
];

/**
 * Mencari lagu dengan mencoba setiap instance secara berurutan.
 * @param {string} query - Kata kunci pencarian.
 * @returns {Promise<Array>} Daftar hasil pencarian.
 */
export async function searchWithRotation(query) {
  // 1. Coba Invidious
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(`${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
      if (!res.ok) continue; // Gagal, coba instance berikutnya
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map(item => ({
          videoId: item.videoId,
          title: item.title,
          author: item.author,
          thumbnail: item.videoThumbnails?.[0]?.url,
        }));
      }
    } catch (e) {
      console.warn(`[Invidious] ${base} failed: ${e.message}`);
    }
  }

  // 2. Coba Piped jika Invidious gagal
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${base}/search?q=${encodeURIComponent(query)}&filter=music_songs`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        return data.items.map(item => ({
          videoId: item.url.replace('/watch?v=', ''),
          title: item.title,
          author: item.uploaderName,
          thumbnail: item.thumbnail,
        }));
      }
    } catch (e) {
      console.warn(`[Piped] ${base} failed: ${e.message}`);
    }
  }

  throw new Error('Semua instance untuk pencarian gagal.');
}

/**
 * Mendapatkan URL stream audio dengan rotasi instance.
 * @param {string} videoId - ID video YouTube.
 * @returns {Promise<object>} Objek berisi URL audio dan metadata.
 */
export async function getStreamWithRotation(videoId) {
  // 1. Coba Invidious
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(`${base}/api/v1/videos/${videoId}`);
      if (!res.ok) continue;
      const data = await res.json();

      // Invidious mengembalikan audio stream di adaptiveFormats
      const audioFormats = data.adaptiveFormats?.filter(f => f.type?.startsWith('audio/')) || [];
      if (audioFormats.length > 0) {
        // Pilih bitrate tertinggi
        const bestAudio = audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
        return {
          url: bestAudio.url,
          title: data.title,
          author: data.author,
          lengthSeconds: data.lengthSeconds,
          clientUsed: `Invidious (${base})`,
        };
      }
    } catch (e) {
      console.warn(`[Invidious Stream] ${base} failed: ${e.message}`);
    }
  }

  // 2. Coba Piped jika Invidious gagal
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${base}/streams/${videoId}`);
      if (!res.ok) continue;
      const data = await res.json();

      if (data.audioStreams && data.audioStreams.length > 0) {
        const bestAudio = data.audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
        return {
          url: bestAudio.url,
          title: data.title,
          author: data.uploader,
          lengthSeconds: data.duration,
          clientUsed: `Piped (${base})`,
        };
      }
    } catch (e) {
      console.warn(`[Piped Stream] ${base} failed: ${e.message}`);
    }
  }

  throw new Error('Semua instance untuk stream gagal.');
}
