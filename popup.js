const handleList = document.getElementById("handleList");
const keywordList = document.getElementById("keywordList");
const refreshBtn = document.getElementById("refreshBtn");
const settingsBtn = document.getElementById("settingsBtn");

function render() {
  chrome.storage.local.get(["liveChannelsInfo", "dismissedVideoIds"], (res) => {
    const list = res.liveChannelsInfo || [];
    const dismissedIds = res.dismissedVideoIds || [];
    
    const displayList = list.filter(item => !dismissedIds.includes(item.videoId));

    handleList.innerHTML = "";
    keywordList.innerHTML = "";

    const handles = displayList.filter(item => item.searchKey.startsWith("@"));
    const keywords = displayList.filter(item => !item.searchKey.startsWith("@"));

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
  const container = document.createElement("div");
  container.style.cssText = "position:relative; margin-bottom:10px;";

  const a = document.createElement("a");
  a.className = "item";
  a.href = item.url;
  a.target = "_blank";
  a.style.cssText = "display:flex; text-decoration:none; color:#000; background:#fff; padding:8px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.1); transition: background 0.2s;";
  
  a.innerHTML = `
    <img src="${item.thumb}" style="width:140px; height:79px; object-fit:cover; border-radius:4px; margin-right:12px;">
    <div style="flex:1; overflow:hidden;">
      <div style="font-size:12px; color:#c00; font-weight:bold; margin-bottom:4px;">${item.name}</div>
      <div style="font-size:14px; font-weight:bold; line-height:1.3; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${item.title}</div>
    </div>
  `;

  const btn = document.createElement("button");
  btn.innerHTML = "×";
  btn.title = "一旦消す";
  btn.style.cssText = "position:absolute; top:5px; right:5px; border:none; background:rgba(0,0,0,0.05); border-radius:50%; width:24px; height:24px; cursor:pointer; font-weight:bold; color:#888; z-index:10; display:flex; align-items:center; justify-content:center;";
  
  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dismissLive(item.videoId);
  };

  container.appendChild(a);
  container.appendChild(btn);
  return container;
}

function dismissLive(videoId) {
  chrome.storage.local.get(["dismissedVideoIds"], (res) => {
    let dismissedIds = res.dismissedVideoIds || [];
    if (!dismissedIds.includes(videoId)) {
      dismissedIds.push(videoId);
      chrome.storage.local.set({ dismissedVideoIds: dismissedIds }, () => {
        render();
        chrome.runtime.sendMessage({ action: "updateBadgeOnly" });
      });
    }
  });
}

refreshBtn.addEventListener("click", () => {
  refreshBtn.textContent = "更新中...";
  refreshBtn.disabled = true;
  chrome.runtime.sendMessage({ action: "forceRefresh" }, () => {
    setTimeout(() => {
      render();
      refreshBtn.textContent = "更新";
      refreshBtn.disabled = false;
    }, 1500);
  });
});

settingsBtn.addEventListener("click", () => {
  if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
  else window.open(chrome.runtime.getURL('options.html'));
});

render();