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

let prevKeyCodes = null;
let prevKeyArgs = null;

// Send arguments for a key event to the tabs that are listening for the event.
function forwardKeyEvent(keyArgs, keyCodes) {
  if (!tabs.has(keyCodes)) {
    return;
  }

  for (const tabId of tabs.get(keyCodes)) {
    console.log('sending ' + keyArgs[0] + ' to tab ' + tabId);
    chrome.tabs.sendMessage(tabId, keyArgs, () => {});
  }
}

// Handle key presses from any context.
chrome.input.ime.onKeyEvent.addListener(function(_, key) {
  // Discord expects an exactly corresponding keydown / keyup event pair. That
  // is, if a Ctrl+Shift keydown event is the PTT shortcut, only a Ctrl+Shift
  // keyup event (cf two keyups, one for Ctrl and one for Shift) mutes.
  //
  // We handle this by tracking the last keydown event seen, and generating a
  // manual corresponding keyup if we see any keyup event or any different
  // keydown event.
  //
  // There are scenarios where this fails: e.g. when Ctrl+Alt+Shift is the last
  // keydown seen, but then we see an Alt keyup. However as a user this doesn't
  // appear to feel too unusual.

  // Send exactly corresponding keyup event for the last seen keydown.
  if (key.type === 'keyup') {
    if (prevKeyCodes === null) {
      return false;
    }

    prevKeyArgs[0] = 'keyup';
    forwardKeyEvent(prevKeyArgs, prevKeyCodes);
    console.log('keyup ' + prevKeyCodes);
    prevKeyCodes = null;
    prevKeyArgs = null;
    return false;
  }

  // Get int key code corresponding to the code string.
  const keyCode = KEY_CODES.get(key.code);
  if (!keyCode) {
    console.debug('Missing key code for ' + key.code);
    return false;
  }

  // Add in modifiers and format as expected by Discord.
  keyCodesList = [keyCode]
  for (const [pressed, modKeyCode] of [
      [key.shiftKey, 16],
      [key.ctrlKey, 17],
      [key.altKey, 18],
      [key.capsKey, 20]
    ]) {
    if (pressed && modKeyCode != keyCode) {
      keyCodesList.push(modKeyCode);
    }
  }
  const curKeyCodes = keyCodesList.sort().join(',');

  if (prevKeyCodes !== null) {
    // Event is the same as last keydown: nothing to do.
    if (curKeyCodes === prevKeyCodes) {
      return false;
    }

    // Event is different from last keydown, so send exactly corresponding keyup.
    // Generate exactly corresponding keyup event for the last seen keydown.
    prevKeyArgs[0] = 'keyup';
    forwardKeyEvent(prevKeyArgs, prevKeyCodes);
    console.log('keyup ' + prevKeyCodes);
  }

  // Update previous key code and args.
  prevKeyArgs = [key.type, {
    keyCode: keyCode,
    altKey: key.altKey,
    ctrlKey: key.ctrlKey,
    metaKey: key.metaKey,
    shiftKey: key.shiftKey
  }];
  prevKeyCodes = curKeyCodes;

  console.log('keydown ' + prevKeyCodes);
  forwardKeyEvent(prevKeyArgs, prevKeyCodes);

  return false;
});

// Remove tab <-> shortcut mapping for the given tab, if one exists.
function removeShortcutMapping(tabId) {
  if (!shortcuts.has(tabId)) {
    return;
  }

  const shortcut = shortcuts.get(tabId);
  shortcuts.delete(tabId);

  if (!tabs.has(shortcut)) {
    console.debug('Inconsistent data: tab map missing key for ' +
      'known shortcut ' + shortcut);
    return;
  }

  const index = tabs.get(shortcut).indexOf(tabId);
  if (index < 0) {
    console.debug('Inconsistent data: tab map missing value for ' +
      'known tab ' + tabId);
    return;
  }
  tabs.get(shortcut).splice(index, 1);

  console.log('Removed ' + tabId + ' from index ' + index +
    ' of tab list for ' + shortcut);
}

// Track which Discord tabs have which PTT shortcuts.
// TODO: sort out callback usage.
chrome.runtime.onMessage.addListener(function(message, sender, cb) {
  if (!sender.tab || !sender.tab.id) {
    cb();
    return false;
  }

  // Potentially remove any previous (now-inaccurate) tab mapping.
  removeShortcutMapping(sender.tab.id);

  if (!tabs.has(message.shortcut)) {
    tabs.set(message.shortcut, []);
  }
  tabs.get(message.shortcut).push(sender.tab.id);
  shortcuts.set(sender.tab.id, message.shortcut);
  cb();
  console.log('tab ' + sender.tab.id + ' added');
  return false;
});

// Automatically remove tab mapping on closed tabs.
chrome.tabs.onRemoved.addListener(function(tabId, _) {
  removeShortcutMapping(tabId);
});
