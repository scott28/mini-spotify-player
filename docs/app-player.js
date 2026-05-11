import { getSpotifyToken } from "./firebase.js";

const proxyBaseUrl = "http://localhost:8090";
let tokenRecord = null;
let selectedPlaylistId = null;
let selectedPlaylistUri = null;
let currentTracks = [];

const statusEl = document.getElementById("status");
const playlistsEl = document.getElementById("playlists");
const tracksEl = document.getElementById("tracks");
const loadPlaylistsBtn = document.getElementById("loadPlaylists");
const playPlaylistBtn = document.getElementById("playPlaylist");

function log(message) { statusEl.textContent += `${message}\n`; }

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
    li.textContent = `${track.name} — ${(track.artists || []).map(a => a.name).join(", ")}`;
    li.onclick = async () => {
      try {
        await proxyPost("/spotify/play-track", {
          accessToken: tokenRecord.accessToken,
          playlistId,
          trackUri: track.uri,
          trackIndex: index,
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
    li.textContent = `${playlist.name} (${playlist.tracks?.total ?? 0} tracks)`;
    li.onclick = async () => {
      selectedPlaylistId = playlist.id;
      selectedPlaylistUri = playlist.uri;
      log(`Selected playlist: ${playlist.name}`);
      playPlaylistBtn.disabled = false;
      const tracks = await proxyPost(`/spotify/playlists/${playlist.id}/tracks`, {
        accessToken: tokenRecord.accessToken,
      });
      renderTracks(tracks.items || [], playlist.id);
    };
    playlistsEl.appendChild(li);
  });
}

document.getElementById("load").onclick = async () => {
  const key = getInputKey();
  if (!key) return log("Enter a temporary username.");

  const record = await getSpotifyToken(key);
  if (!record?.accessToken) return log("Temporary username not found.");

  tokenRecord = record;
  loadPlaylistsBtn.disabled = false;
  log("Token loaded. You can now load playlists.");
};

loadPlaylistsBtn.onclick = async () => {
  if (!tokenRecord?.accessToken) return;
  try {
    const data = await proxyPost("/spotify/me/playlists", { accessToken: tokenRecord.accessToken });
    renderPlaylists(data.items || []);
    log("Playlists loaded.");
  } catch (err) {
    log(`Load playlists failed: ${err.error || JSON.stringify(err)}`);
  }
};

playPlaylistBtn.onclick = async () => {
  if (!selectedPlaylistUri) return log("Select a playlist first.");
  try {
    await proxyPost("/spotify/play", {
      accessToken: tokenRecord.accessToken,
      contextUri: selectedPlaylistUri,
    });
    log("Started playlist playback.");
  } catch (err) {
    log(`Play playlist failed: ${err.error || JSON.stringify(err)}`);
  }
};

const keyParam = new URLSearchParams(window.location.search).get("key");
if (keyParam) document.getElementById("tokenKey").value = keyParam;
