/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/

import { SociolodClient } from 'sociolod';

const client = new SociolodClient();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { videoId } = req.query;
  
  if (!videoId) {
    return res.status(400).json({ success: false, error: 'Missing "videoId"' });
  }

  try {
    // Format URL YouTube Music ke format YouTube standar
    const youtubeUrl = `https://youtube.com/watch?v=${videoId}`;
    
    // Minta URL download dalam format MP3 (audio)
    // SDK ini yang akan berkomunikasi dengan API-nya di Cloudflare Workers
    const { url } = await client.youtube.download.url(youtubeUrl, {
      format: 'mp3'
    });

    return res.status(200).json({
      success: true,
      data: {
        videoId,
        audioUrl: url,
        format: 'mp3',
        source: 'sociolod / LiteType API'
      }
    });

  } catch (err) {
    return res.status(502).json({ 
      success: false, 
      error: err.message,
      hint: 'Coba lagi. Jika terus gagal, API LiteType mungkin sedang down.'
    });
  }
}
