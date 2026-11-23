/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/

import { getHomeFeed } from '../lib/ytmusic.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Use GET' });

  try {
    const data = await getHomeFeed();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[home]', err);
    return res.status(502).json({ success: false, error: err.message });
  }
}