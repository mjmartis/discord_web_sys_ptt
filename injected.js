// Compare two (possibly nested) arrays.
function arraysEqual(a1, a2) {
  if (a1.length !== a2.length) {
    return false;
  }

  return a1.every(function(v, i) {
    return Array.isArray(v) && Array.isArray(a2[i]) ?
      arraysEqual(v, a2[i]) : v === a2[i]
  });
}

// Parse and return the PTT shortcut from a serialized MediaEngineStore
// structure.
function parseShortcut(storageValue) {
  try {
    const value = JSON.parse(storageValue).default;
    return value.mode == 'PUSH_TO_TALK' ? value.modeOptions.shortcut : [];
  } catch (err) {
    console.error('Couldn\'t parse PTT shortcut: ' + err);
    return [];
  }
}

// Override method to notify us about local storage changes.
window.localStorage.__proto__ = Object.create(Storage.prototype);
window.localStorage.__proto__.setItem = (function() {
  // Only notify about changes to shortcut.
  let prevShortcut = null;

  return function(key, value) {
    if (key === 'MediaEngineStore') {
      const curShortcut = parseShortcut(value);
      if (prevShortcut === null || !arraysEqual(curShortcut, prevShortcut)) {
        prevShortcut = curShortcut;
        document.dispatchEvent(new CustomEvent('SwpttShortcutChanged', {
          'detail': curShortcut
        }));
      }
    }

    Storage.prototype.setItem.apply(this, arguments);
  }
})();
