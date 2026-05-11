const express = require("express");
const cors = require("cors");

const app = express();

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "48eeca582e0f41d3b3071f318595bf83";
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
  "user-modify-playback-state",
  "user-read-playback-state",
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
  const { code, redirectUri, codeVerifier } = req.body;
  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
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

  const basicAuth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
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

app.get("/me", async (req, res) => {
  const response = await fetch(`${SPOTIFY_API_URL}/v1/me`, {
    headers: { Authorization: req.headers.authorization },
  });

  const data = await response.json();
  res.status(response.status).json(data);
});

app.listen(8090, () => {
  console.log("Spotify proxy running on http://localhost:8090");
});
