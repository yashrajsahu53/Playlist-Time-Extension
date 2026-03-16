const statusElement = document.getElementById('status');
const resultElement = document.getElementById('result');
const detailsElement = document.getElementById('details');
const speedListElement = document.getElementById('speedList');
const refreshButton = document.getElementById('refreshButton');

const playbackSpeeds = [1, 1.25, 1.5, 2];

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.dataset.state = isError ? 'error' : 'info';
}

function formatTotal(seconds) {
  const roundedSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const remainingSeconds = roundedSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

function renderSpeedBreakdown(totalSeconds) {
  speedListElement.innerHTML = '';

  for (const speed of playbackSpeeds) {
    const row = document.createElement('div');
    row.className = 'speed-row';

    const speedLabel = document.createElement('span');
    speedLabel.className = 'speed-label';
    speedLabel.textContent = `${speed}x`;

    const speedValue = document.createElement('span');
    speedValue.className = 'speed-value';
    speedValue.textContent = formatTotal(totalSeconds / speed);

    row.append(speedLabel, speedValue);
    speedListElement.append(row);
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function calculatePlaylistTime() {
  resultElement.textContent = '--';
  detailsElement.textContent = '';
  speedListElement.innerHTML = '';

  const activeTab = await getActiveTab();
  if (!activeTab?.id) {
    setStatus('No active tab found.', true);
    return;
  }

  if (!activeTab.url?.includes('youtube.com')) {
    setStatus('Open a YouTube playlist tab first.', true);
    return;
  }

  setStatus('Reading playlist durations from the page...');

  try {
    const response = await chrome.tabs.sendMessage(activeTab.id, { type: 'CALCULATE_PLAYLIST_TIME' });

    if (!response?.ok) {
      setStatus(response?.error || 'Unable to calculate the playlist time.', true);
      return;
    }

    resultElement.textContent = formatTotal(response.totalSeconds);
    detailsElement.textContent = `${response.videoCount} videos counted`;
    renderSpeedBreakdown(response.totalSeconds);
    setStatus('Playlist total updated.');
  } catch (error) {
    setStatus('Reload the YouTube tab and try again.', true);
  }
}

refreshButton.addEventListener('click', () => {
  void calculatePlaylistTime();
});

void calculatePlaylistTime();