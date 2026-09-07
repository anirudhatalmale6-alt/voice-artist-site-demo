/* ============================================================
   Voice actor site — demo build
   Waveform players, hero visualiser, reveals, form.
   No libraries: plain Web Audio + canvas.
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── the reels. Swap src/title/tag/desc when the real files land ── */
  var REELS = [
    { id: "commercial", title: "Commercial Reel", tag: "Broadcast",
      desc: "Warm, conversational, brand-led. TV, radio and online spots.",
      src: "audio/commercial.mp3" },
    { id: "narration", title: "Narration & Documentary", tag: "Long form",
      desc: "Measured, low-register storytelling that holds for the full hour.",
      src: "audio/narration.mp3" },
    { id: "character", title: "Character & Animation", tag: "Range",
      desc: "Four voices, one session — hero, sidekick, villain and the small furious one.",
      src: "audio/character.mp3" },
    { id: "elearning", title: "E-learning & Corporate", tag: "Clarity",
      desc: "Even pace, clean diction, consistent across a hundred modules.",
      src: "audio/elearning.mp3" },
    { id: "promo", title: "Promo & Imaging", tag: "Energy",
      desc: "Punchy station imaging and trailer reads with a hard sell that still breathes.",
      src: "audio/promo.mp3" }
  ];

  var BARS = 120;             // peak buckets per waveform
  var ctxAudio = null;        // shared AudioContext, created on first gesture
  var analyser = null;
  var analyserData = null;
  var current = null;         // the player object currently playing
  var players = [];

  function audioCtx() {
    if (!ctxAudio) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctxAudio = new AC();
      analyser = ctxAudio.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.75;
      analyserData = new Uint8Array(analyser.frequencyBinCount);
      analyser.connect(ctxAudio.destination);
    }
    if (ctxAudio.state === "suspended") ctxAudio.resume();
    return ctxAudio;
  }

  function fmt(t) {
    if (!isFinite(t) || t < 0) t = 0;
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  /* Deterministic stand-in peaks, used until the real ones decode
     (and permanently if decoding is blocked). Looks like speech,
     never like a flat line. */
  function fakePeaks(seed) {
    var out = [], x = seed * 9301 + 49297;
    for (var i = 0; i < BARS; i++) {
      x = (x * 9301 + 49297) % 233280;
      var r = x / 233280;
      var phrase = 0.55 + 0.45 * Math.sin(i / 7.5 + seed);
      var breath = (i % 23 < 3) ? 0.12 : 1;      // little gaps between phrases
      out.push(Math.max(0.04, Math.min(1, (0.35 + r * 0.65) * phrase * breath)));
    }
    return out;
  }

  /* Real peaks: fetch, decode, bucket to BARS RMS values. */
  function loadPeaks(p) {
    var ac = window.AudioContext || window.webkitAudioContext;
    if (!ac) return Promise.resolve(null);
    return fetch(p.src)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(function (buf) {
        var AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        var dec = ctxAudio || new (window.AudioContext || window.webkitAudioContext)();
        return new Promise(function (res, rej) {
          // callback form: still the only one Safari reliably honours
          var ret = dec.decodeAudioData(buf, res, rej);
          if (ret && ret.then) ret.then(res, rej);
        });
      })
      .then(function (audioBuf) {
        var ch = audioBuf.getChannelData(0);
        var per = Math.floor(ch.length / BARS), peaks = [], max = 0;
        for (var i = 0; i < BARS; i++) {
          var sum = 0, start = i * per;
          for (var j = 0; j < per; j += 8) { var v = ch[start + j]; sum += v * v; }
          var rms = Math.sqrt(sum / (per / 8));
          peaks.push(rms);
          if (rms > max) max = rms;
        }
        if (max > 0) for (var k = 0; k < peaks.length; k++) peaks[k] = Math.max(0.035, peaks[k] / max);
        (p.set || p).duration = audioBuf.duration;
        return peaks;
      })
      .catch(function () { return null; });
  }

  /* ── draw one waveform ─────────────────────────────────────── */
  function draw(p) {
    var cv = p.canvas, c = cv.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== w * dpr || cv.height !== h * dpr) {
      cv.width = w * dpr; cv.height = h * dpr;
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);

    var peaks = p.peaks, n = peaks.length;
    var gap = 2, bw = Math.max(1.5, (w - gap * (n - 1)) / n);
    var mid = h / 2;
    var prog = p.duration ? (p.el.currentTime / p.duration) : 0;
    var hoverX = p.hoverX;

    for (var i = 0; i < n; i++) {
      var x = i * (bw + gap);
      var amp = peaks[i];
      // a live nudge on the bar under the playhead while it plays
      if (p.playing && analyserData) {
        var d = Math.abs(i / n - prog);
        if (d < 0.03) amp = Math.min(1, amp * (1 + (0.03 - d) * 9));
      }
      var bh = Math.max(2, amp * (h - 6));
      var played = (i / n) <= prog;
      if (played) {
        c.fillStyle = "#e9a23b";
      } else if (hoverX != null && x <= hoverX) {
        c.fillStyle = "rgba(233,162,59,.42)";
      } else {
        c.fillStyle = "rgba(244,238,228,.20)";
      }
      c.fillRect(x, mid - bh / 2, bw, bh);
    }

    // playhead
    if (p.playing || prog > 0) {
      var px = prog * w;
      c.fillStyle = "rgba(255,77,24,.9)";
      c.fillRect(Math.min(px, w - 1), 0, 1.5, h);
    }
  }

  /* ── build the DOM for one player ──────────────────────────── */
  function build(reel, index) {
    var row = document.createElement("article");
    row.className = "player reveal";
    row.innerHTML =
      '<button class="p-btn" type="button" aria-label="Play ' + reel.title + '">' +
        '<span class="spinner" aria-hidden="true"></span>' +
      '</button>' +
      '<div class="p-main">' +
        '<div class="p-top">' +
          '<span class="p-title">' + reel.title + '</span>' +
          '<span class="p-tag">' + reel.tag + '</span>' +
        '</div>' +
        '<p class="p-desc">' + reel.desc + '</p>' +
        '<canvas class="p-wave"></canvas>' +
      '</div>' +
      '<div class="p-side">' +
        '<span class="p-time">0:00 / --:--</span>' +
        '<a class="p-dl" href="' + reel.src + '" download>Download</a>' +
      '</div>';

    var audio = new Audio();
    audio.preload = "metadata";
    audio.src = reel.src;

    var p = {
      id: reel.id, el: audio, row: row,
      btn: row.querySelector(".p-btn"),
      canvas: row.querySelector(".p-wave"),
      time: row.querySelector(".p-time"),
      peaks: fakePeaks(index + 1),
      duration: 0, playing: false, hoverX: null, node: null
    };

    audio.addEventListener("loadedmetadata", function () {
      if (isFinite(audio.duration)) { p.duration = audio.duration; tick(p); }
    });
    audio.addEventListener("timeupdate", function () { if (!p.playing) tick(p); });
    audio.addEventListener("ended", function () {
      p.playing = false; row.classList.remove("is-playing", "is-active");
      audio.currentTime = 0; tick(p); syncHero();
    });
    audio.addEventListener("waiting", function () { row.classList.add("is-loading"); });
    audio.addEventListener("playing", function () { row.classList.remove("is-loading"); });

    p.btn.addEventListener("click", function () { toggle(p); });

    /* click / drag anywhere on the waveform to scrub */
    function seekFromEvent(e) {
      var r = p.canvas.getBoundingClientRect();
      var x = ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) / r.width;
      x = Math.max(0, Math.min(1, x));
      if (p.duration) { audio.currentTime = x * p.duration; tick(p); }
    }
    p.canvas.addEventListener("click", seekFromEvent);
    p.canvas.addEventListener("mousemove", function (e) {
      var r = p.canvas.getBoundingClientRect();
      p.hoverX = e.clientX - r.left;
      if (!p.playing) draw(p);
    });
    p.canvas.addEventListener("mouseleave", function () {
      p.hoverX = null; if (!p.playing) draw(p);
    });
    var dragging = false;
    p.canvas.addEventListener("pointerdown", function (e) {
      dragging = true; p.canvas.setPointerCapture(e.pointerId); seekFromEvent(e);
    });
    p.canvas.addEventListener("pointermove", function (e) { if (dragging) seekFromEvent(e); });
    p.canvas.addEventListener("pointerup", function () { dragging = false; });

    return p;
  }

  function tick(p) {
    p.time.textContent = fmt(p.el.currentTime) + " / " + (p.duration ? fmt(p.duration) : "--:--");
    draw(p);
  }

  function connect(p) {
    if (p.node || !audioCtx()) return;
    try {
      p.node = ctxAudio.createMediaElementSource(p.el);
      p.node.connect(analyser);
    } catch (err) { p.node = null; }   // fall back to plain playback
  }

  function toggle(p) {
    if (p.playing) { p.el.pause(); p.playing = false; p.row.classList.remove("is-playing"); syncHero(); return; }
    players.forEach(function (o) {
      if (o !== p && o.playing) { o.el.pause(); o.playing = false; o.row.classList.remove("is-playing", "is-active"); }
    });
    connect(p);
    p.row.classList.add("is-loading");
    var pr = p.el.play();
    if (pr && pr.catch) pr.catch(function () { p.row.classList.remove("is-loading"); });
    p.playing = true; current = p;
    p.row.classList.add("is-playing", "is-active");
    syncHero();
  }

  /* ── render loop: only runs while something is playing ─────── */
  var rafId = null;
  function loop() {
    var any = false;
    for (var i = 0; i < players.length; i++) {
      if (players[i].playing) { any = true; tick(players[i]); }
    }
    drawHero();
    rafId = requestAnimationFrame(loop);
    if (!any && !heroNeedsFrames()) { cancelAnimationFrame(rafId); rafId = null; }
  }
  function ensureLoop() { if (rafId == null) rafId = requestAnimationFrame(loop); }

  /* ── hero visualiser ───────────────────────────────────────── */
  var heroCv = document.getElementById("heroWave");
  var heroPhase = 0;
  var heroVisible = true;
  if (heroCv && "IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      heroVisible = es[0].isIntersecting;
      if (heroVisible) ensureLoop();
    }, { threshold: 0 }).observe(heroCv);
  }
  // idle animation only costs frames while the hero is actually on screen
  function heroNeedsFrames() { return !reduceMotion && heroVisible; }
  function drawHero() {
    if (!heroCv) return;
    var c = heroCv.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = heroCv.clientWidth, h = heroCv.clientHeight;
    if (!w || !h) return;
    if (heroCv.width !== w * dpr || heroCv.height !== h * dpr) {
      heroCv.width = w * dpr; heroCv.height = h * dpr;
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);

    var live = current && current.playing && analyser;
    if (live) analyser.getByteFrequencyData(analyserData);
    heroPhase += live ? 0.05 : 0.014;

    var lines = [
      { y: h * 0.62, amp: h * 0.20, col: "rgba(233,162,59,", wid: 1.6, sp: 1.0 },
      { y: h * 0.68, amp: h * 0.13, col: "rgba(255,77,24,",  wid: 1.1, sp: 1.7 },
      { y: h * 0.74, amp: h * 0.08, col: "rgba(244,238,228,", wid: 0.9, sp: 0.6 }
    ];

    for (var l = 0; l < lines.length; l++) {
      var L = lines[l];
      c.beginPath();
      for (var x = 0; x <= w; x += 4) {
        var t = x / w;
        var energy = 1;
        if (live) {
          var bin = Math.floor(t * (analyserData.length * 0.55));
          energy = 0.35 + (analyserData[bin] / 255) * 2.1;
        }
        var y = L.y
          + Math.sin(t * 9 + heroPhase * L.sp) * L.amp * energy * 0.55
          + Math.sin(t * 21 - heroPhase * L.sp * 1.4) * L.amp * energy * 0.28
          + Math.sin(t * 3.5 + heroPhase * 0.4) * L.amp * 0.3;
        if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      var g = c.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, L.col + "0)");
      g.addColorStop(0.25, L.col + (live ? ".75)" : ".4)"));
      g.addColorStop(0.75, L.col + (live ? ".75)" : ".4)"));
      g.addColorStop(1, L.col + "0)");
      c.strokeStyle = g;
      c.lineWidth = L.wid;
      c.stroke();
    }
  }

  /* ── hero showreel button drives reel #1 ───────────────────── */
  var heroBtn = document.getElementById("heroPlay");
  var heroTime = document.getElementById("heroTime");
  function syncHero() {
    if (!heroBtn) return;
    var p = players[0];
    var on = p && p.playing;
    heroBtn.classList.toggle("playing", !!on);
    heroBtn.querySelector(".btn-txt").textContent = on ? "Pause the showreel" : "Play the showreel";
    if (heroTime && p) heroTime.textContent = on ? fmt(p.el.currentTime) : (p.duration ? fmt(p.duration) : "0:32");
    ensureLoop();
  }
  if (heroBtn) {
    heroBtn.addEventListener("click", function () {
      if (players[0]) toggle(players[0]);
    });
  }

  /* ── mount players ─────────────────────────────────────────── */
  var host = document.getElementById("players");
  if (host) {
    REELS.forEach(function (reel, i) {
      var p = build(reel, i);
      players.push(p);
      host.appendChild(p.row);
      draw(p);
    });

    // decode real waveforms one at a time once the section is near
    var decoded = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting || decoded) return;
        decoded = true;
        io.disconnect();
        players.reduce(function (chain, p) {
          return chain.then(function () {
            // loadPeaks writes the decoded duration back onto p
            return loadPeaks({ src: p.el.src, set: p }).then(function (peaks) {
              if (peaks) p.peaks = peaks;
              if (!p.duration && isFinite(p.el.duration)) p.duration = p.el.duration;
              tick(p);
            });
          });
        }, Promise.resolve());
      });
    }, { rootMargin: "300px" });
    io.observe(host);
  }

  /* peaks need the duration too — loadPeaks returns it on a throwaway
     object, so fold it back in when metadata is late */
  window.addEventListener("load", function () {
    players.forEach(function (p) {
      if (!p.duration && isFinite(p.el.duration)) { p.duration = p.el.duration; tick(p); }
    });
    syncHero();
  });

  /* ── reveals ───────────────────────────────────────────────── */
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); revealIO.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".reveal").forEach(function (n) { revealIO.observe(n); });

  /* ── sticky bar + mobile nav ───────────────────────────────── */
  var topbar = document.getElementById("topbar");
  var onScroll = function () {
    if (topbar) topbar.classList.toggle("stuck", window.scrollY > 24);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var menuBtn = document.getElementById("menuBtn");
  var nav = topbar ? topbar.querySelector("nav") : null;
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        nav.classList.remove("open");
        menuBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  var strip = document.getElementById("demoStrip");
  var stripClose = document.getElementById("demoStripClose");
  if (strip && stripClose) {
    stripClose.addEventListener("click", function () { strip.classList.add("gone"); });
  }

  /* placeholder links shouldn't jump the page */
  document.querySelectorAll("[data-ph]").forEach(function (a) {
    a.addEventListener("click", function (e) { e.preventDefault(); });
  });

  /* ── booking form ──────────────────────────────────────────── */
  var form = document.getElementById("bookingForm");
  var note = document.getElementById("formNote");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.querySelector("#f-name");
      var email = form.querySelector("#f-email");
      var bad = false;
      [name, email].forEach(function (f) {
        var ok = f.value.trim() !== "" && (f.type !== "email" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.value));
        f.classList.toggle("err", !ok);
        if (!ok) bad = true;
      });
      if (bad) {
        note.textContent = "Please add your name and a valid email so I can reply.";
        note.classList.remove("ok");
        return;
      }
      var btn = form.querySelector(".btn-submit");
      btn.classList.add("sent");
      btn.querySelector("span").textContent = "Enquiry captured";
      note.textContent = "Demo only — nothing was sent. Give me an inbox address and this posts straight to it.";
      note.classList.add("ok");
    });
  }

  /* ── redraw on resize ──────────────────────────────────────── */
  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { players.forEach(draw); drawHero(); }, 120);
  });

  drawHero();
  if (!reduceMotion) ensureLoop();
})();
