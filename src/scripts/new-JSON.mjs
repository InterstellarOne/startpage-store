import fs from "fs";
import path from "path";
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const targetDir = "src/content/startpages";
const imageDir = "public/screenshots"
const data = JSON.parse(process.env.parsed_data);
const chromeStatsKey = process.env.CHROME_STATS_API_KEY;

if (!data) console.error(`Data from issue ${process.env.issue_number} failed to parse`);

// Title and Description
const title = data["Name"];
const description = Array.isArray(data["Description"]) ? data["Description"].join(", ") : data["Description"];

// Tags
const tags = [];

function format (tag) {
    return tag.replace(/[^a-zA-Z0-9' ]/g, "");
}

for (let i = 1; i < 9; i++) {
    const tag = format(data[i]);

    if (tag && tag != "No response") {
        tags.push(tag);
    } else {
        console.log(`Tag ${i} not found`);
    }
}

// Cover
// https://flaviocopes.com/how-to-download-an-image-from-url-in-node/

const MIME_MAP = {
'image/png': '.png',
'image/jpeg': '.jpg',
'image/jpg': '.jpg',
};

async function downloadImage(url) {
    const response = await fetch(url)

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.body) {
        throw new Error('Response has no body');
    }

    const contentType = response.headers.get('content-type');
    const extension = MIME_MAP[contentType];
    const filePath = createImagePath(extension);

    await pipeline(
        Readable.fromWeb(response.body),
        createWriteStream(filePath)
    );

    return filePath;
}

let fileName;

function createImagePath(extension) {
    while (true) {
        fileName = format(title.toLowerCase()).replaceAll(" ","-")+ (Math.floor(Math.random() * 9000) + 1000);
        const imageName = fileName + extension;
        const imagePath = path.resolve(imageDir, imageName);

        if (!fs.existsSync(imagePath)) {
            return imagePath;
        }
    }
}

const screenshots = data["Cover screenshot"];
const match = screenshots.match(/\((.*?)\)/);
const screenshot = match[1];
if (screenshots.includes("\n")) console.log("Multiple screenshots were uploaded so only the first one has been added.");
const imageLocalFilePath = await downloadImage(screenshot);
const imageFilePath = path.relative(path.resolve('public'), imageLocalFilePath);

// License 
const proprietary = !data["License type"]["This startpage is open source"];

// Links 
let gitLink;
if (data["Source (Github, Codeberg, or other)"].includes("https://")) {
    if (data["Source (Github, Codeberg, or other)"].includes("https://github.com/") || 
    data["Source (Github, Codeberg, or other)"].includes("https://codeberg.org/") || 
    data["Source (Github, Codeberg, or other)"].includes("https://gitlab.com/")) {
        gitLink = data["Source (Github, Codeberg, or other)"];
        if (gitLink.endsWith(".git")) gitLink.slice(0, -4);
    } else {
        console.log("Unknown source website. Fields may need to be populated manually, or this website may be added to the API script.");
    }
} else {
    console.log("Source link invalid or not submitted.");
}

let websiteLink;
if (data["Standalone website"].includes("https://")) {
    websiteLink = data["Standalone website"];
} else {
    console.log("Website link invalid or not submitted.");
}

let firefoxLink;
if (data["Firefox Add-ons"].includes("https://addons.mozilla.org/")) {
    const url = new URL(data["Firefox Add-ons"]);
    firefoxLink = url.origin + url.pathname;
} else {
    console.log("Firefox link invalid or not submitted.");
}

let chromeLink;
if (data["Chrome Web Store"].includes("https://chromewebstore.google.com/detail/")) {
    const url = new URL(data["Chrome Web Store"]);
    chromeLink = url.origin + url.pathname;
} else {
    console.log("Chrome link invalid or not submitted.");
}

let safariLink;
if (data["App Store (Safari)"].includes("https://apps.apple.com/")) {
    const url = new URL(data["App Store (Safari)"]);
    safariLink = url.origin + url.pathname;    
} else {
    console.log("Safari link invalid or not submitted.");
}

// Dates and stars
const dateAdded = Date.now();
let dateUpdated;
let starCount;

async function getREST(url, platform) {
    try {
        const response = await fetch(url);
        if (response.status === 404) {
            throw new Error("Error: Invalid URL");
        }

        if (!response.ok) throw new Error("Error fetching release data");

        const data = await response.json();
        let stars = "";
        let lastUpdated = "";

        switch(platform) {
            case "github":
                stars = data.stargazers_count;
                lastUpdated = Date.parse(data.pushed_at);
                break;
            case "codeberg":
                stars = data.stars_count;
                lastUpdated = Date.parse(data.updated_at);
                break;
            case "gitlab":
                stars = data.star_count;
                lastUpdated = Date.parse(data.last_activity_at);
                break;
            case "firefox": 
                stars = null;
                lastUpdated = Date.parse(data.last_updated);
                break;
            case "safari":
                stars = null;
                lastUpdated = Date.parse(data.results?.[0].currentVersionReleaseDate);
                break;
        }

        return [stars, lastUpdated]
         
    } catch (error) {
        console.error("Error:", error);
        return [null, null];
    }
}                         

async function getChromeREST(url) {
    try {

        const response = await fetch(url, {
            headers: {
                "accept": "application/json",
                "x-api-key": chromeStatsKey
            }
        });

        if (response.status === 404) {
            throw new Error("Invalid URL (404)");
        }

        if (!response.ok) throw new Error(`Error fetching release data: ${response.status}`);

        const data = await response.json();

        return Date.parse(data.lastUpdate) || null;
         
    } catch (error) {
        console.error("Error:", error);
        return null;
    }
}                


if (gitLink && gitLink.includes("github.com") || gitLink.includes("codeberg.org") || gitLink.includes("gitlab.com") ) {
    const url = new URL(gitLink);
    const urlPath = url.pathname.slice(1);

    let urlPart = "";
    let endpoint = "";
    let data = [];


    switch(url.hostname) {
        case "github.com" :
            urlPart = "repos/" + urlPath;
            endpoint = new URL(
                urlPart,
                "https://api.github.com/"
            ).href;

            data = await getREST(endpoint, "github");
            if (data[0]) {starCount = data[0]};
            if (data[1]) {dateUpdated = data[1]};
            break;
        case "codeberg.org":
            urlPart = "api/v1/repos/" + urlPath;
            endpoint = new URL(
                urlPart,
                "https://codeberg.org/"
            ).href;

            data = await getREST(endpoint, "codeberg");
            if (data[0]) {starCount = data[0]};
            if (data[1]) {dateUpdated = data[1]};
            break;
        case "gitlab.com":
            urlPart = "api/v4/projects/" + encodeURIComponent(urlPath);
            endpoint = new URL(
                urlPart,
                "https://gitlab.com/"
            ).href;

            data = await getREST(endpoint, "gitlab");
            if (data[0]) {starCount = data[0]};
            if (data[1]) {dateUpdated = data[1]};
            break;
        default:
            console.error("Unidentified source hostname");
    }
} else if (firefoxLink) {
    const url = new URL(firefoxLink);
    const pathname = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
    const segments = pathname.split("/")
    const urlPath = segments[segments.length - 1];
    urlPart = "api/v5/addons/addon/" + urlPath;
    endpoint = new URL(
        urlPart,
        "https://addons.mozilla.org/"
    ).href;

    data = await getREST(endpoint, "firefox");
    if (data) {dateUpdated = data;}

} else if (safariLink) { 
    const url = new URL(safariLink);
    const pathname = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
    const segments = pathname.split("/")
    const urlPath = segments[segments.length - 1].slice(2);
    urlPart = "lookup?id=" + urlPath;
    endpoint = new URL(
        urlPart,
        "https://itunes.apple.com/"
    ).href;
    data = await getREST(endpoint, "safari");
    if (data) {dateUpdated = data;}

} else if (chromeLink) {
    const url = new URL(chromeLink);
    const pathname = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
    const segments = pathname.split("/")
    const urlPath = segments[segments.length - 1];
    urlPart = "api/detail?id=" + urlPath;
    endpoint = new URL(
        urlPart,
        "https://chrome-stats.com/"
    ).href

    data = await getChromeREST(endpoint);
    if (data) {dateUpdated = data;}
} else if (gitLink){
    console.error("Unidentified source hostname");
} else {
    console.error("No parsable links in submission", title)
}

// Assemble JSON
const newJSONObject = {
    "title": title,
    "description": description,
    "image": {
        "src": imageFilePath
    },
    "tags": tags,
    "dateAdded": dateAdded,
    "proprietary": proprietary
}

if (dateUpdated) newJSONObject.dateUpdated = dateUpdated;
if (gitLink) newJSONObject.gitLink = gitLink;
if (firefoxLink) newJSONObject.firefoxLink = firefoxLink;
if (chromeLink) newJSONObject.chromeLink = chromeLink;
if (websiteLink) newJSONObject.websiteLink = websiteLink;
if (safariLink) newJSONObject.safariLink = safariLink;
if (typeof starCount === 'number') newJSONObject.stars = starCount;

// Create file
function createFile() {
    while (true) {
        const outputName = fileName + ".json";
        const filePath = path.resolve(targetDir, outputName);

        if (!fs.existsSync(filePath)) {
            return filePath;
        }
    }
}

const confirmedFilePath = createFile(newJSONObject);
fs.writeFileSync(confirmedFilePath, JSON.stringify(newJSONObject, null, 2));