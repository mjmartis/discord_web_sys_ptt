let DEFAULT_WINDOW_VALUE = 800;

// TODO remove and make extension non-persistent.
let tabs = new Set();

// Propogates the stored window value, or the default (if no value has been stored).
function sendWindowValue(cb) {
	chrome.storage.local.get(['windowValue'], function(result) {
		cb('windowValue' in result ? result.windowValue : DEFAULT_WINDOW_VALUE);
	});
}

// Called when a Discord tab is loaded.
function onDiscordLoaded(sender, cb) {
	if (!sender.tab || !sender.tab.id) {
		cb();
		return false;
	}
	tabs.add(sender.tab.id);

	sendWindowValue(cb);
	return true;
}

// Called when a popup is loaded.
function onPopupLoaded(cb) {
	sendWindowValue(cb);
	return true;
}

// Called when the window value is changed.
function onWindowChanged(windowValue, cb) {
	chrome.storage.local.set({
		windowValue: windowValue
	});
	chrome.runtime.sendMessage({
		id: 'window_changed',
		value: windowValue
	});

	cb();
	return false;
}

// TODO: sort out callback usage.
chrome.runtime.onMessage.addListener(function(msg, sender, cb) {
	if (msg.id === 'discord_loaded') {
		return onDiscordLoaded(sender, cb);
	} else if (msg.id === 'popup_loaded') {
		return onPopupLoaded(cb);
	} else if (msg.id === 'window_changed') {
		console.log('background got window changed');
		return onWindowChanged(msg.value, cb);
	}
	
	cb();
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
		}, () => {});
	}
});
