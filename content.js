// The number of ms to wait from last shortcut message before ending PTT.
const PTT_DELAY_LAST = 100;

// A manually-constructed map from modifiers to their (likely) key codes. From
// https://github.com/wesbos/keycodes/blob/gh-pages/scripts.js. 
const MOD_KEY_CODES = [
	["shiftKey", 16],
	["ctrlKey", 17],
	["altKey", 18],
	["metaKey", 91],
];

// The minimum number of ms to wait from initial shortcut message before ending PTT.
let pttDelayFirst = 800;

let pttEndTime = null;
let keyInits = null;
let toId = null;

// Inject script to run in page's JS environment.
const injected = document.createElement("script");
injected.src = chrome.runtime.getURL('injected.js');
injected.onload = function() {
	this.remove();
};
(document.head || document.documentElement).appendChild(injected);

// Listen for updates to page's PTT shortcut.
document.addEventListener('BwpttShortcutChanged', function(ev) {
	console.debug('PTT Shortcut Changed: ' + ev.detail);

	if (ev.detail === []) {
		keyEventInits = null;
		return;
	}

	keyCodeList = ev.detail;
	keyEventInits = {};
	lastModKeyCode = -1;
	for ([mod, modKeyCode] of MOD_KEY_CODES) {
		const index = keyCodeList.indexOf(modKeyCode);
		if (index === -1) {
			continue;
		}

		keyCodeList.splice(index, 1);
		keyEventInits[mod] = true;
		lastModKeyCode = modKeyCode;
	}

	if (keyCodeList.length > 1) {
		console.debug('Unknown mod key present: key code ' + keyCodeList);
		return;
	}

	keyEventInits['keyCode'] = keyCodeList.length > 0 ? keyCodeList[0] : lastModKeyCode;
});

// Send a PTT keyup event. 
function pttOff() {
	pttEndTime = null;

	if (keyEventInits !== null) {
		document.dispatchEvent(new KeyboardEvent('keyup', keyEventInits));
	}
}

// Extend the PTT off timeout, and send a PTT keydown event if one hasn't been
// sent yet.
// TODO sort out callback
function onExtShortcut(cb) {
	console.log('on ext shortcut ' + pttDelayFirst);
	cb();

	if (keyEventInits === null) {
		return false;
	}

	if (toId !== null) {
		clearTimeout(toId);
	}
	const pttDelay = pttEndTime === null ?
		pttDelayFirst :
		Math.max(PTT_DELAY_LAST, pttEndTime - new Date().getTime());
	toId = setTimeout(pttOff, pttDelay);

	if (pttEndTime === null) {
		pttEndTime = new Date().getTime() + pttDelayFirst;
		document.dispatchEvent(new KeyboardEvent('keydown', keyEventInits));
	}

	return false;
}

chrome.runtime.onMessage.addListener(function(msg, _, cb) {
	if (msg.id === 'ext_shortcut') {
		return onExtShortcut(cb);
	} else if (msg.id === 'window_changed') {
		pttDelayFirst = msg.windowValue;
		cb();
		return false;
	}

	cb();
	return false;
});

// Notify background script that we're a Discord tab.
chrome.runtime.sendMessage({
	id: 'discord_loaded'
}, function(windowValue) {
	pttDelayFirst = windowValue;
});
