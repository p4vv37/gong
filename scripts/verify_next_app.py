from __future__ import annotations

from playwright.sync_api import sync_playwright


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel="chrome", headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.goto("http://127.0.0.1:3000", wait_until="networkidle", timeout=60_000)
    body = page.locator("body").inner_text()
    overlay = page.locator('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay').count()
    interactive = page.locator("button, input, textarea, select, a").count()
    page.screenshot(path="artifacts/integrated-app.png", full_page=True)
    print(f"title={page.title()!r}")
    print(f"content_chars={len(body.strip())}")
    print(f"interactive_elements={interactive}")
    print(f"error_overlay={overlay}")
    if not body.strip() or overlay:
        raise SystemExit(1)
    browser.close()
