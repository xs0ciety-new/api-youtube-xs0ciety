/*
Scrape by xs0ciety505/xs0cietyHUB
t.me/xs0cietyHUB
wa.me/9779845668812
*/

import { browseMusic } from '../lib/ytmusic.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Use GET' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing "id" (browseId)' });
  }

  try {
    const data = await browseMusic(id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[browse]', err);
    return res.status(502).json({ success: false, error: err.message });
  }
}