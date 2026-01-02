document.addEventListener('DOMContentLoaded', async () => {
  const liveListContainer = document.getElementById('liveList');
  const data = await chrome.storage.local.get(['liveChannelsInfo']);
  const liveChannels = data.liveChannelsInfo || [];

  if (liveChannels.length > 0) {
    liveChannels.forEach(channel => {
      const item = document.createElement('div');
      item.className = 'live-item';
      
      // サムネイル画像がある場合は表示
      if (channel.thumb) {
        const img = document.createElement('img');
        img.src = channel.thumb;
        img.className = 'thumb-img';
        item.appendChild(img);
      }

      const nameLabel = document.createElement('div');
      nameLabel.className = 'channel-name';
      nameLabel.textContent = channel.name;
      item.appendChild(nameLabel);

      item.onclick = () => {
        chrome.tabs.create({ url: channel.url });
      };
      
      liveListContainer.appendChild(item);
    });
  } else {
    const msg = document.createElement('div');
    msg.className = 'no-live';
    msg.textContent = '現在ライブ中の配信はありません';
    liveListContainer.appendChild(msg);
  }

  document.getElementById('openOptions').onclick = () => {
    chrome.runtime.openOptionsPage();
  };
});