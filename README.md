# Frame

Frame is a simple tool for adding borders and blur to images. Everything runs in your browser.

To use it, head to [frame.spoons.fyi](https://frame.spoons.fyi). There, you will also find an About section with more information on how to use it.

## Development

The site is static files in `docs/`, served by Cloudflare Workers (static assets). To run it locally:

```sh
npx wrangler dev
```

The pages use the [Brutalist](https://brutalist.spoons.fyi/) stylesheet. `docs/css/brutalist.css` is a copy of it, so update it by copying the new version over it. Frame's own rules are in `docs/css/site.css`, inside the cascade layers that the stylesheet declares. The icon in the browser tab is linked from [Favicons](https://favicons.spoons.fyi/).

The script is in `docs/js/`. `app.js` runs the page, and `frame.js` reads an image and draws it into its frame. For a ZIP file, a few workers (`worker.js`) frame the images side by side and write each PNG with `png.js`, and `zip.js` packs the archive. Only the image on screen is held in memory, so the number of images is not limited by it.

Two libraries are served from `docs/js/vendor/`, so that the site makes no requests to a CDN: [StackBlur](https://github.com/flozz/StackBlur) 2.7.0 and [heic2any](https://github.com/alexcorvi/heic2any) 0.0.4. Both are under the MIT license, and heic2any includes libheif under the LGPL 3.0.

Deploys run on Cloudflare Workers Builds through the Cloudflare GitHub app: every push to `main` deploys to production. No secrets are stored in this repository.
