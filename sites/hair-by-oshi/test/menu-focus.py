"""Regression check: phone menu traps focus and returns it after Escape."""
import asyncio
from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        for motion in ["reduce", "no-preference"]:
            context = await browser.new_context(
                viewport={"width": 1280, "height": 1800}, reduced_motion=motion
            )
            page = await context.new_page()
            await page.set_viewport_size({"width": 390, "height": 844})
            await page.goto("http://localhost:8080", wait_until="networkidle")
            await page.wait_for_timeout(3500)
            trigger = page.get_by_role("button", name="Open menu")
            await trigger.click()
            menu = page.get_by_role("dialog", name="Menu")
            await page.wait_for_timeout(900)
            for key in ["Tab"] * 24 + ["Shift+Tab"] * 24:
                await page.keyboard.press(key)
                assert await menu.evaluate("e => e.contains(document.activeElement)")
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(900)
            assert await menu.count() == 0
            assert await trigger.evaluate("e => e === document.activeElement")
            assert await page.evaluate('document.documentElement.style.overflow === ""')
            await context.close()
        await browser.close()
    print("Menu focus, Escape, and scroll restoration: passed in both motion modes")


asyncio.run(main())