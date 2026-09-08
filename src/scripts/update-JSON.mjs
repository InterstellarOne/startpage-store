import fs from "fs";
import path from "path";

const targetDir = "src/content/startpages";
const chromeStatsKey = process.env.CHROME_STATS;

const files = fs.readdirSync(targetDir);           

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
                stars = 0;
                lastUpdated = Date.parse(data.last_updated);
        }

        return [stars, lastUpdated]
         
    } catch (error) {
        console.error("Error:", error);
        return [0, 0];
    }
}                

async function getChromeREST(url) {
    try {

        const response = await fetch(url, {
            headers: {
                "accept": "application/json",
                "x-api-key": process.env.CHROME_STATS
            }
        });

        if (response.status === 404) {
            throw new Error("Invalid URL (404)");
        }

        if (!response.ok) throw new Error(`Error fetching release data: ${response.status}`);

        const data = await response.json();
        console.log("Test", data.title);

        return Date.parse(data.lastUpdate) || 0;
         
    } catch (error) {
        console.error("Error:", error);
        return [0, 0];
    }
}                

for (const file of files) {
    const filePath = path.resolve(targetDir, file);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const content = JSON.parse(fileContent);

    const curDate = content.dateUpdated;
    const curStars = content.stars;

    let newDate = 0;
    let newStars = 0;
    let urlPart = "";
    let endpoint = "";
    let data = [];

    if (content.gitLink) {
        const url = new URL(content.gitLink);
        const urlPath = url.pathname.slice(1);

        switch(url.hostname) {
            case "github.com" :
                urlPart = "repos/" + urlPath;
                endpoint = new URL(
                    urlPart,
                    "https://api.github.com/"
                ).href;

                data = await getREST(endpoint, "github");
                newStars = data[0];
                newDate = data[1];

                break;
            case "codeberg.org":
                urlPart = "api/v1/repos/" + urlPath;
                endpoint = new URL(
                    urlPart,
                    "https://codeberg.org/"
                ).href;

                data = await getREST(endpoint, "codeberg");
                newStars = data[0];
                newDate = data[1];

                break;
            case "gitlab.com":
                urlPart = "api/v4/projects/" + encodeURIComponent(urlPath);
                endpoint = new URL(
                    urlPart,
                    "https://gitlab.com/"
                ).href;

                data = await getREST(endpoint, "gitlab");
                newStars = data[0];
                newDate = data[1];
                
                break;
            default:
                console.error("Unidentified hostname");
        }
    } else if (content.firefoxLink) {
        const url = new URL(content.firefoxLink);
        const segments = url.pathname.split("/")
        const urlPath = segments[segments.length - 1];
        urlPart = "api/v5/addons/addon/" + urlPath;
        endpoint = new URL(
            urlPart,
            "https://addons.mozilla.org/"
        ).href;

        data = await getREST(endpoint, "firefox");
        newDate = data[1];

    } else if (content.chromeLink) {
        const url = new URL(content.chromeLink);
        const segments = url.pathname.split("/")
        const urlPath = segments[segments.length - 1];
        urlPart = "api/detail?id="
        endpoint = new URL(
            urlPart,
            "https://chrome-stats.com/"
        )

        newDate = await getChromeREST(endpoint);
    }

    if (newStars > curStars && content.stars !== undefined) {
        content.stars = newStars;
        console.log("Updated star count of", content.title)
    } else if (content.stars == undefined){
        console.log("No star attribute found for", content.title)
    }

    if (newDate > curDate) {
        content.dateUpdated = newDate;
        console.log("Updated date of", content.title);
    }

    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
}        