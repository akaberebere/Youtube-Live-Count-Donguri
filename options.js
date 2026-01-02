document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('channelName');
  const addBtn = document.getElementById('add');
  const list = document.getElementById('list');
  const soundInput = document.getElementById('soundFile');
  const saveSoundBtn = document.getElementById('saveSound');
  const testSoundBtn = document.getElementById('testSound');

  // 通信リフレッシュ要求（エラー回避策）
  function safeRefresh() {
    chrome.runtime.sendMessage({ action: "refresh" }, () => {
      if (chrome.runtime.lastError) {
        setTimeout(safeRefresh, 1000); // 失敗したら1秒後に再試行
      }
    });
  }

  chrome.storage.local.get(['targetChannels'], (res) => {
    (res.targetChannels || []).forEach(renderChannel);
  });

  addBtn.onclick = () => {
    const name = input.value.trim();
    if (!name) return;
    chrome.storage.local.get(['targetChannels'], (res) => {
      const channels = res.targetChannels || [];
      if (!channels.includes(name)) {
        channels.push(name);
        chrome.storage.local.set({ targetChannels: channels }, () => {
          renderChannel(name);
          input.value = '';
          safeRefresh();
        });
      }
    });
  };

  function renderChannel(name) {
    const li = document.createElement('li');
    li.textContent = name;
    const btn = document.createElement('button');
    btn.textContent = '削除';
    btn.className = 'remove-btn';
    btn.onclick = () => {
      chrome.storage.local.get(['targetChannels'], (res) => {
        const channels = (res.targetChannels || []).filter(c => c !== name);
        chrome.storage.local.set({ targetChannels: channels }, () => {
          li.remove();
          safeRefresh();
        });
      });
    };
    li.appendChild(btn);
    list.appendChild(li);
  }

  saveSoundBtn.onclick = () => {
    const file = soundInput.files[0];
    if (!file) return alert("ファイルを選択してください");
    const reader = new FileReader();
    reader.onload = (e) => {
      chrome.storage.local.set({ customSound: e.target.result }, () => {
        alert("通知音を保存しました！");
      });
    };
    reader.readAsDataURL(file);
  };

  testSoundBtn.onclick = () => {
    chrome.storage.local.get(['customSound'], (res) => {
      if (res && res.customSound) {
        new Audio(res.customSound).play().catch(() => {});
      } else {
        alert("通知音が設定されていません。");
      }
    });
  };
});