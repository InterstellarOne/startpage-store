import fs from "fs";
import path from "path";

const targetDir = "src/content/startpages";
const data = JSON.parse(process.env.parsed_data);

if (!data) console.error(`Data from issue ${process.env.issue_number} failed to parse`);

// Title and Description
const title = data["Title"];
const description = Array.isArray(data["Description"]) ? data["Description"].join(", ") : data["Description"];

// Tags
const tags = [];

function format_tag (tag) {
    return tag.replace(/[^a-zA-Z0-9' ]/g, "");
}

for (let i = 1; i < 9; i++) {
    const tag = format_tag(data[i]);

    if (tag && tag != "No response") {
        tags.push(tag);
    } else {
        console.log(`Tag ${i} not found`);
    }
}

// Cover
const screenshots = data["Cover screenshot"];
const screenshot = screenshots.match(/\(.*?\)/);
if (screenshots.includes("\n")) console.log("Multiple screenshots were uploaded so only the first one has been added.");

// License 
const proprietary = !data["License type"]["This startpage is open source"];

// Links 
if (data["Source (Github, Codeberg, or other)"].includes("https://")) [
    if 
] else {
    console.log("Source link invalid or not submitted.");
}

