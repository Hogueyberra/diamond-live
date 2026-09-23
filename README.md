# Diamond Live

Clickable Saturday prototype for the **Tustin 10U Hawks**. Switch between Coach Dana, Scorekeeper Priya, Videographer Chris, and Parent Jordan, then put a six-inning game in the book. **Reset Saturday** restores the morning of September 26 at Tustin Sports Park.

- Repository: https://github.com/Hogueyberra/diamond-live
- Live site: https://hogueyberra.github.io/diamond-live/

## Run locally

```bash
npm i && npm run dev
```

The dev server uses base path `/`. A production build defaults to `/diamond-live/` so a GitHub Pages project site can load assets and routes. Set `VITE_BASE_PATH` to override that.

```bash
npm test
npm run build
```

The build copies `dist/index.html` to `dist/404.html`, so a refresh on a deep link such as `/diamond-live/scorebook` still opens the app.

## Routes

- `/` Saturday board for the role you are viewing as
- `/lineup` batting order, positions, and who has arrived
- `/scorebook` count, diamond, and the inning tape
- `/film` Chris's shot list
- `/family` Jordan's arrival, orange slices, and a text for the group thread
