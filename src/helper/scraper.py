# ----- required imports -----

import asyncio
from playwright.async_api import async_playwright

# ----- helper functions -----

URL = "https://leetcode.com/problemset/"
OUTPUT_FILE = "leetcode_links.txt"

QUESTION_DIV_CLASS = "max-w-[302px] flex items-center overflow-hidden"
NEXT_BUTTON_CLASS = "flex items-center justify-center px-3 h-8 rounded select-none focus:outline-none bg-fill-3 dark:bg-dark-fill-3 text-label-2 dark:text-dark-label-2 hover:bg-fill-2 dark:hover:bg-dark-fill-2"
SVG_PATH_D = "M7.913 19.071l7.057-7.078-7.057-7.064a1 1 0 011.414-1.414l7.764 7.77a1 1 0 010 1.415l-7.764 7.785a1 1 0 01-1.414-1.414z"

async def scrape_leetcode():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(URL)
        seen_links = set()
        while True:
            question_divs = await page.query_selector_all(f'div.{QUESTION_DIV_CLASS}')
            for div in question_divs:
                anchor = await div.query_selector("div > div > a")
                if anchor:
                    href = await anchor.get_attribute("href")
                    if href and href not in seen_links:
                        seen_links.add(href)
                        with open(OUTPUT_FILE, "a") as f:
                            f.write(f"https://leetcode.com{href}\n")
            next_buttons = await page.query_selector_all(f'button.{NEXT_BUTTON_CLASS}')
            next_button = None
            for button in next_buttons:
                svg = await button.query_selector("svg path")
                if svg:
                    path_d = await svg.get_attribute("d")
                    if path_d == SVG_PATH_D:
                        next_button = button
                        break
            if next_button and await next_button.is_enabled():
                await next_button.click()
                await page.wait_for_load_state("networkidle")
            else:
                break
        await browser.close()

# ----- main execution code -----

if __name__ == "__main__":
    asyncio.run(scrape_leetcode())