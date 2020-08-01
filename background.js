let DEFAULT_WINDOW_VALUE = 800;

// TODO remove and make extension non-persistent.
let tabs = new Set();

// Propogates the stored window value, or the default (if no value has been stored).
function sendWindowValue(cb) {
	chrome.storage.local.get('windowValue', function(result) {
		cb('windowValue' in result ? parseInt(result.windowValue) : DEFAULT_WINDOW_VALUE);
	});
  return true;
}

// Called when a Discord tab is loaded.
function onDiscordLoaded(sender, cb) {
	if (!sender.tab || !sender.tab.id) {
		cb();
		return false;
	}
	tabs.add(sender.tab.id);

	return sendWindowValue(cb);
}

// Called when the window value is changed.
function onWindowChanged(windowValue) {
	chrome.storage.local.set({
		windowValue: windowValue
	});

	// Send message to all popups.
	chrome.runtime.sendMessage({
		id: 'window_changed',
		value: windowValue
	});

	for (const id of tabs) {
		// Send message to all Discord tabs.
		chrome.tabs.sendMessage(id, {
			id: 'window_changed',
			value: windowValue
		});
	}

	return false;
}

// Handle messages from Discord tabs and popups.
chrome.runtime.onMessage.addListener(function(msg, sender, cb) {
	if (msg.id === 'discord_loaded') {
		return onDiscordLoaded(sender, cb);
	} else if (msg.id === 'popup_loaded') {
	  return sendWindowValue(cb);
	} else if (msg.id === 'window_changed') {
		return onWindowChanged(msg.value);
	}

	return false;
});

// Automatically remove tab mapping on closed tabs.
chrome.tabs.onRemoved.addListener(function(id, _) {
	tabs.delete(id);
});

// When extension shortcut is pressed, notify Discord tabs.
chrome.commands.onCommand.addListener(function(_) {
	for (const id of tabs) {
		chrome.tabs.sendMessage(id, {
			id: 'ext_shortcut'
		});
	}
});
