import fs from "fs";
import path from "path";
import {
  connectPuppeteer,
  getProfileData,
  navigateWithDelay,
  waitForSelectorWithTimeout,
  waitForTextWithTimeout,
} from "./utils";
import { ElementHandle } from "rebrowser-puppeteer-core";
import promptSync from "prompt-sync";
const prompt = promptSync();

const namesPath = path.join(__dirname, "common-names.json");
const names: string[] = JSON.parse(fs.readFileSync(namesPath, "utf8"));

const csvPath = path.join(__dirname, "people.csv");
const csvExists = fs.existsSync(csvPath);

// Write header if the file doesn't exist
if (!csvExists) {
  fs.writeFileSync(csvPath, "Full Name,Age,Location,Phone,Previous Phones\n");
}

const BASE_URL = "https://www.fastpeoplesearch.com";

async function main() {
  let { page, browser } = await connectPuppeteer();

  for (const name of names) {
    let pageNum = 1;

    while (true) {
      let pageUrl =
        pageNum === 1
          ? `${BASE_URL}/name/${encodeURIComponent(name)}`
          : `${BASE_URL}/name/${encodeURIComponent(name)}/page/${pageNum}`;

      await navigateWithDelay(page, pageUrl);

      let notFoundFlag = false;
      let rateLimitFlag = false;
      let profiles: ElementHandle<Element>[];

      while (true) {
        try {
          let textResultType: "notFound" | "rateLimitExceeded";

          const { promise: notFound, interval: notFoundInterval } =
            waitForTextWithTimeout(
              page,
              /We could not find the page you were looking for/i,
              () => {
                textResultType = "notFound";
              }
            );

          const { promise: rateLimitExceeded, interval: rateLimitInterval } =
            waitForTextWithTimeout(page, /Rate Limit Exceeded/i, () => {
              textResultType = "rateLimitExceeded";
            });

          const { promise: peopleList, interval: peopleListInterval } =
            waitForSelectorWithTimeout(page, ".people-list .card");

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
          } else {
            profiles = result as ElementHandle<Element>[];
          }

          clearInterval(notFoundInterval);
          clearInterval(peopleListInterval);
          clearInterval(rateLimitInterval);

          break;
        } catch (error) {
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
          const input = prompt(
            'Turn on a US based VPN Server and press "C" to continue, or "Q" to quit: '
          );

          if (input?.toUpperCase() === "C") {
            break;
          }

          if (input?.toUpperCase() === "Q") {
            await page.close();
            await browser.close();
            process.exit(0);
          }
        }

        continue;
      }

      for (const profile of profiles) {
        const data = await getProfileData(page, profile);

        if (data.age && data.age > 30) {
          const phoneRegex = /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g;

          const previousPhones = data.previousPhones.map((prevPhone) => {
            return prevPhone.replace(phoneRegex, (match) => {
              const digits = match.replace(/\D/g, "");
              return `"=HYPERLINK(""tel:${digits}"",""${match}"")"`;
            });
          });

          const row = `"${data.fullName}","${data.age}","${
            data.address
          }","=HYPERLINK(""tel:${data.phone}"",""${data.phone}"")",${
            previousPhones.length ? previousPhones.join(",") : ""
          }\n`;

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
