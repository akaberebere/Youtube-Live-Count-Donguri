chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("checkLive", { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkLive") checkLiveChannels();
});

async function checkLiveChannels() {
  try {
    const resData = await chrome.storage.local.get(["targetChannels", "notifiedVideoIds", "dismissedVideoIds", "customSound", "enableNotify", "notifySeconds"]);
    const targets = resData.targetChannels || [];
    let notifiedVideoIds = resData.notifiedVideoIds || [];
    let dismissedVideoIds = resData.dismissedVideoIds || [];
    const liveChannelsInfo = [];

    for (const keyword of targets) {
      try {
        const isHandle = keyword.startsWith("@");
        const url = isHandle ? `https://www.youtube.com/${keyword}/live` : `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}&sp=CAMSAkAB`;
        const response = await fetch(url);
        const html = await response.text();

        let videoId = null;
        let title = "タイトル不明";
        let name = keyword;

        if (isHandle) {
          // 1. カノニカルURLを確認（ライブ中なら watch?v=〇〇 の個別ページになっているはず）
          const canonicalMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([^"]+)">/);
          if (!canonicalMatch) continue; // ライブしていない（チャンネルページ等になっている）
          
          // 2. アーカイブ（過去配信）には「終了時間（endDate）」が記録されるので弾く
          if (html.includes('itemprop="endDate"')) continue;
          
          // 3. 待機所（開始前）を弾く
          if (html.includes('"isUpcoming":true')) continue;

          videoId = canonicalMatch[1];
          // メタタグから正確なタイトルを取得
          title = decode(extractFirst(html, /<meta name="title" content="([^"]+)">/)) || "タイトル不明";
          
        } else {
          // キーワード検索の場合
          videoId = extractFirst(html, /"videoId":"([^"]+)"/);
          if (!videoId) continue;
          
          const hasLiveFlag = html.includes('"isLive":true') || html.includes('LIVE_NOW');
          if (!hasLiveFlag || html.includes('"isUpcoming":true')) continue;

          title = decode(extractFirst(html, /"title":\{"runs":\[\{"text":"([^"]+)"/)) || "タイトル不明";
          name = decode(extractFirst(html, /"ownerText":\{"runs":\[\{"text":"([^"]+)"/)) || "不明";
        }

        const info = {
          videoId: videoId,
          name: name,
          title: title,
          thumb: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          searchKey: keyword
        };
        liveChannelsInfo.push(info);

        if (!notifiedVideoIds.includes(videoId)) {
          notifiedVideoIds.push(videoId);
          await chrome.storage.local.set({ notifiedVideoIds });
          showNotification(info, resData);
        }
      } catch (e) { console.error(e); }
    }

    // リストの掃除
    const currentIds = liveChannelsInfo.map(i => i.videoId);
    dismissedVideoIds = dismissedVideoIds.filter(id => currentIds.includes(id));

    await chrome.storage.local.set({ liveChannelsInfo, dismissedVideoIds });
    updateBadge(liveChannelsInfo, dismissedVideoIds);
  } catch (e) { console.error(e); }
}

function updateBadge(liveList, dismissedIds) {
  const count = liveList.filter(item => 
    item.searchKey.startsWith("@") && !dismissedIds.includes(item.videoId)
  ).length;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
}

function showNotification(info, settings) {
  if (settings.enableNotify !== false) {
    chrome.notifications.create(info.videoId, {
      type: "basic", iconUrl: "icon.png", title: `ライブ開始: ${info.name}`, message: info.title, priority: 2
    });
    setTimeout(() => { chrome.notifications.clear(info.videoId); }, (settings.notifySeconds || 5) * 1000);
  }
  if (settings.customSound) playNotificationSound(settings.customSound);
}

async function playNotificationSound(customSound) {
  try {
    const ctx = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
    if (ctx.length === 0) await chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["AUDIO_PLAYBACK"], justification: "notification" });
    chrome.runtime.sendMessage({ type: "play-sound", data: customSound });
  } catch (e) {}
}

function extractFirst(text, regex) { const m = text.match(regex); return m ? m[1] : null; }
function decode(str) { 
  if (!str) return "";
  return str.replace(/\\u0026/g, "&").replace(/\\/g, "").replace(/&#39;/g, "'").replace(/&quot;/g, '"').split('","')[0].split('"}')[0]; 
}

chrome.runtime.onMessage.addListener((req, s, send) => {
  if (req.action === "forceRefresh") { checkLiveChannels().then(() => send({ success: true })); return true; }
  if (req.action === "updateBadgeOnly") {
    chrome.storage.local.get(["liveChannelsInfo", "dismissedVideoIds"], (res) => {
      updateBadge(res.liveChannelsInfo || [], res.dismissedVideoIds || []);
    });
  }
});