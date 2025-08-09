"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer_real_browser_1 = require("puppeteer-real-browser");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
const common_names_json_1 = __importDefault(require("./common-names.json"));
const names = common_names_json_1.default; // Type assertion to specify it's an array of strings
const csvPath = path_1.default.join(__dirname, "people.csv");
const csvExists = fs_1.default.existsSync(csvPath);
// Write header if the file doesn't exist
if (!csvExists) {
    fs_1.default.writeFileSync(csvPath, "Full Name,Age,Location,Phone\n");
}
const BASE_URL = "https://www.fastpeoplesearch.com";
async function main() {
    const { page, browser } = await (0, puppeteer_real_browser_1.connect)({
        turnstile: true,
        headless: false,
        // disableXvfb: true,
        customConfig: {},
        connectOption: {
            defaultViewport: null,
        },
    });
    for (const name of names) {
        let pageNum = 1;
        while (true) {
            let pageUrl = pageNum === 1
                ? `${BASE_URL}/name/${encodeURIComponent(name)}`
                : `${BASE_URL}/name/${encodeURIComponent(name)}/page/${pageNum}`;
            await (0, utils_1.navigateWithDelay)(page, pageUrl);
            // Check for 'We could not find the page you were looking for.'
            const notFound = await page.evaluate(() => {
                return !!document.body.innerText.match(/We could not find the page you were looking for\./i);
            });
            if (notFound) {
                if (pageNum === 1) {
                    console.log(`Page not found for ${name}, skipping.`);
                }
                break;
            }
            while (true) {
                try {
                    await page.waitForSelector(".people-list .card", { timeout: 5000 });
                    break;
                }
                catch (error) {
                    console.error("Timed out waiting for people-list card");
                }
            }
            const profiles = await page.$$(".people-list .card");
            for (const profile of profiles) {
                const data = await (0, utils_1.getProfileData)(page, profile);
                if (data.age && data.age > 55) {
                    const row = `${data.fullName},${data.age},${data.address},${data.phone}\n`;
                    fs_1.default.appendFileSync(csvPath, row);
                }
            }
            pageNum++;
        }
    }
    await browser.close();
}
main();
