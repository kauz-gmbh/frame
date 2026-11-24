# Frame

Frame is a simple tool for adding borders, a blurred background, and frame styles with the camera data to images. Everything runs in your browser.

To use it, head to [frame.spoons.fyi](https://frame.spoons.fyi). There, you will also find an About section with more information on how to use it.

## Development

The site is static files in `docs/`, served by Cloudflare Workers (static assets). To run it locally:

```sh
npx wrangler dev
```

The pages use the [Brutalist](https://brutalist.spoons.fyi/) stylesheet. `docs/css/brutalist.css` is a copy of it, so update it by copying the new version over it. Frame's own rules are in `docs/css/site.css`, inside the cascade layers that the stylesheet declares. The icon in the browser tab is linked from [Favicons](https://favicons.spoons.fyi/).

The script is in `docs/js/`. `app.js` runs the page, and `frame.js` reads an image and draws it into its frame. The preset styles are in `styles.js`, as margins, colors, and lines of text that `frame.js` draws at the size of each photo, so there are no template images. `exif.js` reads the camera data for that text from JPEG and HEIC files. `gallery.js` draws each style on a sample image for the About page, with the same code. The sample images are in `docs/about/samples/`. They are CC0 images from Wikimedia Commons, and the licenses page names their authors. For a ZIP file, a few workers (`worker.js`) frame the images side by side and write each PNG with `png.js`, and `zip.js` packs the archive. Only the image on screen is held in memory, so the number of images is not limited by it.

Two libraries are served from `docs/js/vendor/`, so that the site makes no requests to a CDN: [StackBlur](https://github.com/flozz/StackBlur) 2.7.0, under the MIT license, and [heic-to](https://github.com/hoppergee/heic-to) 1.6.7, under the LGPL 3.0. heic-to includes libheif 1.23.7, also under the LGPL 3.0, and its file is the `csp` build of the package, which needs no `eval`. `docs/licenses/` has the texts of the LGPL and the GPL, and the page there says where the source of the converter is and how to replace it, as the LGPL asks.

The text of the styles is set in five typefaces from `docs/fonts/`: [Inter](https://rsms.me/inter/), [IBM Plex Mono](https://github.com/IBM/plex), [Barlow Condensed](https://github.com/jpt/barlow), [Caveat](https://github.com/googlefonts/caveat), and [DSEG](https://github.com/keshikan/DSEG). A style loads only the ones that its text needs. The first four are the Latin subsets from the [Fontsource](https://fontsource.org/) packages, version 5.3.0, and DSEG is the DSEG7 Classic Bold file from the [dseg](https://www.npmjs.com/package/dseg) package, version 0.46.0. All are under the SIL Open Font License 1.1, and each license is next to its files.

Deploys run on Cloudflare Workers Builds through the Cloudflare GitHub app: every push to `main` deploys to production. No secrets are stored in this repository.
