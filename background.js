let tabs = new Set();

// Track which tabs have Discord loaded.
// TODO: sort out callback usage.
chrome.runtime.onMessage.addListener(function(message, sender, cb) {
  cb();

  if (!sender.tab || !sender.tab.id) {
    return false;
  }

  tabs.add(sender.tab.id);
  return false;
});

// Automatically remove tab mapping on closed tabs.
chrome.tabs.onRemoved.addListener(function(id, _) {
  tabs.delete(id);
});

chrome.commands.onCommand.addListener(function(command) {
  for (const id of tabs) {
    chrome.tabs.sendMessage(id, '', () => {});
  }
});
