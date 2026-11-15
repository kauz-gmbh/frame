# Frame

Frame is a simple tool for adding borders to images without cropping. Everything runs in your browser.

To use it, head to [frame.spoons.fyi](https://frame.spoons.fyi). There, you will also find an About section with more information on how to use it.

## Development

The site is static files in `docs/`, served by Cloudflare Workers (static assets). To run it locally:

```sh
npx wrangler dev
```

Deploys run on Cloudflare Workers Builds through the Cloudflare GitHub app: every push to `main` deploys to production. No secrets are stored in this repository.
