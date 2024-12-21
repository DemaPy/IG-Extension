const state = {
  headers: null,
  data: 1,
};
chrome.webRequest.onBeforeSendHeaders.addListener(
  ({ requestHeaders }) => {
    state.headers = requestHeaders;
  },
  {
    urls: ["https://www.instagram.com/api/v1/music/playlist/bookmarked/*"],
  },
  ["requestHeaders"]
);

function isTabValid(tab) {
  if (tab.url && tab.url.startsWith("https://www.instagram.com/")) {
    return true
  }
  return false
}

async function getCurrentTab() {
  let queryOptions = { active: true, lastFocusedWindow: true };
  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "headers") {
    sendResponse({ headers: state.headers });
  }
});