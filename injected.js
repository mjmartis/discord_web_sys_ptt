// Constants used to specify keyboard shortcuts in the Discord web client.
const DISCORD_KEYBOARD = 0;
const DISCORD_BROWSER = 4;

// Compare two arrays of scalars.
function arraysEqual(a1, a2) {
  return a1.length === a2.length && a1.every(function(v, i) { return v === a2[i] });
}

// Parse and return the PTT shortcut from a serialized MediaEngineStore
// structure.
function parseShortcut(storageValue) {
  try {
    const value = JSON.parse(storageValue).default;

    if (value.mode !== 'PUSH_TO_TALK' || !value.modeOptions.shortcut) {
      return -1;
    }

    // Return a list of key codes, from the list with entries of the form:
    //   [KEYBOARD, key code, BROWSER].
    return value.modeOptions.shortcut.map(function(vs) {
      if (vs.length != 3 || vs[0] != DISCORD_KEYBOARD || vs[2] != DISCORD_BROWSER) {
        throw "unrecognised shortcut specification.";
      }
      return vs[1];
    });
  } catch (err) {
    console.error('Couldn\'t parse PTT shortcut: ' + err);
    return -1;
  }
}

// TODO: sometimes localStorage not available.

// Override method to notify extension about local storage changes.
window.localStorage.__proto__ = Object.create(Storage.prototype);
window.localStorage.__proto__.setItem = (function() {
  // Notify about initial PTT shortcut.
  const initShortcut = parseShortcut(window.localStorage.getItem('MediaEngineStore'));
  document.dispatchEvent(new CustomEvent('SwpttShortcutChanged', {
    'detail': initShortcut
  }));

  // Then only notify about changes to shortcut.
  let prevShortcut = initShortcut;
  return function(key, value) {
    if (key === 'MediaEngineStore') {
      const curShortcut = parseShortcut(value);
      if (!arraysEqual(curShortcut, prevShortcut)) {
        prevShortcut = curShortcut;
        document.dispatchEvent(new CustomEvent('SwpttShortcutChanged', {
          'detail': curShortcut
        }));
      }
    }

    Storage.prototype.setItem.apply(this, arguments);
  }
})();
