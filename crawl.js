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
    .option('c', {
        alias: 'cache',
        default: false,
        describe: 'Force rebuild of cache file',
        type: 'boolean'
    })
    .option('f', {
        alias: 'from-file',
        default: null,
        describe: 'Use JSON file as source of URLs to check. The JSON should represent an array of paths that will be appended to the domain and base path, if any.',
        type: 'string'
    })
    .help()
    .argv;

const baseDomain = args.domain.replace(/\/$/, '');
const basePath = args.basePath;
const baseUrl = baseDomain + basePath;
const excludePaths = args.excludePath.map(path => baseDomain + path);
const forceCacheRebuild = args.cache;
const cacheFileName = baseUrl
    .replace(/https?:\/\//, '')
    .replace(/\W+/g, '-')
    .replace(/(^\W+|\W+$)/, '');
const cacheFile = `./.cache/${cacheFileName}.json`;
const fromFile = args.fromFile;

let pages = [];
let fromCache = 0;

if (forceCacheRebuild) {
    console.log('Forcing cache rebuild');
} else if (fs.existsSync(cacheFile)) {
    pages = JSON.parse(fs.readFileSync(cacheFile, {encoding: "utf8"}));
    fromCache = pages.length;
    console.log(`Found cache file: loading ${fromCache} urls.`);
}

const listUrlsOnPage = async pageUrl => {
    if (pages.find(page => page.url === pageUrl)) {
        return;
    }

    process.stdout.write(`Fetching ${pageUrl} ...`);

    const response = await fetch(pageUrl, {
        redirect: 'manual',
    });

    const page = {
        url: pageUrl,
        status: response.status
    }

    if (response.status === 301 || response.status === 302) {
        console.log(`\u001b[33;1m ${response.status} Redirect\u001b[0m`);
        const redirectTo = response.headers.get("Location");
        page.location = redirectTo;
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
        for (const url of urls) {
            await listUrlsOnPage(`${baseUrl}${url.replace(/^\//, '')}`);
        }
    } else {
        await listUrlsOnPage(baseUrl);
    }

    pages.sort((a, b) => a.url > b.url ? 1 : -1);

    fs.mkdirSync('./.cache', {recursive: true});
    fs.writeFileSync(cacheFile, JSON.stringify(pages, null, 2));

    console.log('\n-------------------');
    console.log(`Loaded from cache: ${fromCache}`);
    console.log(`New pages: ${pages.length - fromCache}`);
    console.log(`Results written to ${cacheFile}`);
})();

