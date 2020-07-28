// Inject a script to the DOM that gives us early access to
// local storage for the page.
const script = document.createElement("script");

// Override the item setting method to notify us about changes
// to local storage.
script.innerHTML = `
window.localStorage.__proto__ = Object.create(Storage.prototype);
window.localStorage.__proto__.setItem = function(key, value) {
  if (key === 'SelectedChannelStore') {
    const broadcasting = JSON.parse(value).selectedVoiceChannelId !== null;
    document.dispatchEvent(new CustomEvent('SwpttBroadcasting',
      {broadcasting: broadcasting}));
    console.log('!! BROADCASTING ' + broadcasting);
  } else if (key === 'MediaEngineStore') {
    const store = JSON.parse(value).default;
    const shortcut = store.mode == 'PUSH_TO_TALK' ? store.modeOptions.shortcut : null;
    document.dispatchEvent(new CustomEvent('SwpttShortcut',
      {shortcut: shortcut}));
    console.log('!! SHORTCUT ' + shortcut);
  }
  Storage.prototype.setItem.apply(this, arguments);
}
`;

document.documentElement.appendChild(script);
