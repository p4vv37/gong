from __future__ import annotations

import json
import os
import hashlib
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Literal
from uuid import uuid4

from dotenv import load_dotenv
from openai import OpenAI
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import Page, Playwright, sync_playwright
from pydantic import BaseModel, Field, model_validator

from .executor import ExecutionReceipt, PurchaseAdapter
from .models import PurchaseDetails, PurchaseStatus

load_dotenv()


class BrowserAction(BaseModel):
    current_state: Literal[
        "OPEN_PRODUCT", "CONFIGURE_PRODUCT", "CART", "CHECKOUT", "DELIVERY", "REVIEW", "BLOCKED"
    ]
    action: Literal["click", "fill", "select_option", "check", "upload", "stop"]
    candidate_id: str | None = None
    source_key: str | None = None
    option_value: str | None = None
    expected_outcome: str = Field(min_length=1, max_length=500)
    reason: str = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def validate_parameters(self) -> "BrowserAction":
        if self.action != "stop" and not self.candidate_id:
            raise ValueError("candidate_id is required for browser actions")
        if self.action in {"fill", "upload"} and not self.source_key:
            raise ValueError("source_key is required for fill and upload")
        if self.action == "select_option" and self.option_value is None:
            raise ValueError("option_value is required for select_option")
        return self


class BrowserStepResult(BaseModel):
    status: Literal["SUCCEEDED", "FAILED"]
    action: str
    state: str
    evidence: str
    page_url: str


class CheckoutSnapshot(BaseModel):
    product_title: str = Field(min_length=1, max_length=500)
    variant: str | None = Field(default=None, max_length=255)
    quantity: int = Field(ge=1, le=100)
    item_amount: Decimal = Field(ge=Decimal("0"), decimal_places=2)
    shipping_amount: Decimal = Field(ge=Decimal("0"), decimal_places=2)
    tax_amount: Decimal = Field(ge=Decimal("0"), decimal_places=2)
    total_amount: Decimal = Field(ge=Decimal("0"), decimal_places=2)
    currency: str = Field(min_length=3, max_length=3)
    product_evidence: str = Field(min_length=1, max_length=500)
    quantity_evidence: str = Field(min_length=1, max_length=200)
    total_evidence: str = Field(min_length=1, max_length=200)


class CheckoutValidationResult(BaseModel):
    valid: bool
    reasons: list[str]


class BrowserRunError(RuntimeError):
    pass


class CheckoutValidationError(BrowserRunError):
    pass


class BrowserAssetResolver:
    """Resolves Advisor asset IDs using a worker-owned allowlist."""

    def __init__(self, asset_map: dict[str, str] | None = None) -> None:
        if asset_map is None:
            try:
                asset_map = json.loads(os.getenv("BROWSER_ASSET_MAP", "{}"))
            except json.JSONDecodeError as exc:
                raise BrowserRunError("BROWSER_ASSET_MAP must be a JSON object") from exc
        self.asset_map = asset_map

    def resolve(self, asset_id: str) -> str:
        path_value = self.asset_map.get(asset_id)
        if not path_value:
            raise BrowserRunError(f"Upload asset is unavailable: {asset_id}")
        path = Path(path_value).resolve()
        if not path.is_file():
            raise BrowserRunError(f"Upload asset file does not exist: {asset_id}")
        return str(path)


@dataclass(frozen=True)
class BrowserConfig:
    headless: bool = False
    max_steps: int = 16
    model: str = "gpt-5.6"
    screenshot_dir: str = "artifacts/browser"
    browser_channel: str | None = "chrome"
    page_settle_timeout_ms: int = 6_000

    @classmethod
    def from_environment(cls) -> "BrowserConfig":
        return cls(
            headless=os.getenv("BROWSER_HEADLESS", "false").lower() == "true",
            max_steps=int(os.getenv("BROWSER_MAX_STEPS", "16")),
            model=os.getenv("AI_BROWSER_MODEL", "gpt-5.4-mini"),
            screenshot_dir=os.getenv("BROWSER_SCREENSHOT_DIR", "artifacts/browser"),
            browser_channel=os.getenv("BROWSER_CHANNEL", "chrome") or None,
            page_settle_timeout_ms=int(os.getenv("BROWSER_PAGE_SETTLE_TIMEOUT_MS", "6000")),
        )


