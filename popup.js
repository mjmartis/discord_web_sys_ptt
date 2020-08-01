var slider = document.getElementById('slider');
var label = document.getElementById('label');

// Called when a new window value is set from any popup.
function onWindowValueChanged(windowValue) {
  slider.value = windowValue;
  label.innerHTML = windowValue + 'ms';
}

// Keep our window value in sync with all the others.
chrome.runtime.onMessage.addListener(function(msg, _) {
  if (msg.id !== 'window_changed') {
    console.debug('Unexpected message "' + msg.id + '" received by popup.');
    return false;
  }

  return onWindowValueChanged(msg.value);
  return false;
});

// Request stored window value from background script.
chrome.runtime.sendMessage({
  id: 'popup_loaded'
}, onWindowValueChanged);

// Update background (and subsequently all other popups) with new values from
// this slider.
slider.oninput = function() {
  chrome.runtime.sendMessage({
    id: 'window_changed',
    value: parseInt(this.value)
  });
}
