/**
 * The number of milliseconds to wait between polls of the broadcasting status.
 * @const {number}
 */
const BROADCASTING_INTERVAL_MS = 2000;

/**
 * The initial number of milliseconds to wait before sending a keyup event. Is longer than
 * subsequent waits because the OS or browser briefly "debounces" the shortcut when it is
 * initially pressed.
 * @const {number}
 */
const PTT_INITIAL_INTERVAL_MS = 1000;

/**
 * The number of milliseconds to wait between subsequent key events when PTT is active.
 * @const {number}
 */
const PTT_ACTIVE_INTERVAL_MS = 500;

/**
 * A manually-constructed map from modifiers to their (likely) key codes. From
 * https://github.com/wesbos/keycodes/blob/gh-pages/scripts.js.
 * @const {!Array<!Array>}
 */
const MOD_KEY_CODES = [
  ["shiftKey", 16],
  ["ctrlKey", 17],
  ["altKey", 18],
  ["metaKey", 91],
];

/**
 * The list of URL prefixes that indicate the page is an instance of the Discord web app.
 * @const {!Array<string>}
 */
const DISCORD_APP_URLS = ["https://discord.com/app", "https://discord.com/channels"];

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
 * Returns true if the current page is an instance of the Discord web app.
 *
 * Required because Discord often redirects users from a non-app page to the app.
 *
 * @returns {boolean} True if the current page is an instance of the Discord web app.
 */
function isDiscordApp() {
  return DISCORD_APP_URLS.some((url) => window.location.href.startsWith(url));
}

/**
 * Parses and returns the PTT shortcut from a serialized MediaEngineStore structure.
 *
 * @param {?Object} storageValue - The string value associated with the MediaEngineStore key in
 *     local storage, or null if no such key exists.
 * @return {!Array<number>} The list of key codes specified as the PTT shortcut in the
 *     MediaEngineStore structure, or an empty list if PTT is not enabled or there was an error.
 */
function parseShortcut(storageValue) {
  // There will be no MediaEngineStore entry on first usage of the Discord web client.
  if (storageValue == null) {
    return [];
  }

  try {
    const value = JSON.parse(storageValue).default;
    if (value.mode !== "PUSH_TO_TALK") {
      return [];
    }

    // Return a list of key codes, from the list with entries of the form:
    //   [KEYBOARD, key code, BROWSER].
    return value.modeOptions.shortcut
      .map((vs) => {
        if (vs.length !== 3 || vs[0] !== DISCORD_KEYBOARD || vs[2] !== DISCORD_BROWSER) {
          throw new Error("Unrecognised shortcut specification.");
        }
        return vs[1];
      })
      .sort();
  } catch (err) {
    console.error("Couldn't parse PTT shortcut: " + err.message);
    return [];
  }
}

/**
 * Reads Discord PTT shortcut information from local storage and constructs the corresponding key
 * event parameters to press/unpress it.
 *
 * @returns {?Object} The parameters for a key event that will trigger the PTT shortcut, or null if
 *     the PTT shortcut is not enabled.
 */
function getKeyEventParams() {
  const keyCodeList = parseShortcut(window.localStorage.getItem("MediaEngineStore"));

  if (keyCodeList.length === 0) {
    return null;
  }

  let lastModKeyCode = -1;
  const keyEventParams = {};
  for ([mod, modKeyCode] of MOD_KEY_CODES) {
    const index = keyCodeList.indexOf(modKeyCode);
    if (index === -1) continue;

    keyCodeList.splice(index, 1);
    keyEventParams[mod] = true;
    lastModKeyCode = modKeyCode;
  }

  if (keyCodeList.length > 1) {
    console.debug("Unknown mod key present: key code " + keyCodeList);
    return null;
  }

  keyEventParams["keyCode"] = keyCodeList.length > 0 ? keyCodeList[0] : lastModKeyCode;
  return keyEventParams;
}

/**
 * Parses and returns the broadcasting status from a serialized SelectedChannelStore structure.
 *
 * @param {?Object} storageValue - The string value associated with the SelectedChannelStore key in
 *     local storage, or null if no such key exists in local storage.
 * @return {boolean} True if the current page is broadcasting the user's voice.
 */
function parseBroadcastingStatus(storageValue) {
  if (storageValue == null) {
    return false;
  }

  try {
    const value = JSON.parse(storageValue);
    return value.selectedVoiceChannelId != null && value.lastConnectedTime !== 0;
  } catch (err) {
    console.error("Couldn't parse broadcasting status: " + err.message);
    return false;
  }
}

/**
 * Reads from Discord local storage to determine if the user is currently broadcasting their voice.
 *
 * @returns {boolean} True if the current page is broadcasting the user's voice.
 */
function isBroadcasting() {
  return (
    isDiscordApp() && parseBroadcastingStatus(window.localStorage.getItem("SelectedChannelStore"))
  );
}

/**
 * Starts listening for "extend PTT" messages from the background script. Emulates a button press
 * when receiving such a message, and schedules a later button release unless further messages are
 * received.
 */
function installPttHook() {
  let endPttTimeoutId = null;

  chrome.runtime.onMessage.addListener((message) => {
    const keyEventParams = getKeyEventParams();

    if (message.action !== "dswptt_ptt" || !isBroadcasting() || keyEventParams == null) {
      return;
    }

    // Use a separate timeout to handle the longer initial delay between shortcut messages that
    // the OS or browser introduces presumably as a kind of debounce mechanism.
    let timeoutMs = PTT_INITIAL_INTERVAL_MS;
    if (endPttTimeoutId !== null) {
      clearTimeout(endPttTimeoutId);
      timeoutMs = PTT_ACTIVE_INTERVAL_MS;
    }

    (document || document.activeElement).dispatchEvent(
      new KeyboardEvent("keydown", keyEventParams),
    );

    endPttTimeoutId = setTimeout(() => {
      (document || document.activeElement).dispatchEvent(
        new KeyboardEvent("keyup", keyEventParams),
      );
      endPttTimeoutId = null;
    }, timeoutMs);
  });
}

/**
 * Starts regularly polling Discord local storage to determine if the user is broadcasting their
 * voice, and notifies the background script when the status changes.
 */
function installBroadcastingBadgeHook() {
  let wasBroadcasting = false;

  setInterval(() => {
    const isBroadcasting =
      isDiscordApp() &&
      parseBroadcastingStatus(window.localStorage.getItem("SelectedChannelStore")) &&
      getKeyEventParams() != null;

    if (isBroadcasting === wasBroadcasting) {
      return;
    }

    chrome.runtime.sendMessage({
      action: "dswptt_broadcasting",
      isBroadcasting,
    });
    wasBroadcasting = isBroadcasting;
  }, BROADCASTING_INTERVAL_MS);

  // Never broadcasting once the user navigates away.
  window.addEventListener("unload", function () {
    if (!wasBroadcasting) {
      return;
    }

    chrome.runtime.sendMessage({
      action: "dswptt_broadcasting",
      isBroadcasting: false,
    });
    wasBroadcasting = false;
  });
}

// Actual entrypoint. Run when document is loaded.

installPttHook();
installBroadcastingBadgeHook();
