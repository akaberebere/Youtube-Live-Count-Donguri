async function checkLiveChannels() {
  try {
    const resData = await chrome.storage.local.get(['targetChannels', 'notifiedVideoIds']);
    const targets = resData.targetChannels || [];
    let notifiedVideoIds = resData.notifiedVideoIds || [];

    if (targets.length === 0) {
      chrome.action.setBadgeText({ text: "" });
      return;
    }

    let liveChannelsInfo = [];
    let currentLiveVideoIds = [];

    for (const idOrName of targets) {
      try {
        const url = idOrName.startsWith('@') 
          ? `https://www.youtube.com/${idOrName}/live` 
          : `https://www.youtube.com/results?search_query=${encodeURIComponent(idOrName)}&sp=EgJAAQ%253D%253D`;

        const response = await fetch(url);
        const text = await response.text();
        const isLive = text.includes('style":"BADGE_STYLE_TYPE_LIVE_NOW"') || text.includes('"isLive":true');

        if (isLive) {
          let videoId = idOrName;
          let thumbUrl = "";
          let watchUrl = url;
          const vMatch = text.match(/"videoId":"([^"]+)"/);
          if (vMatch) {
            videoId = vMatch[1];
            watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
            thumbUrl = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
          }

          liveChannelsInfo.push({ name: idOrName, url: watchUrl, thumb: thumbUrl });
          currentLiveVideoIds.push(videoId);

          if (!notifiedVideoIds.includes(videoId)) {
            chrome.notifications.create(watchUrl, {
              type: "image",
              iconUrl: "icon.png",
              title: "ライブ配信開始！",
              message: `${idOrName} が配信を始めました。`,
              imageUrl: thumbUrl,
              priority: 2
            });
            playNotificationSound(); // 音声再生関数を呼び出す
            notifiedVideoIds.push(videoId);
          }
        }
      } catch (e) { console.error(e); }
    }

    const updatedNotifiedList = notifiedVideoIds.filter(id => currentLiveVideoIds.includes(id));
    await chrome.storage.local.set({ 
      liveChannelsInfo: liveChannelsInfo,
      notifiedVideoIds: updatedNotifiedList 
    });

    chrome.action.setBadgeText({ text: liveChannelsInfo.length > 0 ? liveChannelsInfo.length.toString() : "" });
  } catch (e) { console.error(e); }
}

async function playNotificationSound() {
  try {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (contexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'notification sound'
      });
    }
    chrome.runtime.sendMessage({ type: 'play-sound', target: 'offscreen' });
  } catch (e) {
    // 画面が作成できない場合も静かに終了
  }
}

chrome.notifications.onClicked.addListener(id => chrome.tabs.create({ url: id }));
chrome.alarms.create("checkLive", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(checkLiveChannels);
chrome.runtime.onMessage.addListener(m => { if(m.action === "refresh") checkLiveChannels(); });