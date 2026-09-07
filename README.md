# Voice Actor Website — demo build

A single-page, fully responsive site for a professional voice actor.
Everything here is placeholder content built for client review.

## What's in it

- Hero with a live canvas waveform that reacts to the audio being played
- Five demo-reel players with real decoded waveforms, click/drag to scrub,
  one-at-a-time playback, download links
- About section with a spec table (booth, mic, DAW, delivery)
- Testimonial cards
- Booking form with client-side validation
- Mobile nav, scroll reveals, reduced-motion support

## Stack

Static HTML, CSS and vanilla JS. No build step, no dependencies, no framework.
Drops onto any host — including plain shared hosting — as-is.

## Files

    index.html      markup
    styles.css      all styling
    app.js          players, waveform rendering, form, nav
    audio/          placeholder reels (synthesised, not real voice work)
    images/         placeholder portrait illustration

## Swapping in real content

- Reels: replace the files in `audio/`, then edit the `REELS` array at the top
  of `app.js` (title, tag, description, filename).
- Copy: all text lives in `index.html`. Placeholder passages are wrapped in
  `<span class="ph">`.
- Colours and type: the variables at the top of `styles.css`.
