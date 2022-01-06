# Simple site crawler

Can be used to check all relative site links found on a given site.

## Installation

Install dependencies and create binary link:

```shell
$ npm install -g
```

## How to run

To crawl all links from the site at http://localhost:3000, run:

```shell
$ local-crawler http://localhost:3000
```

A minimal report is saved as JSON in the `.cache` directory. This lists all found URLs and their status code.

### Options

#### `--help`

Show the help page.

#### `--base-path`/`-b`

Base path the crawling should be restricted to. For instance, providing `/foo/` when crawling `http://localhost` will only crawl links that start with `/foo/` or `http://localhost/foo/`. Defaults to `/`, which will crawl all links for the given domain. 

```shell
$ local-crawler http://localhost -b /foo/
```

#### `--exclude-path`/`-e`

Exclude given path(s) from the crawling.

```shell
$ local-crawler http://localhost -e /do-not-crawl/ -e /profile/
```

