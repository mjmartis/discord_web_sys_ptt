/**
 * The default minimum number of ms to wait from initial shortcut message
 * before ending PTT.
 * @const {number}
 */
const PTT_DELAY_FIRST_DEFAULT = 800;

/**
 * The number of ms to wait from last shortcut message before ending PTT.
 * @const {number}
 */
const PTT_DELAY_LAST = 100;

/**
 * A manually-constructed map from modifiers to their (likely) key codes. From
 * https://github.com/wesbos/keycodes/blob/gh-pages/scripts.js.
 * @const {!Array<!Array>}
 */
const MOD_KEY_CODES = [
  ['shiftKey', 16],
  ['ctrlKey', 17],
  ['altKey', 18],
  ['metaKey', 91],
];

const INJECTED_JS = String.raw `
/**
 * Value used to specify keyboard shortcuts in the Discord web client.
 * @const {number}
 */
const DISCORD_KEYBOARD = 0;

/**
 * Value used to specify browser shortcuts in the Discord web client.
 * @const {number}
 */
const DISCORD_BROWSER = 4;

/**
 * Parses and returns the PTT shortcut from a serialized MediaEngineStore
 * structure.
 *
 * @param {?Object} storageValue - The string value associated with the
 *     MediaEngineStore key in local storage, or null if no such key exists in
 *     local storage.
 * @return {!Array<number>} The list of key codes specified as the PTT shortcut
 *     in the MediaEngineStore structure, or an empty list if PTT is not
 *     enabled or there was an error.
 */
function parseShortcut(storageValue) {
  // There will be no MediaEngineStore entry on first usage of the Discord web
  // client.
  if (storageValue == null) return [];

  try {
    const value = JSON.parse(storageValue).default;
    if (value.mode !== 'PUSH_TO_TALK') {
      return [];
    }

    // Return a list of key codes, from the list with entries of the form:
    //   [KEYBOARD, key code, BROWSER].
    return value.modeOptions.shortcut.map(function(vs) {
      if (vs.length != 3 || vs[0] != DISCORD_KEYBOARD || vs[2] != DISCORD_BROWSER) {
        throw new Error("unrecognised shortcut specification.");
      }
      return vs[1];
    }).sort();
  } catch (err) {
    console.error('Couldn\'t parse PTT shortcut: ' + err.message);
    return [];
  }
}

/**
 * Parses and returns the broadcasting status from a serialized
 * SelectedChannelStore structure.
 *
 * @param {?Object} storageValue - The string value associated with the
 *     SelectedChannelStore key in local storage, or null if no such key exists
 *     in local storage.
 * @return {boolean} true if the current page is broadcasting the user's voice.
 */
function parseBroadcastingStatus(storageValue) {
  if (storageValue == null) return false;

  try {
    const value = JSON.parse(storageValue);
    return value.selectedVoiceChannelId != null && value.lastConnectedTime !== 0;
  } catch (err) {
    console.error('Couldn\'t parse broadcasting status: ' + err.message);
    return false;
  }
}

// Overrides method to notify extension about local storage changes.
window.localStorage.__proto__ = Object.create(Storage.prototype);
window.localStorage.__proto__.setItem = (function() {
  // Notify about initial PTT shortcut.
  let prevShortcut = parseShortcut(window.localStorage.getItem('MediaEngineStore'));
  document.dispatchEvent(new CustomEvent('BwpttShortcutChanged', {
    'detail': prevShortcut,
  }));

  // Notify if the tab is immediately broadcasting.
  let prevBroadcasting = parseBroadcastingStatus(
      window.localStorage.getItem('SelectedChannelStore'));
  document.dispatchEvent(new CustomEvent('BwpttBroadcasting', {
    'detail': prevShortcut.length > 0 && prevBroadcasting,
  }));

  return function(key, value) {
    if (key === 'MediaEngineStore') {
      prevShortcut = parseShortcut(value);

      document.dispatchEvent(new CustomEvent('BwpttBroadcasting', {
        'detail': prevShortcut.length > 0 && prevBroadcasting,
      }));

      document.dispatchEvent(new CustomEvent('BwpttShortcutChanged', {
        'detail': prevShortcut,
      }));
    } else if (key === 'SelectedChannelStore') {
      prevBroadcasting = parseBroadcastingStatus(value);

      document.dispatchEvent(new CustomEvent('BwpttBroadcasting', {
        'detail': prevShortcut.length > 0 && parseBroadcastingStatus(value),
      }));
    }

    Storage.prototype.setItem.apply(this, arguments);
  };
})();
`;

/**
 * The minimum number of ms to wait from initial shortcut message before ending
 * PTT.
 * @type {number}
 */
let pttDelayFirst = PTT_DELAY_FIRST_DEFAULT;

/**
 * The time (in ms past the Unix epoch) at which the active PTT window should
 * end, or null if there is no PTT window currently active.
 * @type {?number}
 */
let pttEndTime = null;

/**
 * The key code and modifier statuses with which to construct syntheic PTT key
 * up/down events for this tab.
 * @type {?Object<string, (number|boolean)}
 */
let keyEventInits = null;

/**
 * The timeout ID for the active PTT window (if one exists).
 * @type {?number}
 */
let toId = null;

// Listen for updates to page's PTT shortcut.
document.addEventListener('BwpttShortcutChanged', function(ev) {
  if (ev.detail.length === 0) {
    keyEventInits = null;
    return;
  }

  keyEventInits = {};
  let keyCodeList = ev.detail;
  let lastModKeyCode = -1;
  for ([mod, modKeyCode] of MOD_KEY_CODES) {
    const index = keyCodeList.indexOf(modKeyCode);
    if (index === -1) continue;

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

// Listen to changes in the page's broadcasting status.
document.addEventListener('BwpttBroadcasting', function(ev) {
  chrome.runtime.sendMessage({
    id: 'broadcasting',
    value: ev.detail,
  });
});

/** Sends a PTT keyup event. */
function pttOff() {
  pttEndTime = null;

  if (keyEventInits !== null) {
    document.dispatchEvent(new KeyboardEvent('keyup', keyEventInits));
  }
}

/**
 * Extends the PTT off timeout, and sends a PTT keydown event if one hasn't
 * been sent yet.
 */
function onExtShortcut() {
  if (keyEventInits === null) return;

  if (toId !== null) clearTimeout(toId);

  const pttDelay = pttEndTime === null ?
    pttDelayFirst :
    Math.max(PTT_DELAY_LAST, pttEndTime - new Date().getTime());
  toId = setTimeout(pttOff, pttDelay);

  if (pttEndTime === null) {
    pttEndTime = new Date().getTime() + pttDelayFirst;
    document.dispatchEvent(new KeyboardEvent('keydown', keyEventInits));
  }
}

// Respond to events from the background script.
chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.id === 'ext_shortcut_pushed') {
    onExtShortcut();
  } else if (msg.id === 'min_ptt_length_changed') {
    pttDelayFirst = msg.value;
  }

  return false;
});

// Notify background script that we're a Discord tab.
chrome.runtime.sendMessage({
  id: 'discord_loaded',
}, minPttLength => {
  pttDelayFirst = minPttLength;
});

// Inject script to run in page's JS environment.
const injected = document.createElement('script');
injected.textContent = INJECTED_JS;
(document.head || document.documentElement).appendChild(injected);
injected.remove();
