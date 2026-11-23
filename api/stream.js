/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/

import { getStreamUrl } from '../lib/ytmusic.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Use GET' });

  const { videoId } = req.query;
  if (!videoId || typeof videoId !== 'string' || videoId.length < 5) {
    return res.status(400).json({ success: false, error: 'Missing "videoId"', example: '/api/stream?videoId=dQw4w9WgXcQ' });
  }

  try {
    const data = await getStreamUrl(videoId);
    return res.status(200).json({
      success: true,
      data,
      warning: 'Stream URLs expire. Cek field expiresAt untuk auto-refresh.',
    });
  } catch (err) {
    console.error('[stream]', err);
    return res.status(502).json({ success: false, error: err.message });
  }
}