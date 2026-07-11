from __future__ import annotations

import sys

from playwright.sync_api import sync_playwright

from purchase_orchestrator.ai_browser import AiAssistedBrowserAdapter


url = sys.argv[1]

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel="chrome", headless=False)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.goto(url, wait_until="domcontentloaded", timeout=60_000)
    page.wait_for_timeout(3_000)

    adapter = object.__new__(AiAssistedBrowserAdapter)
    dismissed = adapter._dismiss_cookie_consent(page)
    page.wait_for_timeout(1_000)
    confirmation = page.get_by_role("button", name="Potwierdzam wymagane", exact=True)

    print(f"COOKIE_DISMISSED: {dismissed}")
    print(f"VISIBLE_REQUIRED_CONFIRMATIONS: {confirmation.count()}")
    print(f"BODY_OVERFLOW: {page.locator('body').evaluate('(body) => getComputedStyle(body).overflow')}")
    page.screenshot(path="artifacts/browser/cookie-consent-dismissed.png", full_page=True)
    browser.close()
