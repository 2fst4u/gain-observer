from playwright.sync_api import sync_playwright

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto('http://localhost:5173')

        # Wait for app to load
        page.wait_for_selector('select#antenna-type')

        # Select delta-loop
        page.select_option('select#antenna-type', 'delta-loop')
        page.wait_for_timeout(500)

        # Take screenshot
        page.screenshot(path='/home/jules/verification/screenshots/verification-g-scene-fix.png', full_page=True)

        browser.close()

verify()
