/**
 * Spotify Now Playing — Vite Dev Server Middleware
 *
 * This plugin creates a /api/spotify endpoint during development.
 * For production, deploy server/spotify.js as a serverless function
 * (e.g. Vercel, Netlify, or Cloudflare Workers).
 *
 * SETUP:
 * 1. Go to https://developer.spotify.com/dashboard and create an app
 * 2. Set redirect URI to http://localhost:3000/callback
 * 3. Copy Client ID and Client Secret to .env
 * 4. Get a refresh token by running: node server/get-spotify-token.js
 * 5. Add the refresh token to .env
 */

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';

// Cache access token
let tokenCache = { access_token: null, expires_at: 0 };

async function getAccessToken(clientId, clientSecret, refreshToken) {
  if (tokenCache.access_token && Date.now() < tokenCache.expires_at) {
    return tokenCache.access_token;
  }

  const basic = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();
  if (data.access_token) {
    tokenCache = {
      access_token: data.access_token,
      expires_at: Date.now() + (data.expires_in - 60) * 1000,
    };
  }
  return data.access_token;
}

export function spotifyPlugin() {
  return {
    name: 'spotify-now-playing',
    configureServer(server) {
      server.middlewares.use('/api/spotify', async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const clientId = process.env.SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
        const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

        if (!clientId || !clientSecret || !refreshToken) {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: 'Spotify not configured', is_playing: false }));
          return;
        }

        try {
          const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
          if (!accessToken) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: 'Failed to get access token', is_playing: false }));
            return;
          }

          const spotifyRes = await fetch(SPOTIFY_NOW_PLAYING_URL, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (spotifyRes.status === 204 || spotifyRes.status > 400) {
            res.end(JSON.stringify({ is_playing: false }));
            return;
          }

          const data = await spotifyRes.json();
          res.end(JSON.stringify(data));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message, is_playing: false }));
        }
      });
    },
  };
}
