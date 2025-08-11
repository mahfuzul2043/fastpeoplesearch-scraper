import { connect } from "puppeteer-real-browser";
import fs from "fs";
import path from "path";
import {
  getProfileData,
  navigateWithDelay,
  waitForSelectorWithTimeout,
  waitForTextWithTimeout,
} from "./utils";
import namesList from "./common-names.json";
import { ElementHandle } from "rebrowser-puppeteer-core";

const names = namesList as string[]; // Type assertion to specify it's an array of strings

const csvPath = path.join(__dirname, "people.csv");
const csvExists = fs.existsSync(csvPath);
const extensionPath = path.join(__dirname, "captcha-extension");

// Write header if the file doesn't exist
if (!csvExists) {
  fs.writeFileSync(csvPath, "Full Name,Age,Location,Phone,Previous Phones\n");
}

const BASE_URL = "https://www.fastpeoplesearch.com";

async function main() {
  const chromePath = path.join(__dirname, "chrome-win", "chrome.exe");

  const { page, browser } = await connect({
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
    let pageNum = 1;

    while (true) {
      let pageUrl =
        pageNum === 1
          ? `${BASE_URL}/name/${encodeURIComponent(name)}`
          : `${BASE_URL}/name/${encodeURIComponent(name)}/page/${pageNum}`;

      await navigateWithDelay(page, pageUrl);

      let notFoundFlag = false;
      let profiles: ElementHandle<Element>[];

      while (true) {
        try {
          const { promise: notFound, interval: notFoundInterval } =
            waitForTextWithTimeout(
              page,
              /We could not find the page you were looking for/i
            );

          const { promise: peopleList, interval: peopleListInterval } =
            waitForSelectorWithTimeout(page, ".people-list .card");

          const result = await Promise.race([notFound, peopleList]);

          if (result === true) {
            notFoundFlag = true;
          } else {
            profiles = result as ElementHandle<Element>[];
          }

          clearInterval(notFoundInterval);
          clearInterval(peopleListInterval);

          break;
        } catch (error) {
          console.error("Timed out waiting for people-list card. Retrying...");
        }
      }

      if (notFoundFlag) {
        console.log(`No more results for "${name}". Moving to next name.`);
        break;
      }

      for (const profile of profiles) {
        const data = await getProfileData(page, profile);

        if (data.age && data.age > 30) {
          const row = `"${data.fullName}","${data.age}","${data.address}","${
            data.phone
          }","${data.previousPhones.join("; ")}"\n`;
          fs.appendFileSync(csvPath, row);
        }

        await profile.dispose();
      }

      pageNum++;
    }
  }

  await browser.close();
}

main();
