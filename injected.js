// Override method to notify us about local storage changes.
window.localStorage.__proto__ = Object.create(Storage.prototype);
window.localStorage.__proto__.setItem = function(key, value) {
  if (key === 'MediaEngineStore') {
    try {
      const store = JSON.parse(value).default;
      const shortcut = store.mode == 'PUSH_TO_TALK' ? store.modeOptions.shortcut : undefined;
      document.dispatchEvent(new CustomEvent('SwpttShortcutChanged', {
        'detail': shortcut
      }));
    } catch (err) {
      console.error('Error in local storage update: ' + err);
    }
  }

  Storage.prototype.setItem.apply(this, arguments);
}
