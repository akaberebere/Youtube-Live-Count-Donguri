let targetChannels = [];
let customSound = null;

function renderList() {
  const listEl = document.getElementById("channel-list");
  listEl.innerHTML = targetChannels.length === 0 ? '<div style="padding:15px; color:#999;">リストが空です</div>' : "";
  targetChannels.forEach((channel, index) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `<span>${channel}</span><button class="del-btn" data-index="${index}">削除</button>`;
    listEl.appendChild(div);
  });
}

document.getElementById("add-btn").addEventListener("click", () => {
  const input = document.getElementById("new-channel");
  const val = input.value.trim();
  if (val && !targetChannels.includes(val)) { targetChannels.push(val); input.value = ""; renderList(); }
});

document.getElementById("channel-list").addEventListener("click", (e) => {
  if (e.target.classList.contains("del-btn")) {
    targetChannels.splice(e.target.getAttribute("data-index"), 1);
    renderList();
  }
});

document.getElementById("sound-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => { customSound = ev.target.result; };
  reader.readAsDataURL(file);
});

document.getElementById("save").addEventListener("click", () => {
  const data = { 
    targetChannels, 
    enableNotify: document.getElementById("enable-notify").checked,
    notifySeconds: parseInt(document.getElementById("notify-seconds").value) || 5
  };
  if (customSound) data.customSound = customSound;
  chrome.storage.local.set(data, () => {
    document.getElementById("status").textContent = "保存しました！";
    setTimeout(() => { document.getElementById("status").textContent = ""; }, 2000);
    chrome.runtime.sendMessage({ action: "forceRefresh" });
  });
});

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["targetChannels", "customSound", "enableNotify", "notifySeconds"], (res) => {
    if (res.targetChannels) { targetChannels = res.targetChannels; renderList(); }
    if (res.customSound) customSound = res.customSound;
    document.getElementById("enable-notify").checked = res.enableNotify !== false;
    document.getElementById("notify-seconds").value = res.notifySeconds || 5;
  });
});

document.getElementById("test-sound").addEventListener("click", () => {
  if (customSound) {
    chrome.runtime.sendMessage({ type: "play-sound", data: customSound });
  } else {
    alert("音声ファイルを選択してください。");
  }
});