class OpenAiBrowserPlanner:
    """Returns one constrained browser action based on the current page snapshot."""

    def __init__(self, model: str) -> None:
        api_key = os.getenv("OPENAI_API") or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise BrowserRunError("OPENAI_API or OPENAI_API_KEY is required for the browser planner")
        self.client = OpenAI(api_key=api_key)
        self.model = model

    def next_action(
        self,
        *,
        goal: dict,
        page_url: str,
        candidates: list[dict],
        available_source_keys: list[str],
        previous_result: dict | None,
    ) -> BrowserAction:
        prompt = {
            "goal": goal,
            "page_url": page_url,
            "candidates": candidates,
            "available_source_keys": available_source_keys,
            "previous_result": previous_result,
            "rules": [
                "Choose exactly one action.",
                "Use only a candidate_id from candidates.",
                "For fill use only a source_key from available_source_keys; never invent a value.",
                "Use previous_result to decide whether to continue, retry, or choose a different control.",
                "If previous_result says the requested quantity is already in the cart, never choose add-to-cart again.",
                "After a successful add-to-cart, continue using the cart or checkout control.",
                "Declare the current checkout state and the observable expected outcome.",
                "Never choose payment, place-order, buy-now, or submit-order controls.",
                "Stop when the cart or checkout is ready for user review.",
            ],
        }
        try:
            response = self.client.responses.parse(
                model=self.model,
                input=[
                    {
                        "role": "system",
                        "content": "You are a constrained web checkout planner. You prepare a cart but never make a purchase.",
                    },
                    {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
                ],
                text_format=BrowserAction,
            )
            if response.output_parsed is None:
                raise BrowserRunError("The browser planner returned no structured action")
            return response.output_parsed
        except Exception as exc:
            raise BrowserRunError("The browser planner request failed") from exc

    def read_checkout_snapshot(self, *, page_url: str, visible_text: str) -> CheckoutSnapshot:
        prompt = {
            "page_url": page_url,
            "visible_checkout_text": visible_text[:30_000],
            "instructions": [
                "Extract only values explicitly visible in the checkout summary.",
                "Amounts must be decimal numbers without currency symbols.",
                "item_amount is the displayed product line amount for one item.",
                "Use 0 for shipping or tax only when the page explicitly says free, included, or displays zero.",
                "Copy short exact visible snippets into evidence fields.",
                "Do not infer missing values and do not use expected purchase data.",
            ],
        }
        try:
            response = self.client.responses.parse(
                model=self.model,
                input=[
                    {
                        "role": "system",
                        "content": "You extract a factual checkout snapshot from visible page text. Never invent values.",
                    },
                    {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
                ],
                text_format=CheckoutSnapshot,
            )
            if response.output_parsed is None:
                raise CheckoutValidationError("Checkout reader returned no structured snapshot")
            return response.output_parsed
        except CheckoutValidationError:
            raise
        except Exception as exc:
            raise CheckoutValidationError("Checkout snapshot extraction failed") from exc


class AiAssistedBrowserAdapter(PurchaseAdapter):
    """Visible Playwright adapter that prepares a cart or checkout, never payment."""

    def __init__(
        self,
        config: BrowserConfig | None = None,
        planner: OpenAiBrowserPlanner | None = None,
        asset_resolver: BrowserAssetResolver | None = None,
    ) -> None:
        self.config = config or BrowserConfig.from_environment()
        self.planner = planner or OpenAiBrowserPlanner(self.config.model)
        self.asset_resolver = asset_resolver or BrowserAssetResolver()

    def execute(self, purchase: PurchaseDetails) -> ExecutionReceipt:
        screenshot_dir = os.path.abspath(self.config.screenshot_dir)
        os.makedirs(screenshot_dir, exist_ok=True)
        run_id = uuid4().hex
        screenshot_path = os.path.join(screenshot_dir, f"{run_id}.png")

        with sync_playwright() as playwright:
            page = self._open_page(playwright)
            try:
                page.goto(str(purchase.offer.product_url), wait_until="domcontentloaded", timeout=45_000)
                self._wait_for_interactive_state(page, minimum_wait_ms=5_000)
                self._dismiss_cookie_consent(page)
                self._wait_for_interactive_state(page, minimum_wait_ms=500)
                self._run_steps(page, purchase)
                page.screenshot(path=screenshot_path, full_page=True)
                print(f"[ai-browser] Checkout prepared at {page.url}. Screenshot: {screenshot_path}")
                return ExecutionReceipt(
                    adapter="ai-browser",
                    external_reference=page.url,
                    status=PurchaseStatus.USER_ACTION_REQUIRED,
                )
            except Exception:
                page.screenshot(path=screenshot_path, full_page=True)
                print(f"[ai-browser] Failed. Diagnostic screenshot: {screenshot_path}")
                raise
            finally:
                page.context.browser.close()

    def _open_page(self, playwright: Playwright) -> Page:
        browser = playwright.chromium.launch(
            headless=self.config.headless,
            channel=self.config.browser_channel,
        )
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        return context.new_page()

    def _run_steps(self, page: Page, purchase: PurchaseDetails) -> None:
        approved_values = self._approved_values(purchase)
        goal = {
            "title": purchase.offer.title,
            "merchantProductId": purchase.offer.merchant_product_id,
            "variant": purchase.offer.variant,
            "quantity": purchase.offer.quantity,
            "options": purchase.checkout.product_configuration.options,
            "personalizationFields": list(purchase.checkout.product_configuration.personalization),
            "uploadAssetIds": purchase.checkout.product_configuration.upload_asset_ids,
            "preferredShippingMethod": purchase.checkout.preferred_shipping_method,
            "preferredPaymentMethod": purchase.checkout.preferred_payment_method,
            "maximumTotal": str(purchase.offer.maximum_total_amount),
            "currency": purchase.offer.currency,
        }
        previous_result: BrowserStepResult | None = None
        consecutive_failures = 0
        successful_cart_adds = 0
        verified_source_keys: set[str] = set()
        required_delivery_keys = {
            "delivery.first_name",
            "delivery.last_name",
            "delivery.email",
            "delivery.phone",
            "delivery.address_line1",
            "delivery.postal_code",
            "delivery.city",
        }
        rejected_stop_attempts = 0
        for step in range(self.config.max_steps):
            # Cookie widgets are site infrastructure, not part of the purchase plan. Handle
            # them deterministically so the planner cannot get trapped expanding/scrolling
            # inside a consent modal instead of closing it.
            self._dismiss_cookie_consent(page)
            if self._is_payment_or_final_order_page(page):
                print("[ai-browser] Reached checkout boundary; waiting for user action.")
                return

            candidates = self._annotate_candidates(page)
            if not candidates:
                raise BrowserRunError("No visible interactive elements were found")
            action = self.planner.next_action(
                goal=goal, page_url=page.url, candidates=candidates,
                available_source_keys=sorted(approved_values),
                previous_result=None if previous_result is None else previous_result.model_dump(),
            )
            print(
                f"[ai-browser] Step {step + 1} [{action.current_state}]: "
                f"{action.action} ({action.reason}); expected: {action.expected_outcome}"
            )
            if action.action == "stop":
                if not self._is_review_boundary(page):
                    raise BrowserRunError("Planner attempted to stop before reaching cart or checkout")
                missing = sorted(required_delivery_keys - verified_source_keys)
                if missing:
                    rejected_stop_attempts += 1
                    previous_result = BrowserStepResult(
                        status="FAILED",
                        action="stop",
                        state=action.current_state,
                        evidence=(
                            "Checkout is not ready. Fill and verify these required Advisor fields: "
                            + ", ".join(missing)
                        ),
                        page_url=page.url,
                    )
                    print(f"[ai-browser] Verification: FAILED — {previous_result.evidence}")
                    if rejected_stop_attempts >= 3:
                        raise BrowserRunError("Planner repeatedly attempted to stop before delivery data was complete")
                    continue
                return
            selected_candidate = next(
                (candidate for candidate in candidates if candidate["id"] == action.candidate_id),
                None,
            )
            is_add_to_cart = bool(
                action.action == "click"
                and selected_candidate
                and self._is_add_to_cart_candidate(selected_candidate)
            )
            if is_add_to_cart and successful_cart_adds >= purchase.offer.quantity:
                raise BrowserRunError(
                    "Blocked repeated add-to-cart action: requested quantity is already in the cart"
                )
            baseline = self._capture_baseline(page, action)
            self._perform_action(page, action, candidates, approved_values, purchase.checkout.accept_terms)
            self._wait_for_interactive_state(page, minimum_wait_ms=1_500)
            previous_result = self._verify_action(page, action, approved_values, baseline)
            if is_add_to_cart and previous_result.status == "SUCCEEDED":
                previous_result = previous_result.model_copy(
                    update={
                        "state": "CART",
                        "evidence": (
                            f"Requested quantity ({purchase.offer.quantity}) is already in the cart. "
                            "Do not add this product again; continue through cart or checkout."
                        ),
                    }
                )
            elif action.action == "fill" and previous_result.status == "SUCCEEDED" and action.source_key:
                verified_source_keys.add(action.source_key)
                missing = sorted(required_delivery_keys - verified_source_keys)
                previous_result = previous_result.model_copy(
                    update={
                        "evidence": (
                            f"Verified {action.source_key}. "
                            + (
                                "Required delivery data is complete."
                                if not missing
                                else "Still required: " + ", ".join(missing)
                            )
                        )
                    }
                )
            print(f"[ai-browser] Verification: {previous_result.status} — {previous_result.evidence}")
            if previous_result.status == "FAILED":
                consecutive_failures += 1
                if consecutive_failures >= 3:
                    raise BrowserRunError("Three consecutive browser actions failed verification")
            else:
                consecutive_failures = 0
                if is_add_to_cart:
                    successful_cart_adds += 1
        raise BrowserRunError("Browser action limit reached before checkout was ready")

    @staticmethod
    def _cookie_consent_priority(text: str) -> int | None:
        """Prefer the least permissive consent choice and ignore preference accordions."""
        normalized = " ".join(text.casefold().split())
        choices = (
            (
                0,
                (
                    "potwierdzam wymagane",
                    "tylko wymagane",
                    "tylko niezbędne",
                    "odrzuć wszystkie",
                    "odrzuć",
                    "nie zgadzam się",
                    "reject all",
                    "decline all",
                    "necessary only",
                    "essential only",
                ),
            ),
            (1, ("potwierdzam wszystkie", "akceptuję wszystkie", "accept all", "allow all")),
        )
        for priority, labels in choices:
            if normalized in labels:
                return priority
        return None

    def _dismiss_cookie_consent(self, page: Page) -> bool:
        """Close a visible consent overlay, including banners hosted in an iframe."""
        matches: list[tuple[int, object, str]] = []
        for frame in page.frames:
            try:
                buttons = frame.get_by_role("button").all()
            except PlaywrightError:
                continue
            for button in buttons:
                try:
                    if not button.is_visible():
                        continue
                    label = button.inner_text(timeout=500).strip()
                except PlaywrightError:
                    continue
                priority = self._cookie_consent_priority(label)
                if priority is not None:
                    matches.append((priority, button, label))

        for _, button, label in sorted(matches, key=lambda match: match[0]):
            try:
                button.click(timeout=3_000)
                print(f"[ai-browser] Cookie consent dismissed via: {label}")
                return True
            except PlaywrightError:
                continue
        return False

    @staticmethod
    def _capture_baseline(page: Page, action: BrowserAction) -> dict[str, str]:
        body_text = page.locator("body").inner_text(timeout=5_000)
        return {
            "url": page.url,
            "body_hash": hashlib.sha256(body_text.encode("utf-8")).hexdigest(),
            "candidate_id": action.candidate_id or "",
        }

    @staticmethod
    def _verify_action(
        page: Page,
        action: BrowserAction,
        approved_values: dict[str, str],
        baseline: dict[str, str],
    ) -> BrowserStepResult:
        locator = page.locator(f'[data-ai-adapter-candidate="{action.candidate_id}"]')
        status: Literal["SUCCEEDED", "FAILED"] = "FAILED"
        evidence = "Expected browser state was not observed"

        if action.action == "fill" and locator.count():
            expected = approved_values.get(action.source_key or "", "")
            actual = locator.input_value()
            status = "SUCCEEDED" if actual == expected else "FAILED"
            evidence = "Field contains the approved value" if status == "SUCCEEDED" else "Field value differs from snapshot"
        elif action.action == "select_option" and locator.count():
            actual = locator.input_value()
            status = "SUCCEEDED" if actual == action.option_value else "FAILED"
            evidence = "Expected option is selected" if status == "SUCCEEDED" else "Selected option differs"
        elif action.action == "check" and locator.count():
            status = "SUCCEEDED" if locator.is_checked() else "FAILED"
            evidence = "Control is checked" if status == "SUCCEEDED" else "Control is not checked"
        elif action.action == "upload" and locator.count():
            actual = locator.input_value()
            status = "SUCCEEDED" if actual else "FAILED"
            evidence = "File input contains an uploaded file" if status == "SUCCEEDED" else "File input is empty"
        elif action.action == "click":
            body_text = page.locator("body").inner_text(timeout=5_000)
            body_hash = hashlib.sha256(body_text.encode("utf-8")).hexdigest()
            changed = page.url != baseline["url"] or body_hash != baseline["body_hash"]
            status = "SUCCEEDED" if changed else "FAILED"
            evidence = "URL or visible page content changed" if changed else "Click produced no observable change"

        return BrowserStepResult(
            status=status,
            action=action.action,
            state=action.current_state,
            evidence=evidence,
            page_url=page.url,
        )

    def _wait_for_interactive_state(self, page: Page, *, minimum_wait_ms: int) -> None:
        """Wait for delayed widgets/variants and require the element set to stabilize."""
        poll_ms = 500
        stable_polls_required = 3
        elapsed_ms = 0
        stable_polls = 0
        previous_signature: tuple[str, ...] | None = None

        while elapsed_ms < self.config.page_settle_timeout_ms:
            page.wait_for_timeout(poll_ms)
            elapsed_ms += poll_ms
            try:
                signature = tuple(
                    page.locator("button, a, input, textarea, select, [role='button'], [role='checkbox']")
                    .evaluate_all(
                        """elements => elements
                            .filter(element => element.offsetParent !== null && !element.disabled)
                            .map(element => [
                                element.tagName,
                                element.type || '',
                                element.name || '',
                                element.getAttribute('aria-label') || '',
                                element.placeholder || ''
                            ].join('|'))"""
                    )
                )
            except PlaywrightError:
                # Navigation can replace the JS execution context between polling attempts.
                stable_polls = 0
                previous_signature = None
                continue
            if signature == previous_signature and signature:
                stable_polls += 1
            else:
                stable_polls = 0
                previous_signature = signature
            if elapsed_ms >= minimum_wait_ms and stable_polls >= stable_polls_required:
                return

    @staticmethod
    def _approved_values(purchase: PurchaseDetails) -> dict[str, str]:
        address = purchase.checkout.delivery_address
        name_parts = address.recipient_name.strip().split(maxsplit=1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) == 2 else name_parts[0]
        values = {
            "delivery.recipient_name": address.recipient_name,
            "delivery.first_name": first_name,
            "delivery.last_name": last_name,
            "delivery.email": address.email,
            "delivery.phone": address.phone,
            "delivery.address_line1": address.address_line1,
            "delivery.postal_code": address.postal_code,
            "delivery.city": address.city,
            "delivery.country_code": address.country_code,
            "product.quantity": str(purchase.offer.quantity),
        }
        if address.address_line2:
            values["delivery.address_line2"] = address.address_line2
        if purchase.checkout.customer_note:
            values["checkout.customer_note"] = purchase.checkout.customer_note
        for key, value in purchase.checkout.product_configuration.personalization.items():
            values[f"personalization.{key}"] = value
        for key, value in purchase.checkout.product_configuration.options.items():
            values[f"option.{key}"] = value
        for asset_id in purchase.checkout.product_configuration.upload_asset_ids:
            values[f"asset.{asset_id}"] = asset_id
        return values

    @staticmethod
    def _annotate_candidates(page: Page) -> list[dict]:
        return page.locator("button, a, input, textarea, select, [role='button'], [role='checkbox']").evaluate_all(
            """elements => elements
                .filter(element => element.offsetParent !== null && !element.disabled)
                .slice(0, 100)
                .map((element, index) => {
                    const id = `candidate-${index}`;
                    element.setAttribute('data-ai-adapter-candidate', id);
                    return {
                        id,
                        tag: element.tagName.toLowerCase(),
                        type: element.getAttribute('type') || '',
                        value: element.value || '',
                        role: element.getAttribute('role') || '',
                        text: (element.innerText || element.value || element.getAttribute('aria-label') || '').trim().slice(0, 160),
                        name: element.getAttribute('name') || '',
                        placeholder: element.getAttribute('placeholder') || '',
                        labels: element.labels ? Array.from(element.labels).map(label => label.innerText.trim()) : [],
                        checked: Boolean(element.checked),
                        options: element.tagName === 'SELECT'
                            ? Array.from(element.options).slice(0, 30).map(option => ({value: option.value, text: option.text.trim()}))
                            : []
                    };
                })"""
        )

    def _perform_action(
        self,
        page: Page,
        action: BrowserAction,
        candidates: list[dict],
        approved_values: dict[str, str],
        accept_terms: bool,
    ) -> None:
        candidate = next((item for item in candidates if item["id"] == action.candidate_id), None)
        if candidate is None:
            raise BrowserRunError("Browser planner selected an unknown candidate")
        if self._is_irreversible(candidate):
            raise BrowserRunError("Browser planner attempted an irreversible checkout action")

        locator = page.locator(f'[data-ai-adapter-candidate="{action.candidate_id}"]')
        if action.action == "click":
            locator.click(timeout=10_000)
        elif action.action == "fill":
            if (
                candidate["tag"] not in {"input", "textarea"}
                or action.source_key not in approved_values
                or action.source_key.startswith(("option.", "asset."))
            ):
                raise BrowserRunError("Fill action did not reference an approved value")
            locator.fill(approved_values[action.source_key])
        elif action.action == "upload":
            if candidate["type"] != "file" or not action.source_key.startswith("asset."):
                raise BrowserRunError("Upload action did not reference an approved asset")
            asset_id = approved_values.get(action.source_key)
            if not asset_id:
                raise BrowserRunError("Upload action referenced an unknown asset")
            locator.set_input_files(self.asset_resolver.resolve(asset_id))
        elif action.action == "select_option":
            if candidate["tag"] != "select":
                raise BrowserRunError("select_option requires a select element")
            allowed_values = {option["value"] for option in candidate["options"]}
            if action.option_value not in allowed_values:
                raise BrowserRunError("Browser planner selected an invalid option")
            locator.select_option(action.option_value)
        elif action.action == "check":
            if candidate["type"] == "radio":
                if action.source_key not in approved_values:
                    raise BrowserRunError("Radio action did not reference an approved product option")
                expected = approved_values[action.source_key].strip().lower()
                actual = " ".join((candidate["text"], candidate["value"], *candidate["labels"])).lower()
                if expected not in actual:
                    raise BrowserRunError("Radio control does not match the approved product option")
            elif candidate["type"] == "checkbox":
                if action.source_key and action.source_key in approved_values:
                    if approved_values[action.source_key].lower() not in {"true", "yes", "1"}:
                        raise BrowserRunError("Shopping Advisor did not enable this product option")
                elif not accept_terms:
                    raise BrowserRunError("Checkbox consent was not granted by Shopping Advisor")
            else:
                raise BrowserRunError("check requires an approved radio or checkbox")
            locator.check()
        else:
            raise BrowserRunError(f"Unsupported browser action: {action.action}")

    @staticmethod
    def _is_irreversible(candidate: dict) -> bool:
        text = " ".join(
            str(candidate.get(field, "")) for field in ("text", "name", "type", "placeholder", "labels")
        ).lower()
        blocked = (
            "zapłać", "płatność", "złóż zamówienie", "zamów teraz", "kup teraz",
            "place order", "pay now", "complete order", "submit order",
        )
        return any(term in text for term in blocked)

    @staticmethod
    def _is_add_to_cart_candidate(candidate: dict) -> bool:
        text = " ".join(
            str(candidate.get(field, "")) for field in ("text", "name", "labels")
        ).lower()
        return candidate.get("name") == "add" or any(
            phrase in text for phrase in ("dodaj do koszyka", "add to cart", "add to bag")
        )

    @staticmethod
    def _is_payment_or_final_order_page(page: Page) -> bool:
        url = page.url.lower()
        return any(fragment in url for fragment in ("/payment", "thank_you", "order-status", "order-received"))

    @staticmethod
    def _is_review_boundary(page: Page) -> bool:
        url = page.url.lower()
        return any(fragment in url for fragment in ("/cart", "/koszyk", "/checkout", "/checkouts/"))
