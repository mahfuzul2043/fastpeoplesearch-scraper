"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
    await delay(ms);
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
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
        // Phone
        const phoneLink = card.querySelector("a.nowrap[href^='/']");
        const phone = phoneLink ? (_c = phoneLink.textContent) === null || _c === void 0 ? void 0 : _c.trim() : "";
        return { age, fullName, address, phone };
    }, profile);
}
