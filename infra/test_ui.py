"""Playwright end-to-end test for Holmes UI."""

import asyncio

from playwright.async_api import async_playwright

BASE_URL = "https://holmesgpt.dev.platform.pditechnologies.com"
USERNAME = "admin"
PASSWORD = "HolmesGPT@Dev2026!"


async def test_holmes_ui():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        # 1. Navigate to the app — should show login page (401 redirect)
        print("1. Navigating to Holmes UI...")
        await page.goto(BASE_URL)
        await page.wait_for_load_state("networkidle")
        await page.screenshot(path="screenshots/01_login_page.png")
        print(f"   URL: {page.url}")
        print("   Screenshot: screenshots/01_login_page.png")

        # 2. Login
        print("2. Logging in...")
        await page.fill('input[name="username"], input[type="text"]', USERNAME)
        await page.fill('input[name="password"], input[type="password"]', PASSWORD)
        await page.click('button[type="submit"]')
        await page.wait_for_load_state("networkidle")
        await asyncio.sleep(2)
        await page.screenshot(path="screenshots/02_after_login.png")
        print(f"   URL: {page.url}")
        print("   Screenshot: screenshots/02_after_login.png")

        # 3. Chat page — send a message
        print("3. Testing Chat page...")
        # Look for the chat input
        chat_input = page.locator('textarea, input[placeholder*="Ask"]').first
        if await chat_input.is_visible():
            await chat_input.fill("What pods are running in the default namespace?")
            await page.screenshot(path="screenshots/03_chat_input.png")
            print("   Screenshot: screenshots/03_chat_input.png")

            # Submit the message
            submit_btn = page.locator('button[type="submit"], button:has(svg)').last
            await submit_btn.click()
            print("   Message sent, waiting for response...")

            # Wait for response (up to 60s for LLM)
            await asyncio.sleep(5)
            await page.screenshot(path="screenshots/04_chat_loading.png")
            print("   Screenshot: screenshots/04_chat_loading.png")

            # Wait longer for actual response
            try:
                await page.wait_for_selector(
                    '[class*="message"], [class*="bubble"], [class*="response"]',
                    timeout=60000,
                )
            except Exception:
                pass
            await page.screenshot(path="screenshots/05_chat_response.png")
            print("   Screenshot: screenshots/05_chat_response.png")
        else:
            print("   Chat input not found, taking screenshot...")
            await page.screenshot(path="screenshots/03_no_chat_input.png")

        # 4. Navigate to Investigations
        print("4. Testing Investigations page...")
        inv_btn = page.locator('button:has-text("Investigations")').first
        if await inv_btn.is_visible():
            await inv_btn.click()
            await asyncio.sleep(2)
        await page.screenshot(path="screenshots/06_investigations.png")
        print("   Screenshot: screenshots/06_investigations.png")

        # 5. Navigate to Integrations
        print("5. Testing Integrations page...")
        int_btn = page.locator('button:has-text("Integrations")').first
        if await int_btn.is_visible():
            await int_btn.click()
            await asyncio.sleep(3)
            await page.screenshot(path="screenshots/07_integrations.png")
            print("   Screenshot: screenshots/07_integrations.png")

            # Verify ADO and Atlassian cards are visible
            ado_card = page.locator("text=ado").first
            atlassian_card = page.locator("text=atlassian").first
            mcp_badge = page.locator("text=MCP").first
            ado_visible = await ado_card.is_visible() if ado_card else False
            atl_visible = await atlassian_card.is_visible() if atlassian_card else False
            mcp_visible = await mcp_badge.is_visible() if mcp_badge else False
            print(f"   ADO card visible: {ado_visible}")
            print(f"   Atlassian card visible: {atl_visible}")
            print(f"   MCP badge visible: {mcp_visible}")
        else:
            print("   Integrations nav button not found")
            await page.screenshot(path="screenshots/07_no_integrations.png")

        # 6. Navigate to Settings
        print("6. Testing Settings page...")
        settings_btn = page.locator('button:has-text("Settings")').first
        if await settings_btn.is_visible():
            await settings_btn.click()
            await asyncio.sleep(2)
        await page.screenshot(path="screenshots/08_settings.png")
        print("   Screenshot: screenshots/08_settings.png")

        # 7. Test logout
        print("7. Testing logout...")
        logout_btn = page.locator('button:has-text("Sign out")').first
        if await logout_btn.is_visible():
            await logout_btn.click()
            await asyncio.sleep(2)
            await page.screenshot(path="screenshots/09_after_logout.png")
            print("   Screenshot: screenshots/09_after_logout.png")

        print("\nAll tests completed!")
        await browser.close()


if __name__ == "__main__":
    import os

    os.makedirs("screenshots", exist_ok=True)
    asyncio.run(test_holmes_ui())
