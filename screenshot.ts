/**
 * Example 2: Taking Screenshots with Bun.WebView
 * Resizes the viewport, navigates to a site, captures a screenshot, and saves it.
 */

console.log("🌐 Launching Bun.WebView...");
await using webview = new Bun.WebView();

console.log("📐 Setting viewport to 1280x800...");
await webview.resize(1280, 800);

const targetUrl = "https://bun.sh";
console.log(`📍 Navigating to ${targetUrl}...`);
await webview.navigate(targetUrl);

console.log("📸 Capturing screenshot...");
const screenshotBlob = await webview.screenshot();

const outputPath = "screenshot.png";
await Bun.write(outputPath, screenshotBlob);

console.log(`✅ Saved screenshot to ${outputPath} (${(screenshotBlob.size / 1024).toFixed(1)} KB)`);
