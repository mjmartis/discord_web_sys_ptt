// A manually-constructed map from codes to likely key codes. Based on
// https://github.com/wesbos/keycodes/blob/gh-pages/scripts.js. 
const KEY_CODES = new Map([
	["AltLeft", 18],
	["AltRight", 18],
	["ArrowDown", 40],
	["ArrowLeft", 37],
	["ArrowRight", 39],
	["ArrowUp", 38],
	["AudioVolumeDown", 174],
	["AudioVolumeUp", 175],
	["Backquote", 192],
	["Backslash", 220],
	["Backspace", 8],
	["BracketLeft", 219],
	["BracketRight", 221],
	["Break", 19],
	["CapsLock", 20],
	["Comma", 188],
	["ContextMenu", 93],
	["ControlLeft", 17],
	["ControlRight", 17],
	["Digit0", 48],
	["Digit1", 49],
	["Digit2", 50],
	["Digit3", 51],
	["Digit4", 52],
	["Digit5", 53],
	["Digit6", 54],
	["Digit7", 55],
	["Digit8", 56],
	["Digit9", 57],
	["End", 35],
	["Enter", 13],
	["Equal", 187],
	["Escape", 27],
	["F1", 112],
	["F2", 113],
	["F3", 114],
	["F4", 115],
	["F5", 116],
	["F6", 117],
	["F7", 118],
	["F8", 119],
	["F9", 120],
	["F10", 121],
	["F11", 122],
	["F12", 123],
	["Home", 36],
	["Insert", 45],
	["KeyA", 65],
	["KeyB", 66],
	["KeyC", 67],
	["KeyD", 68],
	["KeyE", 69],
	["KeyF", 70],
	["KeyG", 71],
	["KeyH", 72],
	["KeyI", 73],
	["KeyJ", 74],
	["KeyK", 75],
	["KeyL", 76],
	["KeyM", 77],
	["KeyN", 78],
	["KeyO", 79],
	["KeyP", 80],
	["KeyQ", 81],
	["KeyR", 82],
	["KeyS", 83],
	["KeyT", 84],
	["KeyU", 85],
	["KeyV", 86],
	["KeyW", 87],
	["KeyX", 88],
	["KeyY", 89],
	["KeyZ", 90],
	["MediaPlayPause", 179],
	["MediaStop", 178],
	["MediaTrackNext", 176],
	["MediaTrackPrevious", 177],
	["MetaLeft", 91],
	["MetaRight", 91],
	["Minus", 189],
	["NumLock", 144],
	["Numpad0", 96],
	["Numpad1", 97],
	["Numpad2", 98],
	["Numpad3", 99],
	["Numpad4", 100],
	["Numpad5", 101],
	["Numpad6", 102],
	["Numpad7", 103],
	["Numpad8", 104],
	["Numpad9", 105],
	["NumpadAdd", 107],
	["NumpadComma", 188],
	["NumpadDecimal", 110],
	["NumpadDivide", 111],
	["NumpadMultiply", 106],
	["NumpadSubtract", 109],
	["PageDown", 34],
	["PageUp", 33],
	["Pause", 19],
	["Period", 190],
	["PrintScreen", 44],
	["Quote", 222],
	["ScrollLock", 145],
	["Select", 41],
	["Semicolon", 186],
	["ShiftLeft", 16],
	["ShiftRight", 16],
	["Slash", 191],
	["Space", 32],
	["Tab", 9]
]);

let tabs = new Map();
let shortcuts = new Map();

chrome.input.ime.onKeyEvent.addListener(function(_, key) {
	const keyCode = KEY_CODES.get(key.code);
	if (!keyCode) {
		console.debug('Missing key code for ' + key.code);
		return false;
	}

	allKeyCodes = [keyCode]
	for (const [pressed, modKeyCode] of [
			[key.shiftKey, 16],
			[key.ctrlKey, 17],
			[key.altKey, 18],
			[key.capsKey, 20]
		]) {
		if (pressed && modKeyCode != keyCode) {
			allKeyCodes.push(modKeyCode);
		}
	}

	// Keep sorted and unique key values.
	console.log(allKeyCodes.sort());
	return false;
});

// Track which Discord tabs have which PTT shortcuts.
// TODO: clean up (potential) old shortcut data for this tab.
// TODO: sort out callback usage.
chrome.runtime.onMessage.addListener(function(message, sender, cb) {
	if (!sender.tab || !sender.tab.id) {
		cb();
		return false;
	}

	if (!tabs.has(message.shortcut)) {
		tabs.set(message.shortcut, []);
	}
	tabs.get(message.shortcut).push(sender.tab.id);
	shortcuts.set(sender.tab.id, message.shortcut);
	cb();
	return false;
});

// TODO: clean up when relevant tab is closed, with chrome.tabs.onRemoved.
