from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto('http://localhost:5173/')
    # Wait for the app to load and calculate the initial simulation to render charts
    page.wait_for_selector('canvas', state='visible', timeout=10000)
    time.sleep(2) # Extra time for charts to render fully
    page.screenshot(path='frontend_screenshot.png')
    browser.close()
