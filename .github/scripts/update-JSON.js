const fs = require("fs");
const path = require("path");
const targetDir = "/src/content/startpages";

const files = fs.readdirSync(targetDir);                               

for (const file of files) {
    const filePath = path.resolve(targetDir, file);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const content = JSON.parse(fileContent);

    const curDate = content.dateUpdated;
    const curStars = content.stars;
    const owner = "";
    const project = "";

    if (content.gitLink) {
        const url = new URL(content.gitLink);
        const segments = url.pathname.split("/");

        switch(url.hostname) {
            case "github.com" :
            case "codeberg.org":
            owner = segments[0];
            project = segments[1];
            break;
            case "gitlab.com":
            
            break;
            default:
            throw new Error("Unidentified hostname");
        }
    } else if (content.firefoxLink) {
        const url = new URL(content.firefoxLink);
        const segments = url.pathname.split("/");

    } else if (content.chromeLink) {
        const url = new URL(content.chromeLink);
        const segments = url.pathname.split("/");
    }

    content.stars = (newStars > curStars) ? newStars : curStars;
    content.dateUpdated = (newDate > curDate) ? newDate : curDate;

    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
}