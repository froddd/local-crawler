#!/usr/bin/env node

import fs from 'fs';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const args = yargs(hideBin(process.argv))
    .command('$0 <domain>', 'Crawl all urls from a given website')
    .positional('domain', {
        describe: 'Domain to crawl. Include the port number if needed.',
        type: 'string'
    })
    .option('b', {
        alias: 'base-path',
        default: '/',
        describe: 'Base path the crawling should be restricted to.',
        type: 'string'
    })
    .option('e', {
        alias: 'exclude-path',
        default: null,
        describe: 'Exclude path from the crawling.',
        type: 'array'
    })
    .option('f', {
        alias: 'from-file',
        default: null,
        describe: 'Use JSON file as source of URLs to check. The JSON should represent an array of paths that will be appended to the domain and base path, if any.',
        type: 'string'
    })
    .option('q', {
        alias: 'query-string-ignore',
        default: false,
        describe: 'Strip query strings from found URLs',
        type: 'boolean'
    })
    .help()
    .argv;

const baseDomain = args.domain.replace(/\/$/, '');
const basePath = args.basePath;
const baseUrl = baseDomain + basePath;
const excludePaths = args.excludePath.filter(x => !!x).map(path => baseDomain + path);
const fromFile = args.fromFile;

const now = new Date().toISOString().substr(0,19).replace(/\D/g, '');
const outputFileName = baseUrl
    .replace(/https?:\/\//, '')
    .replace(/\W+/g, '-')
    .replace(/(^\W+|\W+$)/, '');
const outputFile = `./reports/${now}-${outputFileName}.json`;

let pages = [];

const listUrlsOnPage = async pageUrl => {
    const useUrl = args.queryStringIgnore ? pageUrl.split('?')[0] : pageUrl;

    if (pages.find(page => page.url === useUrl)) {
        return;
    }

    process.stdout.write(useUrl);

    const response = await fetch(useUrl, {
        redirect: 'manual',
    });

    const page = {
        url: useUrl,
        status: response.status
    }

    if (response.status === 301 || response.status === 302) {
        console.log(`\u001b[33;1m ${response.status} Redirect\u001b[0m`);

        const redirectTo = response.headers.get("Location");
        page.location = redirectTo;

        const followedResponse = await fetch(useUrl);
        page.finalLocation = followedResponse.url;

        pages.push(page);

        return await listUrlsOnPage(redirectTo);
    }

    pages.push(page);

    if (response.status === 200) {
        console.log(`\u001b[32;1m ${response.status} OK\u001b[0m`);
        if (!fromFile) {
            const body = await response.text();
            const jsdom = new JSDOM(body);
            const links = jsdom.window.document.querySelectorAll('a');

            for (const link of links) {
                let href = link.getAttribute('href');

                if (href.startsWith(basePath)) {
                    href = baseDomain + href;
                }

                if (href.startsWith(baseUrl) && !excludePaths.some(path => href.startsWith(path))) {
                    await listUrlsOnPage(href);
                }
            }
        }
    } else {
        console.log(`\u001b[31;1m ${response.status} ERROR\u001b[0m`);
    }
}

(async() => {
    if (fromFile) {
        let file;

        try {
            file = fs.readFileSync(fromFile, {encoding: "utf8"});
        }
        catch(e) {
            console.error(`File not found: ${fromFile}`);
            process.exit(1);
        }

        const urls = JSON.parse(file);
        console.log(`Checking ${urls.length} URL${urls.length !== 1 ? 's' : ''} from ${fromFile}`);
        console.log(`------------------------`);
        for (const url of urls) {
            await listUrlsOnPage(`${baseUrl}${url.replace(/^\//, '')}`);
        }
    } else {
        console.log(`Crawling from ${baseUrl}`);
        console.log(`------------------------`);
        await listUrlsOnPage(baseUrl);
    }

    pages.sort((a, b) => a.url > b.url ? 1 : -1);

    fs.mkdirSync('./reports', {recursive: true});
    fs.writeFileSync(outputFile, JSON.stringify(pages, null, 2));

    console.log(`------------------------`);
    console.log(`${pages.length} page${pages.length !== 1 ? 's' : ''} found.`);
    console.log(`Results written to ${outputFile}`);
})();

