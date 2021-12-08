import fs from 'fs';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

const cacheFile = './.cache/pages.json';
const baseDomain = 'http://international.trade.great:8012';
const baseUrlPrefix = '/international/';
const baseUrl = baseDomain + baseUrlPrefix;

let pages = [];
let fromCache = 0;

if (fs.existsSync(cacheFile)) {
    pages = JSON.parse(fs.readFileSync(cacheFile, {encoding: "utf8"}));
    fromCache = pages.length;
}

const listUrlsOnPage = async pageUrl => {
    if (pages.find(page => page.url === pageUrl)) {
        return;
    }

    console.log(`Fetching page ${pageUrl}`);
    const response = await fetch(pageUrl);
    const page = {
        url: pageUrl,
        status: response.status
    }
    if (response.status === 301 || response.status === 302) {
        page.location = response.url;
        pages.push(page);
        return await listUrlsOnPage(response.url);
    }

    pages.push(page);

    if (response.status === 200) {
        const body = await response.text();
        const jsdom = new JSDOM(body);
        const links = jsdom.window.document.querySelectorAll('a');

        for (const link of links) {
            let href = link.getAttribute('href');
            if (href.startsWith(baseUrlPrefix)) {
                href = baseDomain + href;
            }
            if (href.startsWith(baseUrl)) {
                await listUrlsOnPage(href);
            }
        }
    }
}

(async() => {
    await listUrlsOnPage(baseUrl);

    pages.sort((a, b) => a.url > b.url ? 1 : -1);

    fs.mkdirSync('./.cache', {recursive: true});
    fs.writeFileSync(cacheFile, JSON.stringify(pages, null, 2));

    console.log('-------------------');
    console.log(`Loaded from cache: ${fromCache}`);
    console.log(`Found ${pages.length} pages:`);
    pages.forEach(page => console.log(`${page.url} - ${page.status}${page.location ? ` - ${page.location}` : ''}`));
})();

