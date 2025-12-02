const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

var discordtoken = urlParams.get("discordtoken")

if(discordtoken) {
	// localStorage.clear(); 拡張機能に保存機能があるからclearしてもいいと思う
	localStorage.setItem("token", `"${discordtoken.replace('"', '')}"`);
	window.location.replace("https://discord.com/channels/@me");
}