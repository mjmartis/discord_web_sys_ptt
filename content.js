// Inject script to run in page's JS environment.
const injected = document.createElement("script");
injected.src = chrome.runtime.getURL('injected.js');
injected.onload = function() {
  this.remove();
};
(document.head || document.documentElement).appendChild(injected);

// Forward PTT shortcut updates from the page's environment to the background
// script.
document.addEventListener('SwpttShortcutChanged', function(ev) {
  console.debug('PTT Shortcut Changed: ' + ev.detail);
  chrome.runtime.sendMessage({
    shortcut: ev.detail
  }, function(_) {});
});

// Forward key events from other contexts.
chrome.runtime.onMessage.addListener(function(eventArgs, _, cb) {
  const keyEvent = new KeyboardEvent(...eventArgs);
  document.dispatchEvent(keyEvent);
  console.log(eventArgs);
  cb();
});
