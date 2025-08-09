import { connect } from "puppeteer-real-browser";
import fs from "fs";
import path from "path";
import { getProfileData, navigateWithDelay } from "./utils";
import namesList from "./common-names.json";

const names = namesList as string[]; // Type assertion to specify it's an array of strings

const csvPath = path.join(__dirname, "people.csv");
const csvExists = fs.existsSync(csvPath);
const extensionPath = path.join(__dirname, "captcha-extension");

// Write header if the file doesn't exist
if (!csvExists) {
  fs.writeFileSync(csvPath, "Full Name,Age,Location,Phone\n");
}

const BASE_URL = "https://www.fastpeoplesearch.com";

async function main() {
  const { page, browser } = await connect({
    turnstile: true,
    headless: false,
    // disableXvfb: true,
    customConfig: {},
    connectOption: {
      defaultViewport: null,
    },
    args: [
      `--load-extension=${extensionPath}`,
      `--disable-extensions-except=${extensionPath}`,
    ],
  });

  for (const name of names) {
    let pageNum = 1;

    while (true) {
      let pageUrl =
        pageNum === 1
          ? `${BASE_URL}/name/${encodeURIComponent(name)}`
          : `${BASE_URL}/name/${encodeURIComponent(name)}/page/${pageNum}`;

      await navigateWithDelay(page, pageUrl);

      // Check for 'We could not find the page you were looking for.'
      const notFound = await page.evaluate(() => {
        return !!document.body?.innerText?.match(
          /We could not find the page you were looking for\./i
        );
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
        } catch (error) {
          console.error("Timed out waiting for people-list card. Retrying...");
        }
      }

      const profiles = await page.$$(".people-list .card");

      for (const profile of profiles) {
        const data = await getProfileData(page, profile);

        if (data.age && data.age > 55) {
          const row = `"${data.fullName}","${data.age}","${data.address}","${data.phone}"\n`;
          fs.appendFileSync(csvPath, row);
        }
      }

      pageNum++;
    }
  }

  await browser.close();
}

main();
