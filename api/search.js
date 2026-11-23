/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/

import { searchMusic } from '../lib/ytmusic.js';

export default async function handler(req, res) {
  // CORS biar bisa dipake di frontend mana aja
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use GET.' });
  }

  const { q } = req.query;
  if (!q || typeof q !== 'string' || !q.trim()) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing query parameter "q"', 
      example: '/api/search?q=Ed+Sheeran' 
    });
  }

  try {
    const data = await searchMusic(q.trim());
    return res.status(200).json({ 
      success: true, 
      query: q, 
      count: data.length, 
      data 
    });
  } catch (err) {
    console.error('[API Search Error]', err);
    return res.status(502).json({ 
      success: false, 
      error: err.message 
    });
  }
}
