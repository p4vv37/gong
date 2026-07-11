from __future__ import annotations

import json
import sys

from playwright.sync_api import sync_playwright


PRODUCT_URL = (
    sys.argv[1]
    if len(sys.argv) > 1
    else "https://cs-studio.pl/products/obraz-z-twojego-zdjecia-na-zamowienie-spersonalizowany-prezent"
)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel="chrome", headless=False)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.goto(PRODUCT_URL, wait_until="domcontentloaded", timeout=60_000)
    page.wait_for_timeout(3_000)
    reject_cookies = page.get_by_role("button", name="Odrzuć")
    if reject_cookies.count():
        reject_cookies.click()
    if "--add-to-cart" in sys.argv:
        page.get_by_role("button", name="Dodaj do koszyka").click()
        page.wait_for_timeout(3_000)
    fields = page.locator("select, input, textarea, button").evaluate_all(
        """elements => elements
            .filter(element => element.offsetParent !== null)
            .map(element => ({
                tag: element.tagName.toLowerCase(),
                type: element.type || '',
                name: element.name || '',
                text: (element.innerText || element.value || element.placeholder || element.getAttribute('aria-label') || '').trim().slice(0, 120),
                options: element.tagName === 'SELECT' ? Array.from(element.options).map(option => option.text.trim()) : []
            }))"""
    )
    print(json.dumps(fields, ensure_ascii=False, indent=2))
    print(f"URL: {page.url}")
    page.screenshot(path="artifacts/browser/cs-studio-product-inspection.png", full_page=True)
    browser.close()
