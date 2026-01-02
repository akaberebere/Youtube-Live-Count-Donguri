const handleList = document.getElementById("handleList");
const keywordList = document.getElementById("keywordList");
const refreshBtn = document.getElementById("refreshBtn");
const settingsBtn = document.getElementById("settingsBtn");

function render() {
  chrome.storage.local.get(["liveChannelsInfo"], (res) => {
    const list = res.liveChannelsInfo || [];
    handleList.innerHTML = "";
    keywordList.innerHTML = "";

    const handles = list.filter(item => item.searchKey.startsWith("@"));
    const keywords = list.filter(item => !item.searchKey.startsWith("@"));

    if (handles.length === 0) {
      handleList.innerHTML = '<div class="empty">ライブ中のチャンネルはありません</div>';
    } else {
      handles.forEach(item => handleList.appendChild(createItem(item)));
    }

    if (keywords.length === 0) {
      keywordList.innerHTML = '<div class="empty">該当するライブはありません</div>';
    } else {
      keywords.forEach(item => keywordList.appendChild(createItem(item)));
    }
  });
}

function createItem(item) {
  const a = document.createElement("a");
  a.className = "item";
  a.href = item.url;
  a.target = "_blank";
  a.innerHTML = `
    <img class="thumb" src="${item.thumb}">
    <div class="info">
      <div class="name">${item.name}</div>
      <div class="title">${item.title}</div>
    </div>
  `;
  return a;
}

refreshBtn.addEventListener("click", () => {
  refreshBtn.textContent = "更新中...";
  refreshBtn.disabled = true;

  chrome.runtime.sendMessage({ action: "forceRefresh" }, (res) => {
    setTimeout(() => {
      render();
      refreshBtn.textContent = "更新";
      refreshBtn.disabled = false;
    }, 1000);
  });
});

settingsBtn.addEventListener("click", () => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options.html'));
  }
});

render();