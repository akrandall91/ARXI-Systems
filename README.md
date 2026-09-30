# ARXI Systems

Product site for ARXI Systems (arxisystems.com): displays, lighting, NFC tap products, personalized lithophanes and smart-home devices. Built from the former MadeParticular site; the services side of the business lives at akrandall.com (AKRD).

## Pages

- `index.html` home · `products.html` catalog with Available / Custom / Lab status · `tap.html` Tap (NFC) category
- `tap-mini.html` Tap Mini with Square checkout · `nfc-stand.html` tap stand configurator · `memory-light.html`
- `order.html` custom order builder (lithophanes, lightboxes, matrices, layered art) · `what-you-get.html` options guide
- `for-business.html` · `lab.html` · `about.html` · `gallery.html` · `faq.html` · `contact.html` (custom quote) · `thanks.html` (after payment)
- `agencies.html`, `manufacturers.html`, `arxi-systems.html` redirect to the home page (the old transit site is archived).

Shared styles for the new pages are in `arxi.css`. Older pages keep their own inline styles.

## Checkout

`api/create-checkout.js` is a Vercel serverless function that creates Square payment links for the order builder, tap stands and Tap Mini. Checkout only works when the site is deployed on Vercel with these environment variables (see `.env.example`):

- `SQUARE_ACCESS_TOKEN`
- `SQUARE_LOCATION_ID`
- `SITE_URL` = `https://arxisystems.com`

Point the arxisystems.com domain at the Vercel project. Also update the business name in Square so checkout pages and receipts say ARXI Systems.

## Preview locally

`python -m http.server 8791` (checkout needs Vercel).
