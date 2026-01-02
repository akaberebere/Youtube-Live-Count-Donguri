document.addEventListener('DOMContentLoaded', async () => {
  const channelSection = document.getElementById('channelSection');
  const keywordSection = document.getElementById('keywordSection');
  const data = await chrome.storage.local.get(['liveChannelsInfo']);
  const liveChannels = data.liveChannelsInfo || [];

  channelSection.innerHTML = '';
  keywordSection.innerHTML = '';

  let hasChannel = false;
  let hasKeyword = false;

  liveChannels.forEach(channel => {
    const item = document.createElement('div');
    item.className = 'live-item';
    
    item.innerHTML = `
      <img src="${channel.thumb}" class="thumb-img">
      <div class="live-title">${channel.title}</div>
      <div class="channel-name">${channel.name}</div>
    `;

    item.onclick = () => {
      chrome.tabs.create({ url: channel.url });
    };

    // @で始まる登録名かどうかで振分け
    if (channel.name.startsWith('@')) {
      channelSection.appendChild(item);
      hasChannel = true;
    } else {
      keywordSection.appendChild(item);
      hasKeyword = true;
    }
  });

  if (!hasChannel) channelSection.innerHTML = '<div class="no-live">配信なし</div>';
  if (!hasKeyword) keywordSection.innerHTML = '<div class="no-live">配信なし</div>';

  document.getElementById('openOptions').onclick = () => {
    chrome.runtime.openOptionsPage();
  };
});