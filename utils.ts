import { ElementHandle } from "rebrowser-puppeteer-core";
import { connect, PageWithCursor } from "puppeteer-real-browser";
import path from "path";

async function navigateWithDelay(page: PageWithCursor, url: string, ms = 7000) {
  await Promise.all([
    page.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: ms,
    }),
    page.goto(url),
  ]).catch(() => {});

  // await delay(ms);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const waitForTextWithTimeout = (
  page: PageWithCursor,
  textRegex: RegExp,
  callback?: () => void
) => {
  let interval: NodeJS.Timeout;
  const regexSource = textRegex.source;
  const regexFlags = textRegex.flags;

  const promise = new Promise<boolean>((resolve) => {
    page
      .evaluate(
        (source, flags) =>
          !!document.body?.innerText?.match(new RegExp(source, flags)),
        regexSource,
        regexFlags
      )
      .then((result) => {
        if (result) {
          resolve(true);
          callback();
          return;
        }
      })
      .catch(() => {});

    interval = setInterval(() => {
      page
        .evaluate(
          (source, flags) =>
            !!document.body?.innerText?.match(new RegExp(source, flags)),
          regexSource,
          regexFlags
        )
        .then((result) => {
          if (result) {
            resolve(true);
            callback();
            clearInterval(interval);
          }
        })
        .catch(() => {});
    }, 2000);
  });

  return { interval, promise };
};

const waitForSelectorWithTimeout = (page: PageWithCursor, selector: string) => {
  let interval: NodeJS.Timeout;

  const promise = new Promise<ElementHandle<Element>[]>((resolve) => {
    page
      .$$(selector)
      .then((result) => {
        if (result.length) {
          resolve(result);
          return;
        }
      })
      .catch(() => {});

    interval = setInterval(() => {
      page
        .$$(selector)
        .then((result) => {
          if (result.length) {
            resolve(result);
            clearInterval(interval);
          }
        })
        .catch(() => {});
    }, 2000);
  });

  return { interval, promise };
};

type Profile = {
  age: number;
  fullName: string;
  address: string;
  phone: string;
  previousPhones: string[];
};

async function getProfileData(
  page: PageWithCursor,
  profile: ElementHandle<Element>
): Promise<Profile> {
  return await page.evaluate((card) => {
    // Helper to get text after a header
    function getTextAfterHeader(header) {
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

    // Phone numbers
    const phoneLinks = Array.from(card.querySelectorAll("a.nowrap[href^='/']"));
    let phone = "";
    let previousPhones = [];

    if (phoneLinks.length > 0) {
      phone = phoneLinks[0].textContent?.trim() || "";
      previousPhones = phoneLinks
        .slice(1)
        .map((link) => link.textContent?.trim() || "");
    }

    return { age, fullName, address, phone, previousPhones };
  }, profile);
}

const connectPuppeteer = (proxy?: string) => {
  const extensionPath = path.join(__dirname, "captcha-extension");

  const args = [
    `--load-extension=${extensionPath}`,
    `--disable-extensions-except=${extensionPath}`,
    "--ignore-certificate-errors",
    "--allow-insecure-localhost",
  ];

  if (proxy) {
    args.push(`--proxy-server=${proxy}`);
  }

  return connect({
    turnstile: true,
    headless: false,
    // disableXvfb: true,
    customConfig: {
      chromePath: path.join(__dirname, "chrome-win", "chrome.exe"),
    },
    connectOption: {
      defaultViewport: null,
    },
    args,
  });
};

export {
  navigateWithDelay,
  delay,
  getProfileData,
  waitForTextWithTimeout,
  waitForSelectorWithTimeout,
  connectPuppeteer,
};
