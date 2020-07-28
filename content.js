// Inject script to run in page's JS environment.
const injected = document.createElement("script");
injected.src = chrome.runtime.getURL('injected.js');
injected.onload = function() {
  this.remove();
};
(document.head || document.documentElement).appendChild(injected);

// Listen for PTT shortcut changes.
document.addEventListener('SwpttShortcutChanged', function (ev) {
  console.debug('PTT Shortcut Changed: ' + ev.detail);
});
