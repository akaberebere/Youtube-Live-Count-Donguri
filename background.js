chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("checkLive", { periodInMinutes: 1 });
});

async function checkLiveChannels() {
  try {
    const resData = await chrome.storage.local.get(["targetChannels", "notifiedVideoIds", "customSound", "enableNotify", "notifySeconds"]);
    const targets = resData.targetChannels || [];
    let notifiedVideoIds = resData.notifiedVideoIds || [];
    const liveChannelsInfo = [];
    const currentLiveVideoIds = [];

    const handleTargets = targets.filter(t => t.startsWith("@"));
    const keywordTargets = targets.filter(t => !t.startsWith("@"));

    // 1. 登録チャンネル(@)を優先チェック
    for (const keyword of handleTargets) {
      try {
        const url = `https://www.youtube.com/${keyword}/live`;
        const response = await fetch(url);
        const html = await response.text();

        // 判定条件を「いずれかが含まれていればOK」に広げて安定させる
        const hasLiveFlag = html.includes('"isLive":true') || html.includes('LIVE_NOW') || html.includes('"style":"LIVE"');
        const isUpcoming = html.includes('"isUpcoming":true'); // 待機所
        
        // ライブフラグがあり、かつ「待機所」ではない場合のみ採用
        if (!hasLiveFlag || isUpcoming) continue;

        const videoId = extractFirst(html, /"videoId":"([^"]+)"/);
        if (!videoId) continue;

        const name = extractFirst(html, /"ownerChannelName":"([^"]+)"/) || extractFirst(html, /"author":"([^"]+)"/) || keyword;
        const title = extractFirst(html, /"title":\{"runs":\[\{"text":"([^"]+)"\}\]/) || "ライブ配信中";

        pushLive({ searchKey: keyword, videoId, title, name }, liveChannelsInfo, currentLiveVideoIds, notifiedVideoIds, resData);
      } catch (e) { console.error(e); }
    }

    // 2. キーワード検索（ここでは重複を厳格にチェック）
    for (const keyword of keywordTargets) {
      try {
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}&sp=EgJAAQ%253D%253D`;
        const response = await fetch(url);
        const html = await response.text();

        const blocks = html.split('"videoRenderer":{');
        for (let i = 1; i < blocks.length; i++) {
          const block = blocks[i].substring(0, 10000);
          // キーワード検索は誤判定が多いので、ここは厳しめに「LIVE」の文字を探す
          if (!block.includes('"style":"LIVE"') && !block.includes("LIVE_NOW")) continue;

          const videoId = extractFirst(block, /"videoId":"([^"]+)"/);
          if (!videoId || currentLiveVideoIds.includes(videoId)) continue;

          let name = "配信者";
          const byline = block.match(/"longBylineText":\{(.*?)\},"/);
          if (byline) {
            const texts = [...byline[1].matchAll(/"text":"([^"]+)"/g)];
            if (texts.length) name = texts.map(t => t[1]).join("");
          }
          const title = extractFirst(block, /"title":\{"runs":\[\{"text":"([^"]+)"\}\]/) || "配信中";
          
          pushLive({ searchKey: keyword, videoId, title, name }, liveChannelsInfo, currentLiveVideoIds, notifiedVideoIds, resData);
        }
      } catch (e) { console.error(e); }
    }

    await chrome.storage.local.set({ liveChannelsInfo, notifiedVideoIds });
    chrome.action.setBadgeText({ text: liveChannelsInfo.length > 0 ? String(liveChannelsInfo.length) : "" });
  } catch (e) { console.error(e); }
}

function pushLive(base, liveChannelsInfo, currentLiveVideoIds, notifiedVideoIds, settings) {
  const info = {
    searchKey: base.searchKey,
    name: decode(base.name),
    title: decode(base.title),
    videoId: base.videoId,
    url: `https://www.youtube.com/watch?v=${base.videoId}`,
    thumb: `https://i.ytimg.com/vi/${base.videoId}/mqdefault.jpg`
  };
  liveChannelsInfo.push(info);
  currentLiveVideoIds.push(base.videoId);

  if (!notifiedVideoIds.includes(base.videoId)) {
    notifiedVideoIds.push(base.videoId);
    if (settings.enableNotify !== false) {
      chrome.notifications.create(base.videoId, {
        type: "basic", iconUrl: "icon.png", title: `ライブ開始: ${info.name}`, message: info.title, priority: 2
      });
      const ms = (settings.notifySeconds || 5) * 1000;
      setTimeout(() => { chrome.notifications.clear(base.videoId); }, ms);
    }
    if (settings.customSound) playNotificationSound(settings.customSound);
  }
}

async function playNotificationSound(customSound) {
  try {
    const ctx = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
    if (ctx.length === 0) {
      await chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["AUDIO_PLAYBACK"], justification: "notification" });
    }
    chrome.runtime.sendMessage({ type: "play-sound", data: customSound });
  } catch (e) {}
}

function extractFirst(text, regex) { const m = text.match(regex); return m ? m[1] : null; }
function decode(str) { 
  if (!str) return "";
  return str.replace(/\\u0026/g, "&").replace(/\\/g, "").split('","')[0].split('"}')[0]; 
}

chrome.notifications.onClicked.addListener((id) => { chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${id}` }); });
chrome.alarms.onAlarm.addListener(a => { if (a.name === "checkLive") checkLiveChannels(); });
chrome.runtime.onMessage.addListener((req, s, send) => {
  if (req.action === "forceRefresh") { checkLiveChannels().then(() => send({ success: true })); return true; }
});