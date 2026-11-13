# Bardfall

> Shakespeare's verses, forever falling.

A small web page where famous lines from Shakespeare's plays drift down the screen. Select a verse to see who says it, in which play, and in which act and scene.

**Live site:** https://bardfall.pages.dev/

No build step, no dependencies: plain HTML, CSS and JavaScript.

## Features

- 60 verses from 19 plays, each with character, play and act/scene.
- The layout adapts to the screen: one column on phones, two on a 1080p monitor, three on a 2K monitor, and more on wider screens.
- Select a verse to read its source. Click, tap or press `Esc` to return.
- Playback controls: pause, verse size and falling speed.
- Size and speed are remembered between visits.
- Respects the "reduce motion" setting: the verses start paused.

## Controls

| Control | Button | Keyboard |
| --- | --- | --- |
| Pause / resume | **Pause** | `Space` |
| Verse size | **Size − / +** | `−` / `+` |
| Falling speed | **Speed − / +** | `↓` / `↑` |
| Close an open verse | click or tap anywhere | `Esc` |

Size and speed each have 5 steps (size from 80% to 130%, speed from 0.4× to 2×).

## Project structure

```
bardfall/
├── index.html           Page structure (header, controls, verse popup)
├── style.css            All styles, grouped by component
├── script.js            Animation, layout, controls and popup
├── quotes.js            The verses (one per line)
├── sitemap.xml          Page list for search engines
├── robots.txt           Crawler rules and sitemap location
├── favicon.png          Icon, 192 px
├── favicon-32.png       Icon for browser tabs
├── favicon.ico          Icon for older browsers (16, 32 and 48 px)
└── apple-touch-icon.png Icon for the iPhone home screen
```

## Run locally

Open `index.html` in a browser. To serve it the way a static host does:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Adding or editing verses

Open `quotes.js` and add a line to the `QUOTES` list in the same format:

```js
{ text: "Ripeness is all.", character: "Edgar", play: "King Lear", act: "Act 5, Scene 2" },
```

Keep each verse on its own line, and don't repeat a text that is already in the list.

## Customizing

Everything adjustable lives in the `CONFIG` block at the top of `script.js`: breakpoints, pixels per column, font sizes, text width, speed and opacity ranges, and the size and speed steps. Colors and fonts are in `style.css`, with the color variables at the top of the file.

## Deploy with Cloudflare Pages

1. Push the files to the `main` branch.
2. In the Cloudflare dashboard, create a Pages project from the Git repository (**Workers & Pages → Create → Pages → Connect to Git**).
3. Use no framework preset, leave the build command empty and keep the output directory as the repository root.

Every push to `main` publishes a new version. The site is served from the root of its domain (`https://<project>.pages.dev/`), so `robots.txt` and `sitemap.xml` are found by search engines. If the project gets a different address, update the URL in `index.html` (canonical and `og:` tags), `sitemap.xml` and `robots.txt`.

## Credits

- Verses: William Shakespeare (public domain).
- Fonts: [Cinzel](https://fonts.google.com/specimen/Cinzel) and [Playfair Display](https://fonts.google.com/specimen/Playfair+Display), loaded from Google Fonts under the SIL Open Font License.

## License

The code is released under the [MIT License](LICENSE). The verses are by William Shakespeare (public domain).
