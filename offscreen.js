chrome.runtime.onMessage.addListener(async (m) => {
  if (m.target !== 'offscreen' || m.type !== 'play-sound') return;

  try {
    // Storage APIが利用可能か、かつ undefined でないか静かにチェック
    const storage = typeof chrome !== 'undefined' && chrome.storage ? chrome.storage.local : null;
    
    if (storage) {
      const res = await storage.get(['customSound']);
      // カスタム音声がある場合のみ再生。ない場合は何もせず終了（エラーは出さない）
      if (res && res.customSound) {
        const audio = new Audio(res.customSound);
        await audio.play();
      }
    }
  } catch (e) {
    // 再生エラー自体もコンソールを汚さないよう沈黙させる（デバッグ時のみ有効にする場合は console.error(e)）
  }
});