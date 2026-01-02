chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "play-sound") {
    // 1. データが空、または不正な形式（undefinedなど）なら何もしない
    if (!msg.data) {
      console.log("再生する音声データがないためスキップしました。");
      return;
    }

    try {
      const audio = new Audio(msg.data);
      audio.play().catch(e => {
        console.error("音声の再生に失敗しました（形式不正など）:", e);
      });
    } catch (e) {
      console.error("Audioオブジェクトの作成に失敗しました:", e);
    }
  }
});