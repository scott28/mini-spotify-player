import { getSpotifyToken, updateSpotifyToken } from "./firebase.js";

const proxyBaseUrl = "http://localhost:8090";
let tokenRecord = null;
let selectedPlaylistId = null;
let selectedPlaylistUri = null;
let currentTracks = [];
let selectedPlaylistName = null;
let playerDeviceId = null;
let tokenKey = null;
let refreshIntervalId = null;

const statusEl = document.getElementById("status");
const playlistsEl = document.getElementById("playlists");
const tracksEl = document.getElementById("tracks");
const loadPlaylistsBtn = document.getElementById("loadPlaylists");
const playPlaylistBtn = document.getElementById("playPlaylist");
const selectedPlaylistEl = document.getElementById("selectedPlaylist");

function isTokenExpired() {
  if (!tokenRecord?.obtainedAt || !tokenRecord?.expiresIn) return false;
  const expiryMs = tokenRecord.obtainedAt + tokenRecord.expiresIn * 1000;
  return Date.now() > expiryMs - 60_000;
}

async function refreshTokenIfNeeded(force = false) {
  if (!tokenRecord?.refreshToken) return;
  if (!force && !isTokenExpired()) return;
  const data = await proxyPost("/refresh", { refreshToken: tokenRecord.refreshToken });
  if (!data.access_token) return;
  tokenRecord = {
    ...tokenRecord,
    accessToken: data.access_token,
    expiresIn: data.expires_in || tokenRecord.expiresIn,
    refreshToken: data.refresh_token || tokenRecord.refreshToken,
    obtainedAt: Date.now(),
  };
  await updateSpotifyToken(tokenKey, tokenRecord);
  log("Access token refreshed in background.");
}

async function ensureBrowserPlayer() {
  if (playerDeviceId || !window.Spotify || !tokenRecord?.accessToken) return;
  const player = new window.Spotify.Player({
    name: "Mini Spotify Browser Player",
    getOAuthToken: async (cb) => {
      await refreshTokenIfNeeded();
      cb(tokenRecord.accessToken);
    },
    volume: 0.8,
  });
  player.addListener("ready", async ({ device_id }) => {
    playerDeviceId = device_id;
    log("Browser player ready.");
    await proxyPost("/spotify/transfer-playback", {
      accessToken: tokenRecord.accessToken,
      deviceId: playerDeviceId,
    });
    log("Playback transferred to browser player.");
  });
  player.addListener("initialization_error", ({ message }) => log(`SDK init error: ${message}`));
  player.addListener("authentication_error", ({ message }) => log(`SDK auth error: ${message}`));
  player.addListener("account_error", ({ message }) => log(`SDK account error: ${message}`));
  await player.connect();
}

function log(message) {
  statusEl.textContent += `${message}\n`;
}

async function proxyPost(path, body) {
  const response = await fetch(`${proxyBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw data;
  return data;
}

function getInputKey() {
  return document.getElementById("tokenKey").value.trim();
}

function renderTracks(items, playlistId) {
  tracksEl.innerHTML = "";
  currentTracks = items;
  items.forEach((item, index) => {
    const track = item.track;
    if (!track) return;
    const li = document.createElement("li");
    li.textContent = `${track.name} — ${(track.artists || []).map((a) => a.name).join(", ")}`;
    li.onclick = async () => {
      try {
        await refreshTokenIfNeeded();
        await proxyPost("/spotify/play-track", {
          accessToken: tokenRecord.accessToken,
          playlistId,
          trackUri: track.uri,
          trackIndex: index,
          deviceId: playerDeviceId,
        });
        log(`Playing track: ${track.name}`);
      } catch (err) {
        log(`Play track failed: ${err.error || JSON.stringify(err)}`);
      }
    };
    tracksEl.appendChild(li);
  });
}

function renderPlaylists(playlists) {
  playlistsEl.innerHTML = "";
  playlists.forEach((playlist) => {
    const li = document.createElement("li");
    li.textContent = `${playlist.name} (${playlist.items?.total ?? 0} tracks)`;
    li.onclick = async () => {
      selectedPlaylistId = playlist.id;
      selectedPlaylistUri = playlist.uri;
      selectedPlaylistName = playlist.name;
      selectedPlaylistEl.textContent = `Selected: ${selectedPlaylistName}`;
      log(`Selected playlist: ${playlist.name}`);
      playPlaylistBtn.disabled = false;
      const tracks = await proxyPost(
        `/spotify/playlists/${playlist.id}/tracks`,
        {
          accessToken: tokenRecord.accessToken,
        },
      );
      renderTracks(tracks.items || [], playlist.id);
    };
    playlistsEl.appendChild(li);
  });
}

document.getElementById("load").onclick = async () => {
  tokenKey = getInputKey();
  if (!tokenKey) return log("Enter a temporary username.");

  try {
    const record = await getSpotifyToken(tokenKey);
    if (!record?.accessToken) return log("Temporary username not found.");

    tokenRecord = record;
    try {
      await refreshTokenIfNeeded(true);
    } catch (err) {
      const isRevoked = err?.error === "invalid_grant";
      if (isRevoked && !isTokenExpired()) {
        log("Refresh token was revoked, but current access token is still valid.");
      } else if (isRevoked) {
        tokenRecord = null;
        return log("Refresh token was revoked and access token is expired. Please log in again.");
      } else {
        throw err;
      }
    }

    if (refreshIntervalId) clearInterval(refreshIntervalId);
    refreshIntervalId = setInterval(() => {
      refreshTokenIfNeeded().catch((err) => log(`Background refresh failed: ${err.error || JSON.stringify(err)}`));
    }, 60_000);
    await ensureBrowserPlayer();
    loadPlaylistsBtn.disabled = false;
    log("Token loaded. You can now load playlists.");
  } catch (err) {
    log(`Load token failed: ${err.error || JSON.stringify(err)}`);
  }
};

loadPlaylistsBtn.onclick = async () => {
  if (!tokenRecord?.accessToken) return;
  try {
    await refreshTokenIfNeeded();
    const data = await proxyPost("/spotify/me/playlists", {
      accessToken: tokenRecord.accessToken,
    });
    renderPlaylists(data.items || []);
    log("Playlists loaded.");
  } catch (err) {
    log(`Load playlists failed: ${err.error || JSON.stringify(err)}`);
  }
};

playPlaylistBtn.onclick = async () => {
  if (!selectedPlaylistUri) return log("Select a playlist first.");
  try {
    await refreshTokenIfNeeded();
    await ensureBrowserPlayer();
    const startAt = Number(document.getElementById("startAt").value || 0);
    await proxyPost("/spotify/play", {
      accessToken: tokenRecord.accessToken,
      contextUri: selectedPlaylistUri,
      deviceId: playerDeviceId,
      offset: startAt,
    });
    log(`Started playlist playback from track #${startAt + 1}.`);
  } catch (err) {
    log(`Play playlist failed: ${err.error || JSON.stringify(err)}`);
  }
};

const keyParam = new URLSearchParams(window.location.search).get("key");
const savedKey = localStorage.getItem("mini_spotify_last_username");
if (keyParam) {
  document.getElementById("tokenKey").value = keyParam;
  localStorage.setItem("mini_spotify_last_username", keyParam);
} else if (savedKey) {
  document.getElementById("tokenKey").value = savedKey;
}
