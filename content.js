// The number of ms to wait without shortcut messages before ending PTT.
const PTT_OFF_DELAY = 800;

// A manually-constructed map from modifiers to their (likely) key codes. From
// https://github.com/wesbos/keycodes/blob/gh-pages/scripts.js. 
const MOD_KEY_CODES = [
	["shiftKey", 16],
	["ctrlKey", 17],
	["altKey", 18],
	["metaKey", 91],
];

let pttDown = false;
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
	pttDown = false;

	if (keyEventInits !== null) {
		document.dispatchEvent(new KeyboardEvent('keyup', keyEventInits));
	}
}

// Extend the PTT off timeout, and send a PTT keydown event if one hasn't been
// sent yet.
// TODO sort out callback
chrome.runtime.onMessage.addListener(function(_, _, cb) {
	cb();

	if (keyEventInits === null) {
		return;
	}

	if (toId !== null) {
		clearTimeout(toId);
	}
	toId = setTimeout(pttOff, PTT_OFF_DELAY);

	if (!pttDown) {
		pttDown = true;
		document.dispatchEvent(new KeyboardEvent('keydown', keyEventInits));
	}
});

// Notify background script that we're a Discord tab.
chrome.runtime.sendMessage({}, ()=>{});
