function parseDurationLabel(label) {
  const parts = label
    .trim()
    .split(':')
    .map((value) => Number.parseInt(value, 10));

  if (parts.some(Number.isNaN)) {
    return null;
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return null;
}

function findScrollableContainer() {
  const candidates = [
    document.querySelector('ytd-playlist-video-list-renderer'),
    document.querySelector('ytd-playlist-panel-renderer'),
    document.querySelector('ytd-browse[page-subtype="playlist"]'),
    document.scrollingElement,
  ];

  return candidates.find(Boolean) || document.scrollingElement;
}

function collectDurationTexts() {
  const itemSelectors = [
    'ytd-playlist-video-renderer',
    'ytd-playlist-panel-video-renderer',
  ];

  const durationTexts = [];

  for (const itemSelector of itemSelectors) {
    for (const item of document.querySelectorAll(itemSelector)) {
      const node = item.querySelector(
        '.yt-badge-shape__text, ytd-thumbnail-overlay-time-status-renderer #text'
      );
      const text = node?.textContent?.replace(/\s+/g, ' ').trim();
      if (text && /^\d{1,2}:\d{2}(?::\d{2})?$/.test(text)) {
        durationTexts.push(text);
      }
    }
  }

  return durationTexts;
}

async function scrollToLoadPlaylistItems() {
  const scrollTarget = findScrollableContainer();
  if (!scrollTarget) {
    return;
  }

  let stablePasses = 0;
  let lastCount = 0;

  for (let attempt = 0; attempt < 18; attempt += 1) {
    const currentCount = collectDurationTexts().length;
    if (currentCount === lastCount) {
      stablePasses += 1;
    } else {
      stablePasses = 0;
      lastCount = currentCount;
    }

    if (stablePasses >= 3) {
      break;
    }

    scrollTarget.scrollTop = scrollTarget.scrollHeight;
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
    await new Promise((resolve) => window.setTimeout(resolve, 450));
  }
}

async function calculatePlaylistTimeFromPage() {
  const isPlaylistPage = new URL(window.location.href).searchParams.has('list');
  if (!isPlaylistPage) {
    return { ok: false, error: 'Open a YouTube playlist page first.' };
  }

  await scrollToLoadPlaylistItems();

  const durationTexts = collectDurationTexts();
  const totalSeconds = durationTexts.reduce((sum, label) => {
    const seconds = parseDurationLabel(label);
    return seconds === null ? sum : sum + seconds;
  }, 0);

  if (!durationTexts.length || !totalSeconds) {
    return {
      ok: false,
      error: 'No playlist durations were detected. Scroll the playlist once, then retry.',
    };
  }

  const titleNodes = document.querySelectorAll('ytd-playlist-video-renderer #video-title, ytd-playlist-panel-video-renderer #video-title');

  return {
    ok: true,
    totalSeconds,
    uniqueDurations: new Set(durationTexts).size,
    videoCount: durationTexts.length || titleNodes.length,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'CALCULATE_PLAYLIST_TIME') {
    return undefined;
  }

  void calculatePlaylistTimeFromPage().then(sendResponse);
  return true;
});