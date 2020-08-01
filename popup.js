var slider = document.getElementById('slider');
var label = document.getElementById('label');

// Called when a new min PTT length is set from any popup.
function onMinPttLengthChanged(minPttLength) {
  slider.value = minPttLength;
  label.innerHTML = minPttLength + 'ms';
}

// Keep our min PTT length in sync with all the others.
chrome.runtime.onMessage.addListener(function(msg, _) {
  if (msg.id !== 'min_ptt_length_changed') {
    console.debug('Unexpected message "' + msg.id + '" received by popup.');
    return false;
  }

  return onMinPttLengthChanged(msg.value);
});

// Request stored min PTT length from background script.
chrome.runtime.sendMessage({
  id: 'popup_loaded'
}, onMinPttLengthChanged);

// Update background (and subsequently all other popups) with new values from
// this slider.
slider.oninput = function() {
  chrome.runtime.sendMessage({
    id: 'min_ptt_length_changed',
    value: parseInt(this.value)
  });
}
