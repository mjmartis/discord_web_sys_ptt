// Listen for commands (extension shortcut presses) from the user.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "dswptt_cmd") {
    return;
  }

  chrome.tabs.query({}, (tabs) =>
    tabs.forEach((tab) => chrome.tabs.sendMessage(tab.id, { action: "dswptt_ptt_extend" })),
  );
});

// Display a badge when the user is connected to a Discord channel.
chrome.action.setBadgeBackgroundColor({ color: "#EB3434" });
chrome.action.setBadgeTextColor({ color: "#FFFFFF" });
chrome.runtime.onMessage.addListener((message) => {
  if (message.action !== "dswptt_ptt_active") {
    return;
  }

  chrome.action.setBadgeText({ text: message.status ? "ON" : "" });
});
