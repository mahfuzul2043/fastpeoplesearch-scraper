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
const extensionPath = path_1.default.join(__dirname, "captcha-extension");
// Write header if the file doesn't exist
if (!csvExists) {
    fs_1.default.writeFileSync(csvPath, "Full Name,Age,Location,Phone,Previous Phones\n");
}
const BASE_URL = "https://www.fastpeoplesearch.com";
async function main() {
    const chromePath = path_1.default.join(__dirname, "chrome-win", "chrome.exe");
    const { page, browser } = await (0, puppeteer_real_browser_1.connect)({
        turnstile: true,
        headless: false,
        // disableXvfb: true,
        customConfig: {
            chromePath,
        },
        connectOption: {
            defaultViewport: null,
        },
        args: [
            `--load-extension=${extensionPath}`,
            `--disable-extensions-except=${extensionPath}`,
        ],
    });
    for (const name of names) {
        let pageNum = 9;
        while (true) {
            let pageUrl = pageNum === 1
                ? `${BASE_URL}/name/${encodeURIComponent(name)}`
                : `${BASE_URL}/name/${encodeURIComponent(name)}/page/${pageNum}`;
            await (0, utils_1.navigateWithDelay)(page, pageUrl);
            let notFoundFlag = false;
            let profiles;
            while (true) {
                try {
                    const { promise: notFound, interval: notFoundInterval } = (0, utils_1.waitForTextWithTimeout)(page, /We could not find the page you were looking for/i);
                    const { promise: peopleList, interval: peopleListInterval } = (0, utils_1.waitForSelectorWithTimeout)(page, ".people-list .card");
                    const result = await Promise.race([notFound, peopleList]);
                    if (result === true) {
                        notFoundFlag = true;
                    }
                    else {
                        profiles = result;
                    }
                    clearInterval(notFoundInterval);
                    clearInterval(peopleListInterval);
                    break;
                }
                catch (error) {
                    console.error("Timed out waiting for people-list card. Retrying...");
                }
            }
            if (notFoundFlag) {
                console.log(`No more results for "${name}". Moving to next name.`);
                break;
            }
            for (const profile of profiles) {
                const data = await (0, utils_1.getProfileData)(page, profile);
                if (data.age && data.age > 30) {
                    const row = `"${data.fullName}","${data.age}","${data.address}","${data.phone}","${data.previousPhones.join("; ")}"\n`;
                    fs_1.default.appendFileSync(csvPath, row);
                }
                await profile.dispose();
            }
            pageNum++;
        }
    }
    await browser.close();
}
main();
