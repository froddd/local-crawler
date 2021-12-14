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
    .help()
    .argv;

const baseDomain = args.domain.replace(/\/$/, '');
const basePath = args.basePath;
const baseUrl = baseDomain + basePath;
const excludePaths = args.excludePath.map(path => baseDomain + path);
const cacheFileName = baseUrl
    .replace(/https?:\/\//, '')
    .replace(/\W+/g, '-')
    .replace(/(^\W+|\W+$)/, '');
const cacheFile = `./.cache/${cacheFileName}.json`;

let pages = [];
let fromCache = 0;

if (fs.existsSync(cacheFile)) {
    pages = JSON.parse(fs.readFileSync(cacheFile, {encoding: "utf8"}));
    fromCache = pages.length;
    console.log(`Found cache file: loading ${fromCache} urls.`);
}

const listUrlsOnPage = async pageUrl => {
    if (pages.find(page => page.url === pageUrl)) {
        return;
    }

    process.stdout.write(`Fetching ${pageUrl} ...`);

    const response = await fetch(pageUrl);

    const page = {
        url: pageUrl,
        status: response.status
    }

    if (response.status === 301 || response.status === 302) {
        console.log(` ${response.status} Redirect`);
        page.location = response.url;
        pages.push(page);
        return await listUrlsOnPage(response.url);
    }

    pages.push(page);

    if (response.status === 200) {
        console.log(` ${response.status} OK`);
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
    } else {
        console.log(` ${response.status} ERROR`);
    }
}

(async() => {
    await listUrlsOnPage(baseUrl);

    pages.sort((a, b) => a.url > b.url ? 1 : -1);

    fs.mkdirSync('./.cache', {recursive: true});
    fs.writeFileSync(cacheFile, JSON.stringify(pages, null, 2));

    console.log('\n-------------------');
    console.log(`Loaded from cache: ${fromCache}`);
    console.log(`New pages: ${pages.length - fromCache}`);
    console.log(`Results written to ${cacheFile}`);
})();

