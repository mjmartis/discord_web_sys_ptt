/**
 * The default minimum number of ms that any 'PTT active' window can last.
 * @const {number}
 */
const MIN_PTT_LENGTH_DEFAULT = 800;

/**
 * Runs the given callback (which accepts an array of tab IDs) with the tab IDs
 * for loaded Discord tabs.
 *
 * @param {function(!Array<number>)} cb - A callback that will be run on the
 *     list of loaded Discord tab IDs.
 */
function withDiscordTabs(cb) {
  chrome.storage.local.get('tabs', function(result) {
    cb('tabs' in result ? result.tabs : []);
  });
}

/**
 * Propogates the stored min PTT length, or the default (if no value has been stored).
 *
 * @param {function(number)} cb - A callback that will be run with the stored
 *     min PTT length as its argument.
 * @return {boolean} true if cb will be called asynchronously.
 */
function sendMinPttLength(cb) {
  chrome.storage.local.get('minPttLength', function(result) {
    cb('minPttLength' in result ? result.minPttLength : MIN_PTT_LENGTH_DEFAULT);
  });
  return true;
}

/**
 * Keeps track of the given Discord tab and sends it the information required
 * to start accepting forwarded PTT shortcuts.
 *
 * @param {number} id - The ID of the tab which has loaded the Discord web client.
 * @param {function(number)} cb - A callback which is passed the current minimum
 *     PTT length.
 * @return {boolean} true if cb will be called asynchronously.
 */
function onDiscordLoaded(id, cb) {
  // Add tab to saved set of Discord tabs.
  withDiscordTabs(function(tabs) {
    const index = tabs.indexOf(id);
    if (index !== -1) return;

    chrome.storage.local.set({
      tabs: [...tabs, id],
    });
  });

  return sendMinPttLength(cb);
}

/**
 * Stores the new min PTT length and updates all popups and Discord tabs about
 * the change.
 *
 * @param {number} minPttLength - The new minimum PTT length.
 */
function onMinPttLengthChanged(minPttLength) {
  chrome.storage.local.set({
    minPttLength: minPttLength,
  });

  // Send message to all popups.
  chrome.runtime.sendMessage({
    id: 'min_ptt_length_changed',
    value: minPttLength,
  });

  // Send message to all Discord tabs.
  withDiscordTabs(function(tabs) {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab, {
        id: 'min_ptt_length_changed',
        value: minPttLength,
      });
    }
  });
}

/**
 * Updates extension badge when a Discord tab starts / stops broadcasting.
 *
 * @param {number} id - The ID of the tab that has started or stopped broadcasting.
 * @param {boolean} broadcasting - true if this is as notice that broadcasting
 *     has started.
 */
function onBroadcastingNotice(id, broadcasting) {
  chrome.storage.local.get('broadcastingTab', function(result) {
    if (broadcasting) {
      chrome.browserAction.setBadgeText({
        text: 'ON',
      });

      chrome.storage.local.set({
        broadcastingTab: id,
      });
    } else if (result.broadcastingTab === id) {
      chrome.browserAction.setBadgeText({
        text: '',
      });

      chrome.storage.local.set({
        broadcastingTab: null,
      });
    }
  });
}

// Handle messages from Discord tabs and popups.
chrome.runtime.onMessage.addListener(function(msg, sender, cb) {
  if (sender == null || sender.tab == null || sender.tab.id == null) {
    return false;
  }

  if (msg.id === 'discord_loaded') {
    return onDiscordLoaded(sender.tab.id, cb);
  } else if (msg.id === 'popup_loaded') {
    return sendMinPttLength(cb);
  } else if (msg.id === 'min_ptt_length_changed') {
    onMinPttLengthChanged(msg.value);
    return false;
  } else if (msg.id === 'broadcasting') {
    onBroadcastingNotice(sender.tab.id, msg.value);
    return false;
  }

  return false;
});

// Automatically remove tab mapping on closed tabs.
chrome.tabs.onRemoved.addListener(function(id) {
  withDiscordTabs(function(tabs) {
    const index = tabs.indexOf(id);
    if (index === -1) return;
    tabs.splice(index, 1);

    chrome.storage.local.set({
      tabs: tabs,
    });

    onBroadcastingNotice(id, false);
  });
});

// When extension shortcut is pressed, notify Discord tabs.
chrome.commands.onCommand.addListener(function() {
  withDiscordTabs(function(tabs) {
    for (tab of tabs) {
      chrome.tabs.sendMessage(tab, {
        id: 'ext_shortcut_pushed',
      });
    }
  });
});
