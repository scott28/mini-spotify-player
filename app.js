const clientId = "48eeca582e0f41d3b3071f318595bf83";

const proxyBaseUrl = "https://d4bc-64-44-118-107.ngrok-free.app";
const redirectUri = "https://scott28.github.io/mini-spotify-player/";

let spotifyPlayer = null;

const statusEl = document.getElementById("status");

function log(message) {
  statusEl.textContent += message + "\n";
}

function generateRandomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));

  return Array.from(values)
    .map(x => chars[x % chars.length])
    .join("");
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await crypto.subtle.digest("SHA-256", data);
}

function base64urlencode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

document.getElementById("login").onclick = async () => {
  const verifier = generateRandomString(64);
  localStorage.setItem("spotify_code_verifier", verifier);

  const challenge = base64urlencode(await sha256(verifier));
/*
  const response = await fetch(`${proxyBaseUrl}/auth-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true"
    },
    body: JSON.stringify({
      redirectUri,
      codeChallenge: challenge
    })
  });
*/
const response = await fetch(
  `${proxyBaseUrl}/auth-url?redirectUri=${encodeURIComponent(redirectUri)}&codeChallenge=${encodeURIComponent(challenge)}`
);  

  const data = await response.json();

  if (!response.ok) {
    log(JSON.stringify(data, null, 2));
    return;
  }

  window.location.href = data.url;
};

async function getAccessToken() {
  const existingToken = localStorage.getItem("spotify_access_token");
  if (existingToken) return existingToken;

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (!code) return null;

  const verifier = localStorage.getItem("spotify_code_verifier");

  const response = await fetch(`${proxyBaseUrl}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true"
    },
    body: JSON.stringify({
      code,
      redirectUri,
      codeVerifier: verifier
    })
  });

  const data = await response.json();

  if (!response.ok) {
    log("Token error:");
    log(JSON.stringify(data, null, 2));
    return null;
  }

  localStorage.setItem("spotify_access_token", data.access_token);

  window.history.replaceState({}, document.title, redirectUri);

  return data.access_token;
}

document.getElementById("profile").onclick = async () => {
  const token = await getAccessToken();

  if (!token) {
    log("Not logged in.");
    return;
  }

  const response = await fetch(`${proxyBaseUrl}/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json();
  log(JSON.stringify(data, null, 2));
};

document.getElementById("togglePlay").onclick = async () => {
  if (!spotifyPlayer) {
    log("Player not ready yet.");
    return;
  }

  await spotifyPlayer.togglePlay();
};

document.getElementById("logout").onclick = () => {
  localStorage.removeItem("spotify_access_token");
  localStorage.removeItem("spotify_code_verifier");
  log("Logged out.");
};

window.onSpotifyWebPlaybackSDKReady = async () => {
  const token = await getAccessToken();

  if (!token) {
    log("Click Login.");
    return;
  }

  spotifyPlayer = new Spotify.Player({
    name: "Scott Mini Player",
    getOAuthToken: cb => cb(token),
    volume: 0.5
  });

  spotifyPlayer.addListener("ready", ({ device_id }) => {
    log("Spotify player ready.");
    log("Device ID: " + device_id);
    log("Open Spotify and select 'Scott Mini Player' from devices.");
  });

  spotifyPlayer.addListener("not_ready", ({ device_id }) => {
    log("Device went offline: " + device_id);
  });

  spotifyPlayer.addListener("initialization_error", ({ message }) => log(message));
  spotifyPlayer.addListener("authentication_error", ({ message }) => log(message));
  spotifyPlayer.addListener("account_error", ({ message }) => log(message));
  spotifyPlayer.addListener("playback_error", ({ message }) => log(message));

  await spotifyPlayer.connect();
};
