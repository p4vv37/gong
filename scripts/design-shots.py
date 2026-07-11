"""Walk the fixture flow headlessly and screenshot every UI state.

Usage: uv run python scripts/design-shots.py <outdir> [port]
"""

import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

outdir = Path(sys.argv[1])
port = sys.argv[2] if len(sys.argv) > 2 else "3902"
outdir.mkdir(parents=True, exist_ok=True)
base = f"http://localhost:{port}"

VIEWPORTS = {"desktop": (1440, 900), "mobile": (390, 844)}


def shot(page, name):
    page.wait_for_timeout(350)
    page.screenshot(path=str(outdir / f"{name}.png"), full_page=True)
    print("shot", name)


with sync_playwright() as p:
    browser = p.chromium.launch()
    for label, (w, h) in VIEWPORTS.items():
        page = browser.new_page(viewport={"width": w, "height": h})
        page.goto(base, wait_until="networkidle")
        shot(page, f"01-home-{label}")

        # request -> question plan (mock provider when keyless: instant)
        page.fill("textarea", "kurtka przeciwdeszczowa miejska, do 400 zł")
        page.get_by_role("button", name="Start the interview").click() if page.get_by_role(
            "button", name="Start the interview"
        ).count() else page.locator(".primary-button").click()
        page.wait_for_selector(".question-block, .ready-state", timeout=30000)
        shot(page, f"02-question-{label}")

        # answer choices until ready
        for _ in range(12):
            if page.locator(".ready-state").count():
                break
            choices = page.locator(".choice-card")
            if not choices.count():
                break
            choices.first.click()
            nxt = page.locator(".typed-submit")
            if nxt.count() and nxt.first.is_enabled():
                nxt.first.click()
            page.wait_for_timeout(400)
        page.wait_for_selector(".ready-state", timeout=15000)
        shot(page, f"03-ready-{label}")

        # fixture research
        fixture_btn = page.locator(".research-mode-selector button").first
        if fixture_btn.count():
            fixture_btn.click()
        page.locator(".ready-state .primary-button, .ready-state .typed-submit").first.click()
        page.wait_for_selector(".research-shell", timeout=15000)
        shot(page, f"04-progress-{label}")
        page.wait_for_selector(".results-shell", timeout=40000)
        shot(page, f"05-results-{label}")

        # product artifact
        page.locator(".product-card-open").first.click()
        page.wait_for_selector(".artifact-shell", timeout=10000)
        shot(page, f"06-artifact-{label}")

        # consent modal
        checkout = page.locator(".artifact-checkout")
        if checkout.count():
            checkout.first.click()
            page.wait_for_selector(".consent-card", timeout=10000)
            shot(page, f"07-consent-{label}")
        page.close()
    browser.close()
print("done ->", outdir)
