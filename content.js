// Inject a script to the DOM that gives us early access to
// local storage for the page.
const script = document.createElement("script");

// Override the item setting method to notify us about changes
// to local storage.
script.innerHTML = `
window.localStorage.__proto__ = Object.create(Storage.prototype);
window.localStorage.__proto__.setItem = function(k, v) {
  console.log("LS SET CALLED " + k);
  Storage.prototype.setItem.apply(this, arguments);
}
`;

document.documentElement.appendChild(script);
