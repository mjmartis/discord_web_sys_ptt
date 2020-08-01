let MIN_PTT_LENGTH_DEFAULT = 800;

// Runs the given callback (which accepts an array of tab IDs) with the tab IDs
// for loaded Discord tabs.
function withDiscordTabs(cb) {
  chrome.storage.local.get('tabs', function(result) {
    cb('tabs' in result ? result.tabs : []);
  });
}

// Propogates the stored min PTT length, or the default (if no value has been stored).
function sendMinPttLength(cb) {
  chrome.storage.local.get('minPttLength', function(result) {
    cb('minPttLength' in result ? parseInt(result.minPttLength) : MIN_PTT_LENGTH_DEFAULT);
  });
  return true;
}

// Called when a Discord tab is loaded.
function onDiscordLoaded(sender, cb) {
  if (!sender.tab || !sender.tab.id) {
    cb();
    return false;
  }

  // Add tab to saved set of Discord tabs.
  withDiscordTabs(function(tabs) {
    const index = tabs.indexOf(sender.tab.id);
    if (index !== -1) {
      return;
    }

    chrome.storage.local.set({
      tabs: tabs.concat([sender.tab.id])
    });
  });

  return sendMinPttLength(cb);
}

// Called when the min PTT length is changed.
function onMinPttLengthChanged(minPttLength) {
  chrome.storage.local.set({
    minPttLength: minPttLength
  });

  // Send message to all popups.
  chrome.runtime.sendMessage({
    id: 'min_ptt_length_changed',
    value: minPttLength
  });

  // Send message to all Discord tabs.
  withDiscordTabs(function(tabs) {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab, {
        id: 'min_ptt_length_changed',
        value: minPttLength
      });
    }
  });

  return false;
}

// Handle messages from Discord tabs and popups.
chrome.runtime.onMessage.addListener(function(msg, sender, cb) {
  if (msg.id === 'discord_loaded') {
    return onDiscordLoaded(sender, cb);
  } else if (msg.id === 'popup_loaded') {
    return sendMinPttLength(cb);
  } else if (msg.id === 'min_ptt_length_changed') {
    return onMinPttLengthChanged(msg.value);
  }

  return false;
});

// Automatically remove tab mapping on closed tabs.
chrome.tabs.onRemoved.addListener(function(id) {
  withDiscordTabs(function(tabs) {
    const index = tabs.indexOf(id);
    if (index === -1) {
      return;
    }

    tabs.splice(index, 1);
    chrome.storage.local.set({
      tabs: tabs
    });
  });
});

// When extension shortcut is pressed, notify Discord tabs.
chrome.commands.onCommand.addListener(function() {
  withDiscordTabs(function(tabs) {
    for (tab of tabs) {
      chrome.tabs.sendMessage(tab, {
        id: 'ext_shortcut_pushed'
      });
    }
  });
});
