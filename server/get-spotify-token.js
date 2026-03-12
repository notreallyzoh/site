/**
 * Spotify Refresh Token Generator
 *
 * Run: node server/get-spotify-token.js
 *
 * Steps:
 * 1. Make sure SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are in .env
 * 2. Run this script — it opens a browser URL
 * 3. Log in and approve → redirected to localhost with a code
 * 4. The script exchanges the code for a refresh token
 * 5. Copy the refresh token to .env as SPOTIFY_REFRESH_TOKEN
 */

import { createServer } from 'http';
import { config } from 'dotenv';
import { execSync } from 'child_process';
config();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:8888/callback';
const SCOPES = 'user-read-currently-playing user-read-playback-state';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env first');
  process.exit(1);
}

const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${CLIENT_ID}&scope=${encodeURIComponent(SCOPES)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

console.log('\n🎵 Open this URL in your browser:\n');
console.log(authUrl);
console.log('\nWaiting for Spotify callback...\n');

const server = createServer(async (req, res) => {
  if (!req.url.startsWith('/callback')) {
    res.end('Not found');
    return;
  }

  const url = new URL(req.url, 'http://localhost:8888');
  const code = url.searchParams.get('code');

  if (!code) {
    res.end('No code received');
    return;
  }

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const data = await tokenRes.json();

    if (data.refresh_token) {
      console.log('✅ SUCCESS! Add this to your .env file:\n');
      console.log(`SPOTIFY_REFRESH_TOKEN=${data.refresh_token}`);
      console.log('\nThen restart the dev server.');
      res.end('✅ Token received! Check your terminal. You can close this tab.');
    } else {
      console.error('❌ Error:', data);
      res.end('Error: ' + JSON.stringify(data));
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    res.end('Error: ' + err.message);
  }

  setTimeout(() => process.exit(0), 1000);
});

server.listen(8888, () => {
  console.log('Callback server listening on http://localhost:8888');
});
