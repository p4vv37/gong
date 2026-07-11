from __future__ import annotations

import json

from playwright.sync_api import sync_playwright


URL = "https://www.abud.pl/product-pol-4881-Ziemia-uniwersalna-do-kwiatow-i-warzyw-20L-Planta.html"

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel="chrome", headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.goto(URL, wait_until="domcontentloaded", timeout=60_000)
    page.wait_for_timeout(18_000)
    for frame in page.frames:
        elements = frame.locator("button, a, [role='button'], [aria-label], [title]").evaluate_all(
            """elements => elements.map(element => ({
                tag: element.tagName,
                text: (element.innerText || '').trim(),
                aria: element.getAttribute('aria-label'),
                title: element.getAttribute('title'),
                className: element.className,
            }))"""
        )
        print(json.dumps({"url": frame.url, "elements": elements}, ensure_ascii=False, indent=2))
    browser.close()
