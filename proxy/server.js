const express = require("express");
const cors = require("cors");

const app = express();

const SPOTIFY_CLIENT_ID = "48eeca582e0f41d3b3071f318595bf83";

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_URL = "https://api.spotify.com";

const allowedOrigins = ["https://scott28.github.io"];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS: " + origin));
    }
  },
  methods: ["GET", "POST", "PUT", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "ngrok-skip-browser-warning",
  ],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());

const scopes = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-modify-playback-state",
  "user-read-playback-state",
];

app.get("/", (req, res) => {
  res.send("Spotify proxy running");
});
/*
app.post("/auth-url", (req, res) => {
  const { redirectUri, codeChallenge } = req.body;

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  res.json({
    url: `${SPOTIFY_AUTH_URL}?${params.toString()}`,
  });
});
*/

app.get("/auth-url", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://scott28.github.io");

  const { redirectUri, codeChallenge } = req.query;

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  res.json({
    url: `${SPOTIFY_AUTH_URL}?${params.toString()}`,
  });
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
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await response.json();
  res.status(response.status).json(data);
});

app.get("/me", async (req, res) => {
  const response = await fetch(`${SPOTIFY_API_URL}/v1/me`, {
    headers: {
      Authorization: req.headers.authorization,
    },
  });

  const data = await response.json();
  res.status(response.status).json(data);
});

app.listen(8090, () => {
  console.log("Spotify proxy running 1 on http://localhost:8090");
});
