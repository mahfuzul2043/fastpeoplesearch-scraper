const fs = require("fs");
const path = require("path");
const prompt = require("prompt-sync")();

const csvPathToConvert = prompt(
  "Enter the path to the CSV file you would like to convert: "
);

const data = fs.readFileSync(csvPathToConvert, "utf8");
const lines = data.split("\n").filter(Boolean);

const profiles = [];

for (let i = 1; i < lines.length; i++) {
  const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

  // Remove quotes and trim
  const get = (idx) => (row[idx] ? row[idx].replace(/^"|"$/g, "").trim() : "");

  profiles.push({
    age: parseInt(get(1), 10),
    fullName: get(0),
    address: get(2),
    phone: get(3),
    previousPhones: get(4).replaceAll('"', ""),
  });
}

const csvPathToWrite = path.join(__dirname, "converted_people.csv");
const csvExists = fs.existsSync(csvPathToWrite);

// Write header if the file doesn't exist
if (!csvExists) {
  fs.writeFileSync(
    csvPathToWrite,
    "Full Name,Age,Location,Phone,Previous Phones\n"
  );
}

profiles.forEach((profile) => {
  const phoneRegex = /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g;

  const previousPhones = profile.previousPhones.split("; ").map((prevPhone) => {
    return prevPhone.replace(phoneRegex, (match) => {
      const digits = match.replace(/\D/g, "");
      return `"=HYPERLINK(""tel:${digits}"",""${match}"")"`;
    });
  });

  const row = `"${profile.fullName}","${profile.age}","${
    profile.address
  }","=HYPERLINK(""tel:${profile.phone}"",""${profile.phone}"")",${
    previousPhones.length ? previousPhones.join(",") : ""
  }\n`;

  fs.appendFileSync(csvPathToWrite, row);
});
