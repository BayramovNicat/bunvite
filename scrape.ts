/**
 * Example 1: Scraping Data with Bun.WebView
 * Fetches top headlines from Hacker News and prints structured JSON.
 */

console.log("🌐 Launching Bun.WebView...");

await using webview = new Bun.WebView();

console.log("📍 Navigating to Hacker News...");
await webview.navigate("https://news.ycombinator.com");

console.log("📑 Extracting top articles...");
const rawData = await webview.evaluate(`
  JSON.stringify(
    Array.from(document.querySelectorAll(".athing")).slice(0, 5).map((row) => {
      const titleLink = row.querySelector(".titleline > a");
      const subtext = row.nextElementSibling;
      const score = subtext ? subtext.querySelector(".score")?.textContent : "0 points";
      const author = subtext ? subtext.querySelector(".hnuser")?.textContent : "unknown";

      return {
        title: titleLink?.textContent || "",
        url: titleLink?.getAttribute("href") || "",
        score: score || "0 points",
        author: author || "unknown"
      };
    })
  )
`);

const articles = JSON.parse(rawData);

console.log("\n✨ Top 5 Articles on Hacker News:");
console.table(articles);
