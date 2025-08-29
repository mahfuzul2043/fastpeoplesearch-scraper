"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("./utils");
const prompt_sync_1 = __importDefault(require("prompt-sync"));
const prompt = (0, prompt_sync_1.default)();
const namesPath = path_1.default.join(__dirname, "common-names.json");
const names = JSON.parse(fs_1.default.readFileSync(namesPath, "utf8"));
const csvPath = path_1.default.join(__dirname, "people.csv");
const csvExists = fs_1.default.existsSync(csvPath);
// Write header if the file doesn't exist
if (!csvExists) {
    fs_1.default.writeFileSync(csvPath, "Full Name,Age,Location,Phone,Previous Phones\n");
}
const BASE_URL = "https://www.fastpeoplesearch.com";
async function main() {
    let { page, browser } = await (0, utils_1.connectPuppeteer)();
    for (const name of names) {
        let pageNum = 1;
        while (true) {
            let pageUrl = pageNum === 1
                ? `${BASE_URL}/name/${encodeURIComponent(name)}`
                : `${BASE_URL}/name/${encodeURIComponent(name)}/page/${pageNum}`;
            await (0, utils_1.navigateWithDelay)(page, pageUrl);
            let notFoundFlag = false;
            let rateLimitFlag = false;
            let profiles;
            while (true) {
                try {
                    let textResultType;
                    const { promise: notFound, interval: notFoundInterval } = (0, utils_1.waitForTextWithTimeout)(page, /We could not find the page you were looking for/i, () => {
                        textResultType = "notFound";
                    });
                    const { promise: rateLimitExceeded, interval: rateLimitInterval } = (0, utils_1.waitForTextWithTimeout)(page, /Rate Limit Exceeded/i, () => {
                        textResultType = "rateLimitExceeded";
                    });
                    const { promise: peopleList, interval: peopleListInterval } = (0, utils_1.waitForSelectorWithTimeout)(page, ".people-list .card");
                    const result = await Promise.race([
                        notFound,
                        peopleList,
                        rateLimitExceeded,
                    ]);
                    if (result === true) {
                        if (textResultType === "notFound") {
                            notFoundFlag = true;
                        }
                        if (textResultType === "rateLimitExceeded") {
                            rateLimitFlag = true;
                        }
                    }
                    else {
                        profiles = result;
                    }
                    clearInterval(notFoundInterval);
                    clearInterval(peopleListInterval);
                    clearInterval(rateLimitInterval);
                    break;
                }
                catch (error) {
                    console.error("An unexpected error occurred. Retrying...", error);
                }
            }
            if (notFoundFlag) {
                console.log(`No more results for "${name}". Moving to next name.`);
                break;
            }
            if (rateLimitFlag) {
                console.log("Rate limit exceeded");
                while (true) {
                    const input = prompt('Turn on a US based VPN Server and press "C" to continue, or "Q" to quit: ');
                    if ((input === null || input === void 0 ? void 0 : input.toUpperCase()) === "C") {
                        break;
                    }
                    if ((input === null || input === void 0 ? void 0 : input.toUpperCase()) === "Q") {
                        await page.close();
                        await browser.close();
                        process.exit(0);
                    }
                }
                continue;
            }
            for (const profile of profiles) {
                const data = await (0, utils_1.getProfileData)(page, profile);
                if (data.age && data.age > 30) {
                    const phoneRegex = /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g;
                    const previousPhones = data.previousPhones.map((prevPhone) => {
                        return prevPhone.replace(phoneRegex, (match) => {
                            const digits = match.replace(/\D/g, "");
                            return `"=HYPERLINK(""tel:${digits}"",""${match}"")"`;
                        });
                    });
                    const row = `"${data.fullName}","${data.age}","${data.address}","=HYPERLINK(""tel:${data.phone}"",""${data.phone}"")",${previousPhones.length ? previousPhones.join(",") : ""}\n`;
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
