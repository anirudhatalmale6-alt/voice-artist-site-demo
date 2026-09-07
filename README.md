# Jarred Thornhill — Voice Actor

A single-page, fully responsive site for Jarred Thornhill, an American voice
actor based in St. Louis, Missouri.

## What's in it

- Hero with a live canvas waveform that reacts to the audio being played
- Demo-reel players with real decoded waveforms, click/drag to scrub,
  one-at-a-time playback, download links
- About section
- Testimonial
- Booking form with client-side validation
- Mobile nav, scroll reveals, reduced-motion support

## Stack

Static HTML, CSS and vanilla JS. No build step, no dependencies, no framework.
Drops onto any host — including plain shared hosting — as-is.

## Files

    index.html      markup
    styles.css      all styling
    app.js          players, waveform rendering, form, nav
    audio/          demo reels
    images/         portrait

## Swapping in real content

- Reels: add files to `audio/`, then add an entry to the `REELS` array at the
  top of `app.js` (title, tag, description, filename).
- Copy: all text lives in `index.html`.
- Colours and type: the variables at the top of `styles.css`.
