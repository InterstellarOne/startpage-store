import fs from "fs";
import path from "path";

const targetDir = "src/content/startpages";
const data = JSON.parse(process.env.parsed_data);
const chromeStatsKey = process.env.CHROME_STATS_API_KEY;

if (!data) console.error(`Data from issue ${process.env.issue_number} failed to parse`);

// Title and Description
const title = data["Title"];
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
const screenshots = data["Cover screenshot"];
const screenshot = screenshots.match(/\(.*?\)/);
if (screenshots.includes("\n")) console.log("Multiple screenshots were uploaded so only the first one has been added.");

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
    firefoxLink = data["Firefox Add-ons"];
} else {
    console.log("Firefox link invalid or not submitted.");
}

let chromeLink;
if (data["Chrome Web Store"].includes("https://chromewebstore.google.com/detail/")) {
    chromeLink = data["Chrome Web Store"];
} else {
    console.log("Chrome link invalid or not submitted.");
}

let safariLink;
if (data["App Store (Safari)"].includes("https://apps.apple.com/")) {
    safariLink = data["App Store (Safari)"];
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
firefoxLink
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
    )

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
        "src": screenshot
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
if (typeof stars === 'number') newJSONObject.stars = stars;

function createFile(data) {
    while (true) {
        const fileName = format(title.toLowerCase()) + (Math.floor(Math.random() * 9000) + 1000) + ".json";
        const filePath = path.resolve(targetDir, fileName);

        if (!fs.existsSync(filePath)) {
            return filePath;
        }
    }
}

confirmedFilePath = createFile(newJSONObject);
fs.writeFileSync(confirmedFilePath, JSON.stringify(newJSONObject, null, 2));