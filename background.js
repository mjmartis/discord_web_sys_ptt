let MIN_PTT_LENGTH_DEFAULT = 800;

// TODO remove and make extension non-persistent.
let tabs = new Set();

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
	tabs.add(sender.tab.id);

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

	for (const id of tabs) {
		// Send message to all Discord tabs.
		chrome.tabs.sendMessage(id, {
			id: 'min_ptt_length_changed',
			value: minPttLength
		});
	}

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
chrome.tabs.onRemoved.addListener(function(id, _) {
	tabs.delete(id);
});

// When extension shortcut is pressed, notify Discord tabs.
chrome.commands.onCommand.addListener(function(_) {
	for (const id of tabs) {
		chrome.tabs.sendMessage(id, {
			id: 'ext_shortcut_pushed'
		});
	}
});
