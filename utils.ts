import { GoToOptions } from "puppeteer";
import { ElementHandle } from "rebrowser-puppeteer-core";
import { PageWithCursor } from "puppeteer-real-browser";

async function navigateWithDelay(page: PageWithCursor, url: string, ms = 7000) {
  await Promise.all([
    page.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: ms,
    }),
    page.goto(url),
  ]).catch(() => {});

  await delay(ms);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Profile = {
  age: number;
  fullName: string;
  address: string;
  phone: string;
};

async function getProfileData(
  page: PageWithCursor,
  profile: ElementHandle<Element>
): Promise<Profile> {
  return await page.evaluate((card) => {
    // Helper to get text after a header
    function getTextAfterHeader(header: string) {
      const h3s = Array.from(card.querySelectorAll("h3"));
      const h3 = h3s.find((h) => h.textContent?.trim() === header);
      if (h3) {
        let node = h3.nextSibling;
        // Skip non-text nodes and empty text nodes
        while (
          node &&
          (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim())
        )
          node = node.nextSibling;
        return node ? node.textContent?.trim() : "";
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
      fullName = cardTitle ? cardTitle.textContent?.trim() || "" : "";
    }

    // Address
    const addressDiv = card.querySelector("div[style*='line-height:20px']");
    const address = addressDiv
      ? addressDiv.textContent?.replace(/\s+/g, " ").trim()
      : "";

    // Phone
    const phoneLink = card.querySelector("a.nowrap[href^='/']");
    const phone = phoneLink ? phoneLink.textContent?.trim() : "";

    return { age, fullName, address, phone };
  }, profile);
}

export { navigateWithDelay, delay, getProfileData };
