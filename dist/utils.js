"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForSelectorWithTimeout = exports.waitForTextWithTimeout = void 0;
exports.navigateWithDelay = navigateWithDelay;
exports.delay = delay;
exports.getProfileData = getProfileData;
async function navigateWithDelay(page, url, ms = 7000) {
    await Promise.all([
        page.waitForNavigation({
            waitUntil: "domcontentloaded",
            timeout: ms,
        }),
        page.goto(url),
    ]).catch(() => { });
    // await delay(ms);
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
const waitForTextWithTimeout = (page, textRegex, callback) => {
    let interval;
    const regexSource = textRegex.source;
    const regexFlags = textRegex.flags;
    const promise = new Promise((resolve) => {
        page
            .evaluate((source, flags) => { var _a, _b; return !!((_b = (_a = document.body) === null || _a === void 0 ? void 0 : _a.innerText) === null || _b === void 0 ? void 0 : _b.match(new RegExp(source, flags))); }, regexSource, regexFlags)
            .then((result) => {
            if (result) {
                resolve(true);
                callback();
                return;
            }
        });
        interval = setInterval(() => {
            page
                .evaluate((source, flags) => { var _a, _b; return !!((_b = (_a = document.body) === null || _a === void 0 ? void 0 : _a.innerText) === null || _b === void 0 ? void 0 : _b.match(new RegExp(source, flags))); }, regexSource, regexFlags)
                .then((result) => {
                if (result) {
                    resolve(true);
                    callback();
                    clearInterval(interval);
                }
            });
        }, 2000);
    });
    return { interval, promise };
};
exports.waitForTextWithTimeout = waitForTextWithTimeout;
const waitForSelectorWithTimeout = (page, selector) => {
    let interval;
    const promise = new Promise((resolve) => {
        page
            .$$(selector)
            .then((result) => {
            if (result.length) {
                resolve(result);
                return;
            }
        })
            .catch(() => { });
        interval = setInterval(() => {
            page
                .$$(selector)
                .then((result) => {
                if (result.length) {
                    resolve(result);
                    clearInterval(interval);
                }
            })
                .catch(() => { });
        }, 2000);
    });
    return { interval, promise };
};
exports.waitForSelectorWithTimeout = waitForSelectorWithTimeout;
async function getProfileData(page, profile) {
    return await page.evaluate((card) => {
        var _a, _b, _c;
        // Helper to get text after a header
        function getTextAfterHeader(header) {
            var _a, _b;
            const h3s = Array.from(card.querySelectorAll("h3"));
            const h3 = h3s.find((h) => { var _a; return ((_a = h.textContent) === null || _a === void 0 ? void 0 : _a.trim()) === header; });
            if (h3) {
                let node = h3.nextSibling;
                // Skip non-text nodes and empty text nodes
                while (node &&
                    (node.nodeType !== Node.TEXT_NODE || !((_a = node.textContent) === null || _a === void 0 ? void 0 : _a.trim())))
                    node = node.nextSibling;
                return node ? (_b = node.textContent) === null || _b === void 0 ? void 0 : _b.trim() : "";
            }
            return "";
        }
        // Age
        const ageText = getTextAfterHeader("Age:");
        const age = ageText ? parseInt(ageText, 10) : null;
        // Full Name
        let fullName = getTextAfterHeader("Full Name:");
        if (!fullName) {
            // Fallback: get from card title
            const cardTitle = card.querySelector("h2.card-title span.larger");
            fullName = cardTitle ? ((_a = cardTitle.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || "" : "";
        }
        // Address
        const addressDiv = card.querySelector("div[style*='line-height:20px']");
        const address = addressDiv
            ? (_b = addressDiv.textContent) === null || _b === void 0 ? void 0 : _b.replace(/\s+/g, " ").trim()
            : "";
        // Phone numbers
        const phoneLinks = Array.from(card.querySelectorAll("a.nowrap[href^='/']"));
        let phone = "";
        let previousPhones = [];
        if (phoneLinks.length > 0) {
            phone = ((_c = phoneLinks[0].textContent) === null || _c === void 0 ? void 0 : _c.trim()) || "";
            previousPhones = phoneLinks
                .slice(1)
                .map((link) => { var _a; return ((_a = link.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || ""; });
        }
        return { age, fullName, address, phone, previousPhones };
    }, profile);
}
