/**
 * Example 3: Search Automation & Data Extraction
 * Automates searching DuckDuckGo and extracting the top results.
 */

console.log("🌐 Launching Bun.WebView...");
await using webview = new Bun.WebView();

const query = "Bun JavaScript runtime";
console.log(`🔍 Searching DuckDuckGo for: "${query}"...`);
await webview.navigate(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);

console.log("📑 Parsing search results...");
const resultsJson = await webview.evaluate(`(() => {
  const links = Array.from(document.querySelectorAll(".result__body")).slice(0, 5);
  return JSON.stringify(
    links.map(el => {
      const titleEl = el.querySelector(".result__title .result__snippet, .result__title a");
      const urlEl = el.querySelector(".result__url");
      const snippetEl = el.querySelector(".result__snippet");
      return {
        title: titleEl ? titleEl.textContent.trim() : "No title",
        url: urlEl ? urlEl.textContent.trim() : "",
        snippet: snippetEl ? snippetEl.textContent.trim() : ""
      };
    })
  );
})()`);

const results = JSON.parse(resultsJson);

console.log(`\n✨ Top ${results.length} Search Results:`);
results.forEach((res: { title: string; url: string; snippet: string }, i: number) => {
  console.log(`\n[${i + 1}] ${res.title}`);
  console.log(`    URL: ${res.url}`);
  console.log(`    ${res.snippet}`);
});
