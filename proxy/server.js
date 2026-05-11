require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

const SPOTIFY_CLIENT_ID =
  process.env.SPOTIFY_CLIENT_ID || "48eeca582e0f41d3b3071f318595bf83";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_URL = "https://api.spotify.com";

const allowedOrigins = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "https://scott28.github.io",
];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const scopes = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
];

app.get("/", (req, res) => res.send("Spotify proxy running"));

app.get("/auth-url", (req, res) => {
  const { redirectUri, codeChallenge } = req.query;

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  res.json({ url: `${SPOTIFY_AUTH_URL}?${params.toString()}` });
});

app.post("/token", async (req, res) => {
  try {
    const { code, redirectUri, codeVerifier, clientId } = req.body;

    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("Token exchange failed:", err);
    res
      .status(500)
      .json({ error: "token_exchange_failed", details: err.message });
  }
});

app.post("/refresh", async (req, res) => {
  if (!SPOTIFY_CLIENT_SECRET) {
    res.status(500).json({ error: "SPOTIFY_CLIENT_SECRET is not configured." });
    return;
  }

  const { refreshToken } = req.body;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const basicAuth = Buffer.from(
    `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`,
  ).toString("base64");

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body,
  });

  const data = await response.json();
  res.status(response.status).json(data);
});

async function spotifyRequest(
  path,
  accessToken,
  method = "GET",
  bodyObj = undefined,
) {
  const response = await fetch(`${SPOTIFY_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: bodyObj ? JSON.stringify(bodyObj) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  return { status: response.status, data };
}

app.post("/spotify/me/playlists", async (req, res) => {
  const { accessToken } = req.body;
  const { status, data } = await spotifyRequest(
    "/v1/me/playlists",
    accessToken,
  );
  res.status(status).json(data);
});

app.post("/spotify/playlists/:playlistId/tracks", async (req, res) => {
  const { accessToken } = req.body;
  const { playlistId } = req.params;
  const { status, data } = await spotifyRequest(
    `/v1/playlists/${playlistId}/items`,
    accessToken,
  );
  res.status(status).json(data);
});

async function getActiveDeviceId(accessToken) {
  const { status, data } = await spotifyRequest(
    "/v1/me/player/devices",
    accessToken,
  );
  if (status >= 400) return { error: data, status };
  const active =
    (data.devices || []).find((d) => d.is_active) || data.devices?.[0];
  return { deviceId: active?.id || null };
}

app.post("/spotify/play", async (req, res) => {
  const { accessToken, contextUri, deviceId, offset } = req.body;
  const targetDeviceId = deviceId || (await getActiveDeviceId(accessToken)).deviceId;
  if (!targetDeviceId) {
    res.status(400).json({ error: "No active device found." });
    return;
  }

  const { status, data } = await spotifyRequest(
    `/v1/me/player/play?device_id=${encodeURIComponent(targetDeviceId)}`,
    accessToken,
    "PUT",
    {
      context_uri: contextUri,
      ...(offset !== undefined ? { offset: { position: Number(offset) || 0 } } : {}),
    },
  );
  res.status(status).json(data);
});

app.post("/spotify/transfer-playback", async (req, res) => {
  const { accessToken, deviceId } = req.body;
  const { status, data } = await spotifyRequest(
    "/v1/me/player",
    accessToken,
    "PUT",
    { device_ids: [deviceId], play: false },
  );
  res.status(status).json(data);
});

app.post("/spotify/play-track", async (req, res) => {
  const { accessToken, playlistId, trackUri, trackIndex, deviceId } = req.body;
  const targetDeviceId = deviceId || (await getActiveDeviceId(accessToken)).deviceId;
  if (!targetDeviceId) {
    res.status(400).json({
      error:
        "No active device found. Open Spotify on one of your devices first.",
    });
    return;
  }

  const { status, data } = await spotifyRequest(
    `/v1/me/player/play?device_id=${encodeURIComponent(targetDeviceId)}`,
    accessToken,
    "PUT",
    {
      context_uri: `spotify:playlist:${playlistId}`,
      offset: trackUri
        ? { uri: trackUri }
        : { position: Number(trackIndex) || 0 },
    },
  );
  res.status(status).json(data);
});

app.listen(8090, () => {
  console.log("Spotify proxy running on http://localhost:8090");
});
