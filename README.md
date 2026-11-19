# FSAE 2027 Rules Reader

An unofficial, searchable Formula SAE rules reader inspired by the navigation of FRCManual.com. It uses Markdown from [ppmend/FSAE_RULES_2027](https://github.com/ppmend/FSAE_RULES_2027). The official SAE documents always prevail.

## Features

- Combustion, electric, and all-section views. Shared sections appear in both vehicle views.
- Rulebook and alphabetical section sorting, full-text search, and an on-page outline.
- Clickable rule citations with a right-side quick reference showing the cited rule text and a link to its full section.
- An **Update rules** button that accepts a public GitHub repository URL, checks its latest commit, and loads its `FSAE_Rules_*` and `FSAE_Driverless_*` Markdown files. Updates are stored in this browser using IndexedDB; the published snapshot remains available as a fallback.
- Static files suitable for GitHub Pages. No server or API key is required.

## Local preview

Run `npx serve .` or any static HTTP server from this directory. Opening `index.html` directly from the file system will not load `data.json` in most browsers.

## Refresh the published snapshot

Clone or update the source repository, then run `node build-data.mjs path/to/FSAE_RULES_2027`. Commit the new `data.json` and publish.

This project is unaffiliated with SAE International or the University of Texas at Austin. “Longhorn Racing” is used as a subtle visual theme; no official team branding is claimed.
