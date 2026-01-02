chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("checkLive", { periodInMinutes: 1 });
});

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
    let newNotifiedIds = [...notifiedVideoIds];

    for (const idOrName of targets) {
      try {
        const searchQuery = idOrName.startsWith('@') ? idOrName : `"${idOrName}"`;
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}&sp=EgJAAQ%253D%253D`;

        const response = await fetch(url);
        const text = await response.text();

        // ページ全体に「ライブ」に関する何らかの記述があるか
        if (!(text.includes('LIVE') || text.includes('ライブ') || text.includes('isLive'))) continue;

        const videoMatches = [...text.matchAll(/"videoId":"([^"]+)"/g)];
        
        for (const match of videoMatches) {
          const videoId = match[1];
          if (currentLiveVideoIds.includes(videoId)) continue;

          const pos = text.indexOf(videoId);
          const nearText = text.substring(Math.max(0, pos - 2000), pos + 5000); 

          // 1. アーカイブ除外：再生時間（長さ）のラベルがあるものは即座にパス
          const durationPattern = /"lengthText":\{"accessibility":\{"accessibilityData":\{"label":"(\d+分\d+秒|\d+時間\d+分|\d+秒)"\}/;
          if (durationPattern.test(nearText)) continue;

          // 2. ライブ判定：isLiveフラグ、または「ライブ配信中」のテキスト、または「STYLE_TYPE_LIVE_NOW」のいずれかがあればOK
          const isLive = nearText.includes('"isLive":true') || 
                         nearText.includes('ライブ配信中') || 
                         nearText.includes('STYLE_TYPE_LIVE_NOW') ||
                         nearText.includes('BADGE_STYLE_TYPE_LIVE_NOW');
          
          if (!isLive) continue;
          
          // 3. 配信予定（Upcoming）は除外
          if (nearText.includes('upcomingEventData')) continue;

          // タイトル抽出
          let titleText = "";
          const titleSectionMatch = nearText.match(/"title":\{"runs":\[(.*?BasicColorText.*?|.*?)\]\}/);
          if (titleSectionMatch) {
            const runMatches = [...titleSectionMatch[1].matchAll(/"text":"(.*?)"/g)];
            titleText = runMatches.map(m => m[1]).join('').replace(/\\u([0-9a-fA-F]{4})/g, (m, g) => String.fromCharCode(parseInt(g, 16))).replace(/\\/g, '');
          }

          // 照合ロジック：@を除いた名前でも一致とみなす
          const cleanTarget = idOrName.startsWith('@') ? idOrName.substring(1) : idOrName;
          const isMatch = titleText.includes(cleanTarget) || nearText.includes(cleanTarget);
          
          if (!isMatch) continue;

          const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
          const thumbUrl = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

          liveChannelsInfo.push({ 
            name: idOrName, 
            title: titleText || "ライブ配信中",
            url: watchUrl, 
            thumb: thumbUrl,
            videoId: videoId
          });
          currentLiveVideoIds.push(videoId);

          if (!newNotifiedIds.includes(videoId)) {
            newNotifiedIds.push(videoId);
            chrome.notifications.create(watchUrl, {
              type: "image",
              iconUrl: "icon.png",
              title: idOrName,
              message: titleText,
              imageUrl: thumbUrl,
              priority: 2
            });
            playNotificationSound();
          }
        }
      } catch (e) { console.error(e); }
    }

    const finalNotifiedList = newNotifiedIds.filter(id => currentLiveVideoIds.includes(id) || notifiedVideoIds.includes(id));
    await chrome.storage.local.set({ liveChannelsInfo, notifiedVideoIds: finalNotifiedList });
    chrome.action.setBadgeText({ text: liveChannelsInfo.length > 0 ? liveChannelsInfo.length.toString() : "" });
  } catch (e) { console.error(e); }
}

async function playNotificationSound() {
  try {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (contexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html', reasons: ['AUDIO_PLAYBACK'], justification: 'notification'
      });
    }
    chrome.runtime.sendMessage({ type: 'play-sound', target: 'offscreen' }).catch(() => {});
  } catch (e) {}
}

chrome.notifications.onClicked.addListener((id) => {
  if (id.startsWith('http')) { chrome.tabs.create({ url: id }); chrome.notifications.clear(id); }
});

chrome.alarms.onAlarm.addListener(a => { if(a.name === "checkLive") checkLiveChannels(); });
chrome.runtime.onMessage.addListener((m, sender, sendResponse) => {
  if (m.action === "refresh") { checkLiveChannels().then(() => sendResponse({status: "done"})); return true; }
});