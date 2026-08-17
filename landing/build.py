#!/usr/bin/env python3
"""
Emits the Aura Shakti site.

The pages are plain static HTML sharing assets/site.css — this script exists so
the header, footer and theme script are written once instead of thirteen times.
Edit the data or the templates here and re-run:

    python3 landing/build.py

The output is ordinary HTML with no build step of its own, so it can be edited
directly afterwards if that is easier for a small change.
"""

import html
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))

# ── navigation ──────────────────────────────────────────────────────────────
NAV = [
    ("index.html", "Home"),
    ("characters.html", "Characters"),
    ("features.html", "Features"),
    ("test.html", "Reasoning test"),
    ("privacy.html", "Privacy"),
    ("developer.html", "Developer"),
]

FOOT_COLS = [
    ("The rooms", [
        ("council.html", "The Council"),
        ("mentor.html", "The Mentor"),
        ("psychologist.html", "The Psychologist"),
        ("teacher.html", "The Teacher"),
        ("poets.html", "The Poets"),
    ]),
    ("The app", [
        ("features.html", "What it does"),
        ("test.html", "Reasoning test"),
        ("characters.html", "Characters"),
        ("privacy.html", "Privacy & lock"),
    ]),
    ("Get it", [
        ("download.html", "Download"),
        ("faq.html", "FAQ"),
    ]),
    ("The developer", [
        ("developer.html", "About Vansh"),
        ("https://vanshkashyap.lzworth.in", "Portfolio"),
        ("https://techbyvansh.lzworth.in", "Projects"),
    ]),
]

# ── the five rooms ──────────────────────────────────────────────────────────
ROOMS = [
    dict(slug="council", name="The Council", tint="red",
         what="Five minds, one question",
         blurb="Five sharp, unsentimental minds sit with your problem. One of them "
               "answers at a time, so you get a position rather than a "
               "committee-flavoured average of everything.",
         ask="I have two offers and three weeks. Tell me what I am avoiding."),
    dict(slug="mentor", name="The Mentor", tint="red",
         what="Advice, in character",
         blurb="Choose who is sitting across from you and the advice arrives in "
               "their voice — conviction, ego and all. Useful precisely because "
               "it is not neutral.",
         ask="Main daar raha hoon. Aap hote to kya karte?"),
    dict(slug="psychologist", name="The Psychologist", tint="blue",
         what="Someone who listens",
         blurb="Slower, warmer, and more interested in the question under your "
               "question. A one-tap mood check-in builds a picture over weeks — "
               "and that log never leaves your phone.",
         ask="Sab theek hai, bas neend nahi aa rahi."),
    dict(slug="teacher", name="The Teacher", tint="green",
         what="Explains, then tests you",
         blurb="Send a chapter photo or a PDF and get it explained properly — with "
               "diagrams when a diagram is the honest answer. Then ask to be "
               "quizzed, and answer with a tap.",
         ask="Ye chapter samjhao, phir mujhse 5 sawaal poochiye."),
    dict(slug="poets", name="The Poets", tint="gold",
         what="Ghalib, Jaun, Faiz, Gulzar",
         blurb="For the things that do not want solving. Four voices from the Urdu "
               "canon, and one of them replies — not with advice, with a couplet "
               "that sits next to the feeling.",
         ask="Aaj kuch bharaa hua sa lag raha hai."),
]

SHOT = {"council": "council", "mentor": "mentor", "psychologist": "psych",
        "teacher": "teacher", "poets": "poets"}

# ── the roster ──────────────────────────────────────────────────────────────
# Grouped by where the voice comes from. `line` is a real line the app already
# quotes on its home screen; the rest carry the character's own register.
# Where a portrait exists under a free licence it is used; the rest keep the
# struck plate. Nobody's promotional stills are reproduced here.
PORTRAITS = {
    "Mirza Ghalib": "ghalib.jpg",
    "Faiz Ahmed Faiz": "faiz.jpg",
    "Jaun Elia": "jaunelia.jpg",
    "Ahmad Faraz": "ahmadfaraz.jpg",
    "William Shakespeare": "shakespeare.jpg",
    "Niccolò Machiavelli": "machiavelli.jpg",
    "Sun Tzu": "suntzu.jpg",
    "Chanakya": "chanakya.jpg",
}

CREDITS = [
    ("Mirza Ghalib, Sun Tzu, Chanakya, Machiavelli, Shakespeare", "Public domain, via Wikimedia Commons"),
    ("Jaun Elia", "ZarvanCyrus, CC BY-SA 4.0, via Wikimedia Commons"),
    ("Faiz Ahmed Faiz", "CC BY-SA 3.0, via Wikimedia Commons"),
    ("Ahmad Faraz", "Urdulife, CC BY-SA 3.0, via Wikimedia Commons"),
]

CHARACTERS = [
    ("On screen", "red",
     "Operators and courtiers — people whose advice comes with a plan attached.", [
         ("Thomas Shelby", "Peaky Blinders",
          "You can change what you do, but you can't change what you want."),
         ("Harvey Specter", "Suits",
          "Winners don't make excuses when the other side plays the game."),
         ("Gustavo Fring", "Breaking Bad",
          "Never make the same mistake twice."),
         ("Tywin Lannister", "Game of Thrones",
          "A lion does not concern himself with the opinion of sheep."),
         ("Cersei Lannister", "Game of Thrones",
          "When you play the game of thrones, you win or you die."),
         ("Tyrion Lannister", "Game of Thrones",
          "A mind needs books as a sword needs a whetstone."),
         ("Petyr Baelish", "Game of Thrones",
          "Chaos isn't a pit. Chaos is a ladder."),
     ]),
    ("Anime & manga", "blue",
     "Strategists who think several moves past the question you asked.", [
         ("Kiyotaka Ayanokoji", "Classroom of the Elite",
          "In this world, winning is everything."),
         ("Johan Liebert", "Monster",
          "There is nothing special about being born."),
         ("Madara Uchiha", "Naruto",
          "Wake up to reality. Nothing ever goes as planned."),
         ("Itachi Uchiha", "Naruto",
          "People live their lives bound by what they accept as correct."),
         ("Pain", "Naruto",
          "Those who do not understand true pain can never understand true peace."),
         ("Shikamaru Nara", "Naruto",
          "Ten steps ahead, and none of them wasted."),
         ("L", "Death Note",
          "The proof is in what you do when nobody is checking."),
         ("Sosuke Aizen", "Bleach",
          "Admiration is the emotion furthest from understanding."),
         ("Senku Ishigami", "Dr. Stone",
          "Ten billion percent — but show me the working."),
     ]),
    ("Strategy, written down", "green",
     "Three books that have outlasted everyone who argued with them.", [
         ("Chanakya", "Arthashastra · चाणक्य",
          "Before you begin, ask three things: why, what, and whether."),
         ("Sun Tzu", "The Art of War",
          "Every battle is won before it is fought."),
         ("Niccolò Machiavelli", "The Prince",
          "It is far safer to be feared than loved, if you cannot be both."),
     ]),
    ("The poets", "gold",
     "The room you enter when the thing does not want solving.", [
         ("Mirza Ghalib", "Urdu · 1797–1869",
          "Hazaaron khwahishen aisi ki har khwahish pe dam nikle."),
         ("Jaun Elia", "Urdu · 1931–2002",
          "Ye bojh tumhara nahi, uss khamoshi ka hai jo tumne andar pal rakhi hai."),
         ("Faiz Ahmed Faiz", "Urdu · 1911–1984",
          "Bol, ki lab azaad hain tere."),
         ("Ahmad Faraz", "Urdu · 1931–2008",
          "Ranjish hi sahi, dil hi dukhane ke liye aa."),
         ("Gulzar", "Urdu & Hindi · b. 1934",
          "Kuch baatein lafzon mein nahi, khamoshi mein hoti hain."),
         ("William Shakespeare", "English · 1564–1616",
          "There is nothing either good or bad, but thinking makes it so."),
     ]),
]


def esc(s):
    return html.escape(s, quote=False)


def initials(name, taken=None):
    """
    The mark struck on a character's plate.

    Two Lannisters share a surname and a first letter, so a plain pair of
    initials would stamp both with TL. When that happens the first name is
    extended until the mark is its own.
    """
    parts = [p for p in re.split(r"\s+", name) if p and p[0].isalpha()]
    if len(parts) == 1:
        mark = parts[0][:2].upper()
    else:
        mark = (parts[0][0] + parts[-1][0]).upper()

    if taken is not None:
        n = 2
        while mark in taken and n <= len(parts[0]):
            mark = parts[0][:n + 1].upper()
            n += 1
        taken.add(mark)
    return mark


def plate_rings(seed):
    """
    Concentric arcs seeded by the name, so every character gets a mark that is
    unique but always the same one. No two plates repeat, and nothing depends on
    an image we do not have the rights to.
    """
    h = 0
    for ch in seed:
        h = (h * 31 + ord(ch)) % 100000
    out = []
    for i in range(4):
        h = (h * 1103515245 + 12345) % 2147483648
        r = 26 + i * 13 + (h % 7)
        dash = 8 + (h // 7) % 26
        gap = 4 + (h // 91) % 18
        rot = h % 360
        out.append(
            f'<circle cx="60" cy="60" r="{r}" fill="none" stroke="var(--tint)" '
            f'stroke-width="{1 if i % 2 else 1.6}" stroke-dasharray="{dash} {gap}" '
            f'transform="rotate({rot} 60 60)" opacity="{0.75 - i * 0.13:.2f}" />'
        )
    return "".join(out)


# ── shell ───────────────────────────────────────────────────────────────────
def shell(page, title, description, body, accent=None):
    # Only the roster needs the uploaded-portrait fetcher, and it is a module
    # so it never blocks the rest of the page.
    portraits = ('\n<script type="module" src="assets/portraits.js"></script>'
                 if page == "characters.html" else "")
    current = ' aria-current="page"'
    nav = "".join(
        '<a href="%s"%s>%s</a>' % (href, current if href == page else "", esc(label))
        for href, label in NAV
    )
    # The thumb rail. Same destinations as the desktop nav plus the rooms, as a
    # single horizontal flick instead of a menu to open and a list to scroll.
    rail_links = NAV + [
        ("council.html", "Council"), ("mentor.html", "Mentor"),
        ("psychologist.html", "Psychologist"), ("teacher.html", "Teacher"),
        ("poets.html", "Poets"), ("download.html", "Download"), ("faq.html", "FAQ"),
    ]
    rail = "".join(
        '<li><a href="%s"%s>%s</a></li>' % (href, current if href == page else "", esc(label))
        for href, label in rail_links
    )

    # The drawer carries every destination. Six of them are the desktop nav;
    # the rest only ever appear once the bar has collapsed, so a phone is not
    # left with fewer ways around the site than a laptop.
    primary = {href for href, _ in NAV}
    drawer = "".join(
        '<a href="%s"%s%s>%s</a>' % (
            href,
            current if href == page else "",
            "" if href in primary else ' class="nav-extra"',
            esc(label),
        )
        for href, label in rail_links
    )

    cols = ""
    for heading, links in FOOT_COLS:
        items = "".join(f'<a href="{h}">{esc(l)}</a>' for h, l in links)
        cols += f'<div class="foot-col"><strong>{esc(heading)}</strong>{items}</div>'

    # A page with its own identity colour sets it once, on the root, so every
    # component that reads --accent picks it up without a second rule.
    accent_style = ""
    if accent:
        # The palette blocks reach `--accent` through `:root:not([data-theme="dark"])`,
        # which outranks a bare `:root`. Matching that specificity — and sitting
        # after the stylesheet — is what makes the room colour hold in the light
        # theme as well as the dark one.
        accent_style = (
            '\n<style>\n'
            '  :root,\n'
            '  :root:not([data-theme="dark"]),\n'
            '  :root[data-theme="light"],\n'
            '  :root[data-theme="dark"] {\n'
            f'    --accent: var(--{accent});\n'
            f'    --accent-soft: color-mix(in srgb, var(--{accent}) 16%, transparent);\n'
            '  }\n'
            '</style>'
        )

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{esc(title)}</title>
<meta name="description" content="{html.escape(description, quote=True)}" />
<link rel="icon" type="image/png" href="assets/icon.png" />
<link rel="apple-touch-icon" href="assets/icon.png" />
<link rel="stylesheet" href="assets/site.css" />{accent_style}
</head>
<body>

<header class="bar">
  <div class="wrap bar__in">
    <a class="mark" href="index.html">Aura<i></i></a>
    <nav id="nav">{drawer}</nav>
    <div class="bar__right">
      <button class="toggle" id="theme" type="button" role="switch" aria-checked="false" aria-label="Switch theme">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <defs><mask id="cut"><rect x="0" y="0" width="24" height="24" fill="white" /><circle class="bite" r="8" cx="26" cy="0" fill="black" /></mask></defs>
          <circle class="disc" cx="12" cy="12" r="5.5" fill="currentColor" mask="url(#cut)" />
          <g class="rays" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="12" y1="1.6" x2="12" y2="4.2" /><line x1="12" y1="1.6" x2="12" y2="4.2" transform="rotate(45 12 12)" />
            <line x1="12" y1="1.6" x2="12" y2="4.2" transform="rotate(90 12 12)" /><line x1="12" y1="1.6" x2="12" y2="4.2" transform="rotate(135 12 12)" />
            <line x1="12" y1="1.6" x2="12" y2="4.2" transform="rotate(180 12 12)" /><line x1="12" y1="1.6" x2="12" y2="4.2" transform="rotate(225 12 12)" />
            <line x1="12" y1="1.6" x2="12" y2="4.2" transform="rotate(270 12 12)" /><line x1="12" y1="1.6" x2="12" y2="4.2" transform="rotate(315 12 12)" />
          </g>
        </svg>
      </button>
      <button class="burger" id="burger" type="button" aria-expanded="false" aria-controls="nav" aria-label="Menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="4" y1="8" x2="20" y2="8" /><line x1="4" y1="16" x2="20" y2="16" />
        </svg>
      </button>
      <a class="btn btn--solid btn--sm bar__cta" href="download.html"><span class="bar__cta-long">Get the app</span><span class="bar__cta-short">Get</span></a>
    </div>
  </div>
</header>

<nav class="railnav" aria-label="Sections">
  <ul>{rail}</ul>
</nav>

<main>
{body}
</main>

<footer>
  <div class="wrap">
    <div class="foot-cols">{cols}</div>
    <div class="foot">
      <span>Aura Shakti — built by <a href="https://vanshkashyap.lzworth.in">Vansh Kashyap</a>, LZ Worth</span>
      <span><a href="download.html">Download for Android</a></span>
    </div>
  </div>
</footer>

<script src="assets/site.js"></script>{portraits}
</body>
</html>
"""


def phead(label, title, lede, extra=""):
    return f"""  <section class="phead">
    <div class="phead__glow"></div>
    <div class="wrap">
      <span class="label">{esc(label)}</span>
      <h1>{esc(title)}</h1>
      <p>{esc(lede)}</p>
      {extra}
    </div>
  </section>
"""


def views(slug, name):
    """Phone and desktop, side by side — the same conversation in both."""
    s = SHOT[slug]
    return f"""  <section class="tight">
    <div class="wrap">
      <div class="head rise">
        <span class="label">On the phone, and on a desktop</span>
        <h2>The same room, either way.</h2>
        <p>These are screenshots of {esc(name)} running, not mock-ups drawn to look like it.</p>
      </div>
      <div class="views rise">
        <figure class="view view--desk">
          <img src="assets/shots/{s}-desk.png" alt="{esc(name)} on a desktop browser" loading="lazy" />
          <figcaption class="label">Desktop</figcaption>
        </figure>
        <figure class="view view--phone">
          <img src="assets/shots/{s}-phone.png" alt="{esc(name)} on a phone" loading="lazy" />
          <figcaption class="label">Phone</figcaption>
        </figure>
      </div>
    </div>
  </section>
"""


def strip(title, blurb, href="download.html", cta="Download for Android", second=None):
    """
    The closing call to action. There is deliberately no web-app link anywhere
    on this site — that build is private, and Android is the only public way in.
    """
    extra = ""
    if second:
        extra = f'<a class="btn btn--ghost" href="{second[0]}">{esc(second[1])}</a>'
    return f"""  <section class="strip tight">
    <div class="wrap strip__in">
      <div>
        <h2>{esc(title)}</h2>
        <p style="margin-top:.6rem;color:var(--ink-muted)">{esc(blurb)}</p>
      </div>
      <div class="cta-row">
        <a class="btn btn--solid" href="{href}">{esc(cta)}</a>
        {extra}
      </div>
    </div>
  </section>
"""


PAGES = {}

# ── home ────────────────────────────────────────────────────────────────────
rooms_html = ""
for r in ROOMS:
    rooms_html += f"""      <div class="room rise" data-tint="{r['tint']}" style="--tint:var(--{r['tint']})">
        <div class="room__in">
          <div class="room__id">
            <span class="room__dot"></span>
            <div>
              <h3 class="room__name">{esc(r['name'])}</h3>
              <span class="label room__what">{esc(r['what'])}</span>
            </div>
          </div>
          <div class="room__body">
            <p>{esc(r['blurb'])}</p>
            <span class="ask">&ldquo;{esc(r['ask'])}&rdquo;</span>
            <a class="more" href="{r['slug']}.html">Inside {esc(r['name'])}</a>
          </div>
        </div>
      </div>
"""

PAGES["index.html"] = shell(
    "index.html",
    "Aura Shakti",
    "Five rooms, one app: a council that argues, a mentor with an ego, a psychologist who listens, a teacher who quizzes you, and four poets.",
    f"""  <section class="hero">
    <div class="hero__glow"></div>
    <div class="wrap hero__copy">
      <h1>Not one assistant.<br />Five <em>rooms</em>.</h1>
      <p>A council that argues with itself. A mentor with an ego. A psychologist who
      actually listens. A teacher who quizzes you back. And four poets who answer in
      verse. Each is its own room, with its own colour.</p>
      <div class="cta-row">
        <a class="btn btn--solid" href="download.html">Download for Android</a>
        <a class="btn btn--ghost" href="#rooms">See the five rooms</a>
      </div>
      <p class="hero__note">Hindi, Hinglish or English &middot; free to use &middot; your mood log never leaves the phone</p>
    </div>

    <div class="stage" id="stage">
      <div class="phone phone--l">
        <img src="assets/shots/test.png" alt="The reasoning test showing a question with four options" loading="lazy" />
        <span class="label phone__tag">Reasoning test</span>
      </div>
      <div class="phone phone--c">
        <img src="assets/shots/council.png" alt="A Council conversation answering in Hinglish" />
        <span class="label phone__tag">The Council</span>
      </div>
      <div class="phone phone--r">
        <img src="assets/shots/quiz.png" alt="The Teacher asking a question with tappable options" loading="lazy" />
        <span class="label phone__tag">Tap to answer</span>
      </div>
    </div>
  </section>

  <section id="rooms" style="padding-block:0">
    <div class="wrap head rise" style="padding-block:clamp(3.5rem,8vw,6rem) 0">
      <span class="label">The five rooms</span>
      <h2>Pick who you need today.</h2>
      <p>Switching rooms changes the voice, the colour and what the app is good at. Nothing carries over unless you want it to.</p>
    </div>
    <div class="rooms" style="margin-top:clamp(2.5rem,5vw,4rem)">
{rooms_html}    </div>
  </section>

  <section>
    <div class="wrap">
      <div class="head rise">
        <span class="label">Beyond the conversation</span>
        <h2>Three things it does that a chat box does not.</h2>
      </div>
      <div class="cards rise">
        <div class="card">
          <span class="label">Measured, not guessed</span>
          <h3>A reasoning test that holds still</h3>
          <p>Forty-two questions with known answers and arithmetic scoring, so the same answers always give the same result.</p>
          <a class="btn btn--ghost btn--sm" href="test.html">How it is scored</a>
        </div>
        <div class="card">
          <span class="label">Twenty-five voices</span>
          <h3>Choose who advises you</h3>
          <p>From Shelby and Ayanokoji to Chanakya, Sun Tzu, Ghalib and Jaun Elia — each answers in their own register.</p>
          <a class="btn btn--ghost btn--sm" href="characters.html">Meet them</a>
        </div>
        <div class="card">
          <span class="label">Locked and local</span>
          <h3>Private by construction</h3>
          <p>PIN, pattern or fingerprint on the whole app, an incognito room that writes nothing down, and a mood log that never leaves the device.</p>
          <a class="btn btn--ghost btn--sm" href="privacy.html">What is kept</a>
        </div>
      </div>
    </div>
  </section>

{strip('Start with whichever room you need.', 'Free, in Hindi, Hinglish or English. Nothing to install if you would rather use the web.')}""",
)

# ── the five room pages ─────────────────────────────────────────────────────
ROOM_DETAIL = {
    "council": dict(
        lede="Five sharp, unsentimental minds. You ask once; one of them answers, "
             "in their own voice, with a position rather than a summary of every side.",
        sections=[
            ("Why one voice at a time",
             "A panel that speaks together produces the average of its members, which "
             "is the one answer nobody actually holds. Here a single voice takes the "
             "question — Shelby, Ayanokoji, Chanakya, whoever the question suits — and "
             "commits to a reading. You can disagree with a position. You cannot "
             "disagree with an average."),
            ("What it is good for",
             "Decisions with a deadline and no clean answer: two offers, a partner who "
             "is not pulling their weight, a price you are afraid to name. It is blunt "
             "on purpose, and it will tell you what you are avoiding."),
            ("What it is not",
             "It is not a therapist and does not pretend to be. If what you need is to "
             "be heard rather than advised, the Psychologist is the other door."),
        ],
        asks=["I have two offers and three weeks. Tell me what I am avoiding.",
              "Mere business partner kaam nahi kar raha. Nikaal doon?",
              "Give me the strongest argument against my own plan."],
    ),
    "mentor": dict(
        lede="Pick who is sitting across the table. The advice arrives in their voice, "
             "with their conviction and their blind spots — which is the point.",
        sections=[
            ("Nineteen people to choose from",
             "Operators like Thomas Shelby, Harvey Specter and Gustavo Fring. "
             "Strategists like Ayanokoji, Itachi and Johan Liebert. And three books "
             "that outlasted their authors — Chanakya, Sun Tzu, Machiavelli. Each "
             "answers as themselves, not as a neutral assistant wearing a name."),
            ("Why a biased advisor is useful",
             "A neutral answer hedges. A character does not: they have a worldview, "
             "and that worldview cuts the problem a particular way. Ask two of them "
             "the same question and the gap between the answers is often more useful "
             "than either answer alone."),
            ("Switching is instant",
             "The mentor sits in the header as a small avatar. Change it mid-thread "
             "and the next reply comes from the new voice, with the conversation "
             "intact."),
        ],
        asks=["Main daar raha hoon. Aap hote to kya karte?",
              "How do I ask for double and not sound greedy?",
              "Mujhe lagta hai log mujhe seriously nahi lete. Kya galat kar raha hoon?"],
    ),
    "psychologist": dict(
        lede="Slower, warmer, and more interested in the question underneath the one "
             "you asked. With a mood check-in that stays on your device.",
        sections=[
            ("It asks before it advises",
             "The other rooms move to a recommendation quickly. This one does not. It "
             "will ask what happened, when it started, and what you have already "
             "tried — because the useful answer usually sits under the first question, "
             "not on top of it."),
            ("The mood check-in",
             "One tap on a five-point scale, and an optional line about why. Over a "
             "few weeks the small chart shows a pattern that is hard to see from "
             "inside a single bad day. The entries are written to the device and are "
             "never uploaded — there is no copy of them anywhere else."),
            ("An honest limit",
             "This is not therapy and it is not a clinician. It is a good place to "
             "think out loud, and a bad place to be in a crisis. If you are in one, "
             "please reach a person — a doctor, a helpline, someone you trust."),
        ],
        asks=["Sab theek hai, bas neend nahi aa rahi.",
              "I keep saying yes to things I do not want to do.",
              "Har choti baat pe gussa kyun aata hai aajkal?"],
    ),
    "teacher": dict(
        lede="Send a page, get it explained properly — then ask to be tested on it "
             "and answer with a tap.",
        sections=[
            ("Show it rather than describe it",
             "Attach a PDF or photograph the page with the camera in the composer. A "
             "question sheet, a diagram, a paragraph you have read four times — it is "
             "usually faster to send the thing than to type out what it says."),
            ("Diagrams that are actually drawn",
             "Ask for a flowchart and you get a rendered one, not a paragraph "
             "describing a flowchart. Processes, structures, timelines and "
             "relationships come back as diagrams when a diagram is the honest way to "
             "answer."),
            ("Quiz me, and tap to answer",
             "Ask to be quizzed and the questions come one at a time — the next only "
             "after you have answered. The options render as buttons, so answering is "
             "a tap rather than retyping a line already on screen."),
            ("Keep what you learned",
             "Any conversation exports as Markdown, or prints to PDF with the "
             "headings, tables and code intact. A session summary turns a long thread "
             "into what you covered and what to do next."),
        ],
        asks=["Ye chapter samjhao, phir mujhse 5 sawaal poochiye.",
              "Make a flowchart of how a bill becomes law.",
              "Is photo mein jo question hai wo step by step solve karo."],
    ),
    "poets": dict(
        lede="For the things that do not want solving. Four voices from the Urdu "
             "canon — and one of them replies.",
        sections=[
            ("Not advice. A couplet.",
             "Ghalib, Jaun Elia, Faiz, Ahmad Faraz, Gulzar and Shakespeare. You write "
             "what you are carrying and one of them answers — not with a plan, but "
             "with something that sits next to the feeling instead of trying to fix "
             "it."),
            ("Why this is a separate room",
             "Some evenings the last thing you want is a numbered list of three "
             "options. The other rooms would give you one anyway, because that is "
             "what they are for. This one will not."),
            ("It answers in your language",
             "Write in Hindi, Hinglish, Urdu transliteration or English. The reply "
             "comes back in the register you wrote in, which matters more here than "
             "anywhere else in the app."),
        ],
        asks=["Aaj kuch bharaa hua sa lag raha hai.",
              "Woh chala gaya aur main theek hoon. Shayad.",
              "Kuch likho jo raat ke teen baje samajh aaye."],
    ),
}

for r in ROOMS:
    d = ROOM_DETAIL[r["slug"]]
    secs = ""
    for i, (h3, body) in enumerate(d["sections"]):
        secs += f"""        <div class="prose rise">
          <h3>{esc(h3)}</h3>
          <p>{esc(body)}</p>
        </div>
"""
    asks = "".join(f'<li><span class="ask">&ldquo;{esc(a)}&rdquo;</span></li>' for a in d["asks"])
    others = "".join(
        f'<a class="chip" href="{o["slug"]}.html" style="--tint:var(--{o["tint"]})">'
        f'<i></i>{esc(o["name"])}</a>'
        for o in ROOMS if o["slug"] != r["slug"]
    )

    body = (
        phead("A room in Aura Shakti", r["name"], d["lede"],
              '<div class="cta-row" style="margin-top:2rem">'
              '<a class="btn btn--solid" href="download.html">Get the app</a>'
              '<a class="btn btn--ghost" href="characters.html">See who is in it</a></div>')
        + views(r["slug"], r["name"])
        + f"""  <section class="tight">
    <div class="wrap">
      <div class="prose-grid">
{secs}      </div>
    </div>
  </section>

  <section class="strip tight">
    <div class="wrap">
      <div class="head rise" style="margin-bottom:2rem">
        <span class="label">Try asking</span>
        <h2>Three ways in.</h2>
      </div>
      <ul class="asks rise">{asks}</ul>
    </div>
  </section>

  <section class="tight">
    <div class="wrap">
      <div class="head rise" style="margin-bottom:1.75rem">
        <span class="label">The other rooms</span>
        <h2>Not the one you needed?</h2>
      </div>
      <div class="chips rise">{others}</div>
    </div>
  </section>
"""
    )
    PAGES[f"{r['slug']}.html"] = shell(
        f"{r['slug']}.html", f"{r['name']} — Aura Shakti", d["lede"], body, accent=r["tint"]
    )

# ── characters ──────────────────────────────────────────────────────────────
groups = ""
total = sum(len(g[3]) for g in CHARACTERS)
marks_taken = set()
credit_rows = "".join(
    f"<dt>{esc(who)}</dt><dd>{esc(src)}</dd>" for who, src in CREDITS
)
for heading, tint, blurb, people in CHARACTERS:
    cards = ""
    for name, source, line in people:
        portrait = PORTRAITS.get(name)
        if portrait:
            plate = (f'<img class="portrait" src="assets/people/{portrait}" '
                     f'alt="Portrait of {esc(name)}" loading="lazy" />')
        else:
            plate = (f'<svg viewBox="0 0 120 120" aria-hidden="true">{plate_rings(name)}</svg>'
                     f'<span class="mono">{esc(initials(name, marks_taken))}</span>')
        cards += f"""          <article class="char rise{' char--photo' if portrait else ''}" style="--tint:var(--{tint})">
            <div class="plate">{plate}</div>
            <div class="char__body">
              <span class="char__from">{esc(source)}</span>
              <h3 class="char__name">{esc(name)}</h3>
              <p class="char__line">&ldquo;{esc(line)}&rdquo;</p>
            </div>
          </article>
"""
    groups += f"""      <div class="group">
        <div class="group__head rise">
          <h2>{esc(heading)}</h2>
          <span class="label">{len(people)} voices</span>
        </div>
        <p class="rise" style="margin-bottom:1.75rem;color:var(--ink-muted)">{esc(blurb)}</p>
        <div class="roster">
{cards}        </div>
      </div>
"""

PAGES["characters.html"] = shell(
    "characters.html",
    "Characters — Aura Shakti",
    f"All {total} voices in Aura Shakti: operators, strategists, three books on strategy, and the poets.",
    phead("The roster", "Twenty-five voices.",
          "Every character in the app, and where each one comes from. Pick one in "
          "Mentor and the advice arrives in their register — the vocabulary, the "
          "temperament and the blind spots included.")
    + f"""  <section class="tight">
    <div class="wrap">
{groups}      <div class="credits rise">
        <p class="note">
          Photographs are used where one exists under a free licence. The rest —
          characters from films, series and manga — carry a mark struck from the
          name instead: those likenesses belong to their studios, and the likeness
          that matters here is the voice anyway.
        </p>
        <dl class="credit-list">{credit_rows}</dl>
      </div>
    </div>
  </section>

{strip('Pick one and ask them something.', 'Mentor mode sits one tap from the Council. Switching keeps the thread.')}""",
)

# ── features ────────────────────────────────────────────────────────────────
# A tour, not a list: each entry is shown running rather than described. The
# side alternates so the eye has somewhere to go on a long page.
TOUR = [
    dict(shot="f-plus", tint="red", label="The composer",
         title="Send the thing itself.",
         body="The plus button opens what you can attach: a document, a photograph "
              "from the camera, or a request for an image. Useful when a report, a "
              "form or a question sheet is faster shown than typed out.",
         points=["PDFs and images up to 3 MB",
                 "The camera opens inside the app",
                 "Up to four attachments on one message"]),
    dict(shot="f-diagram", tint="green", label="Diagrams",
         title="Ask for a flowchart, get a flowchart.",
         body="Processes, structures and timelines come back drawn rather than "
              "described. The diagram is rendered in the thread and scrolls "
              "sideways on its own if it is wider than the screen.",
         points=["Flowcharts, sequences, timelines, mind maps",
                 "Rendered in the conversation, not linked out",
                 "Readable in both themes"]),
    dict(shot="f-menu", tint="red", label="The menu",
         title="Everything the thread can become.",
         body="One sheet holds the things you do with a conversation rather than "
              "inside it: export it, summarise it, start a private one, or go back "
              "through what you have already asked.",
         points=["Export as Markdown, or print to PDF",
                 "One-tap session summary",
                 "Incognito, history and settings"]),
    dict(shot="f-report", tint="blue", label="The reasoning test",
         title="A report with the working shown.",
         body="Fifteen questions produce a reasoning index, a breakdown by domain, "
              "and every question you missed with the reasoning spelled out. It "
              "appears the moment you finish, because nothing has to be asked of a "
              "model.",
         points=["Six domains, scored separately",
                 "Strongest and weakest named",
                 "History across sittings, so you can see movement"]),
    dict(shot="f-mood", tint="blue", label="Mood check-in",
         title="One tap, and it stays on the phone.",
         body="A five-point scale and an optional line about why. Over a few weeks "
              "the small chart shows a pattern that is hard to see from inside a "
              "single bad day. Nothing here is ever uploaded.",
         points=["Five levels, plus a note if you want one",
                 "Fourteen-day chart and a seven-day average",
                 "Written to the device only — no server copy"]),
    dict(shot="f-incognito", tint="red", label="Incognito",
         title="The room that keeps no record.",
         body="The interface turns grey so you can see at a glance that nothing is "
              "being written down. No history entry, no summary, nothing synced. "
              "Close the chat and it is gone.",
         points=["Visibly different, so you never lose track of it",
                 "Nothing written to history or the account",
                 "One tap back to normal"]),
    dict(shot="f-focus", tint="gold", label="Focus",
         title="Four minutes before you reply.",
         body="A breathing timer for the moment you should not answer something yet. "
              "The glow expands and contracts at the pace you are meant to breathe "
              "at, and there is nothing else on the screen.",
         points=["Breathe, or a plain countdown",
                 "Full screen, nothing else competing",
                 "Runs on the compositor, so it stays smooth"]),
    dict(shot="f-history", tint="red", label="History",
         title="Everything you asked, still there.",
         body="Every thread kept and searchable, filtered by which room it happened "
              "in. Incognito conversations are the deliberate exception — those were "
              "never written down.",
         points=["Search across every conversation",
                 "Filter by room",
                 "Rename or delete any thread"]),
]

tour_html = ""
for i, t in enumerate(TOUR):
    side = "tour--flip" if i % 2 else ""
    pts = "".join(f"<li>{esc(x)}</li>" for x in t["points"])
    tour_html += f"""      <article class="tour {side} rise" style="--tint:var(--{t['tint']})">
        <div class="tour__shot">
          <div class="tour__frame">
            <img src="assets/shots/{t['shot']}.png" alt="{esc(t['title'])}" loading="lazy" />
          </div>
        </div>
        <div class="tour__copy">
          <span class="label" style="color:var(--tint)">{esc(t['label'])}</span>
          <h2>{esc(t['title'])}</h2>
          <p>{esc(t['body'])}</p>
          <ul class="ticks">{pts}</ul>
        </div>
      </article>
"""

REST = [
    ("Notes you can keep", "Export a whole conversation as Markdown, or print it to PDF with headings and tables intact."),
    ("Session summary", "One tap turns a long thread into what you covered, the takeaway, and the next step."),
    ("Tap to answer", "When you are being quizzed the options render as buttons, so answering is a tap."),
    ("Light and dark", "A real switch in the header, with both themes designed rather than one inverted."),
    ("Hindi, Hinglish, English", "Write however you actually write; the reply comes back in the same register."),
    ("Voice input", "Dictate instead of typing, in the same languages."),
    ("Haptics", "Short, deliberate taps on send and on switching rooms — off in one setting."),
    ("App lock", "PIN, passcode, pattern or fingerprint on the whole app, with auto-lock."),
]
rest_cells = "".join(
    f'<div class="cell"><h3>{esc(n)}</h3><p>{esc(d)}</p></div>' for n, d in REST
)

PAGES["features.html"] = shell(
    "features.html",
    "Features — Aura Shakti",
    "A tour of Aura Shakti running: attachments, diagrams, exports, the reasoning report, mood tracking, incognito, focus and history.",
    phead("What it does", "Shown running, not described.",
          "Every screenshot below is the app itself. Where something has a limit worth "
          "knowing about, it is written next to it rather than left out.")
    + f"""  <section class="tight">
    <div class="wrap tour-list">
{tour_html}    </div>
  </section>

  <section class="strip tight">
    <div class="wrap">
      <div class="head rise" style="margin-bottom:2rem">
        <span class="label">And the rest</span>
        <h2>Smaller things that matter daily.</h2>
      </div>
      <div class="grid rise">{rest_cells}</div>
    </div>
  </section>
""" + strip("All of it, in one install.", "Free, and nothing is held back for a paid tier."),
)

# ── reasoning test ──────────────────────────────────────────────────────────
PAGES["test.html"] = shell(
    "test.html",
    "The reasoning test — Aura Shakti",
    "A 42-question bank, 15 per sitting, six domains and arithmetic scoring — a reasoning index you can check rather than a number a model guessed.",
    phead("The reasoning test", "A score you can actually check.",
          "Most in-app IQ tests ask a model to guess a number, which is why the number "
          "changes if you take the same test twice. This one does not work that way.")
    + """  <section class="tight">
    <div class="wrap test-split">
      <div class="rise">
        <h2 style="font-size:var(--step-2);margin-bottom:1.2rem">How it is built</h2>
        <p style="color:var(--ink-muted)">
          A fixed bank of questions with known answers. Each sitting samples fifteen of
          them, two from every domain and the rest weighted to the harder end, then
          shuffles the options. Scoring is arithmetic: correct answers weighted by
          difficulty, a small speed factor, mapped onto a familiar 100-centred scale.
        </p>
        <ul class="facts">
          <li><b>42</b><span>questions in the bank, 15 in a sitting</span></li>
          <li><b>6</b><span>domains — sequences, verbal, deduction, pattern, numeric, case reasoning</span></li>
          <li><b>0</b><span>guesswork: the same answers always produce the same result</span></li>
          <li><b>1:1</b><span>every question you miss comes back with the reasoning spelled out</span></li>
        </ul>
        <p class="caveat">
          It is called a reasoning index, not an IQ. A clinical score is standardised
          against a population under supervised conditions; fifteen questions on a phone
          is not that, and saying otherwise would be dishonest.
        </p>
      </div>
      <div class="report rise" aria-hidden="true">
        <div class="report__top">
          <div><span class="label">Reasoning index</span><div class="report__idx">118</div></div>
          <span class="label" style="color:var(--accent)">Above average</span>
        </div>
        <div class="bars">
          <div class="bar-row"><span>Sequences</span><span class="track"><span class="fill" data-w="100%"></span></span><span>3/3</span></div>
          <div class="bar-row"><span>Case reasoning</span><span class="track"><span class="fill" data-w="100%"></span></span><span>3/3</span></div>
          <div class="bar-row"><span>Deduction</span><span class="track"><span class="fill" data-w="67%"></span></span><span>2/3</span></div>
          <div class="bar-row"><span>Numeric</span><span class="track"><span class="fill" data-w="67%"></span></span><span>2/3</span></div>
          <div class="bar-row"><span>Verbal</span><span class="track"><span class="fill" data-w="50%"></span></span><span>1/2</span></div>
          <div class="bar-row"><span>Pattern</span><span class="track"><span class="fill" data-w="100%"></span></span><span>1/1</span></div>
        </div>
      </div>
    </div>
  </section>

  <section class="strip tight">
    <div class="wrap">
      <div class="head rise" style="margin-bottom:2rem">
        <span class="label">The six domains</span>
        <h2>What each one is measuring.</h2>
      </div>
      <div class="grid rise">
        <div class="cell"><h3>Sequences</h3><p>Find the rule a series is following and continue it — including series that describe themselves.</p></div>
        <div class="cell"><h3>Verbal reasoning</h3><p>Analogies where the obvious near-synonym is the wrong answer and the relation is the right one.</p></div>
        <div class="cell"><h3>Logical deduction</h3><p>What follows and, more often, what does not — necessary versus sufficient, and alibis that only look complete.</p></div>
        <div class="cell"><h3>Pattern recognition</h3><p>Codes, grids and spatial questions: the shifted cipher, the magic square, the painted cube.</p></div>
        <div class="cell"><h3>Numerical reasoning</h3><p>Arithmetic with a trap in it — the bat and the ball, the lily pads, the average speed that is not the average.</p></div>
        <div class="cell"><h3>Case reasoning</h3><p>A short scenario with numbers in it: pricing, worker-days, overlapping sets, and a base rate most people ignore.</p></div>
      </div>
    </div>
  </section>

  <section class="tight">
    <div class="wrap">
      <div class="head rise">
        <span class="label">Seen in the app</span>
        <h2>Fifteen questions, one at a time.</h2>
        <p>Each question is timed by difficulty. Leave halfway and it resumes where you stopped; finish and the report is immediate, because nothing has to be asked of a model.</p>
      </div>
      <div class="views rise">
        <figure class="view view--phone" style="margin-inline:auto">
          <img src="assets/shots/test.png" alt="A reasoning test question with four options and a countdown" loading="lazy" />
          <figcaption class="label">Phone</figcaption>
        </figure>
      </div>
    </div>
  </section>
""" + strip("Take it once, then again next month.", "Every sitting samples a different fifteen, so a second run is a new test."),
)

# ── privacy ─────────────────────────────────────────────────────────────────
PAGES["privacy.html"] = shell(
    "privacy.html",
    "Privacy — Aura Shakti",
    "App lock with PIN, pattern and biometrics, an incognito room that writes nothing down, and a mood log that never leaves the device.",
    phead("Privacy", "Some of it should never leave the phone.",
          "A journal about your own head is not the same as a search query, and it is "
          "not treated the same way. Here is exactly what is kept, where, and what is "
          "not.")
    + """  <section class="tight">
    <div class="wrap">
      <div class="locks rise">
        <div class="lock">
          <h3>Lock the whole app</h3>
          <p>A four-digit PIN, a longer passcode, a pattern, or your fingerprint and face
          through the device's own authenticator. Nothing is stored in readable form —
          only a salted SHA-256 hash the app can check a guess against.</p>
        </div>
        <div class="lock">
          <h3>It locks itself</h3>
          <p>Choose how long it waits — immediately, or after a few minutes away. Come
          back later and the lock screen is there before anything else renders.</p>
        </div>
        <div class="lock">
          <h3>Incognito</h3>
          <p>The interface turns grey and the app stops writing anything down. No history
          entry, no summary, nothing synced. Close the chat and it is gone.</p>
        </div>
        <div class="lock">
          <h3>Mood stays local</h3>
          <p>Check-ins are written to the device and never uploaded. The chart is for you;
          there is no copy of it on any server.</p>
        </div>
        <div class="lock">
          <h3>The key is not in the page</h3>
          <p>The model key lives in a server environment and is used by an endpoint the app
          calls. It is never included in the JavaScript sent to your browser, so it cannot
          be read out of the page.</p>
        </div>
        <div class="lock">
          <h3>Your own key, if you prefer</h3>
          <p>Paste your own Gemini key in Settings and the app talks to Google directly from
          your browser on your quota, without going through the server at all.</p>
        </div>
      </div>

      <div class="prose rise" style="margin-top:clamp(3rem,6vw,4.5rem);max-width:60ch">
        <h3>What is stored, plainly</h3>
        <p>Signing in with Google creates an account record and your conversations are
        saved to it, so history follows you between devices. Incognito threads are
        excluded. Mood check-ins and reasoning-test results are kept on the device only.
        Deleting a conversation removes it from the account.</p>
        <h3>What this is not</h3>
        <p>Conversations go to a model to be answered, which means they leave the device
        like any other AI app. The app lock protects the phone in your hand, not the
        request in flight. If something must never be sent anywhere, do not type it into
        an AI app — this one included.</p>
      </div>
    </div>
  </section>
""" + strip("Set the lock in under a minute.", "Settings, then App lock \u2014 PIN, pattern or biometrics."),
)

# ── developer ───────────────────────────────────────────────────────────────
PAGES["developer.html"] = shell(
    "developer.html",
    "Vansh Kashyap — Aura Shakti",
    "Aura Shakti is built by Vansh Kashyap, co-founder of LZ Worth: a developer and automation builder in New Delhi.",
    phead("The developer", "Vansh Kashyap",
          "Co-founder of LZ Worth, based in New Delhi. A developer and automation "
          "builder who ships fast websites, React applications and n8n systems for "
          "founders, creators and service businesses.")
    + """  <section class="tight">
    <div class="wrap split">
      <div class="rise">
        <figure class="portrait-card">
          <img src="assets/people/vansh.jpg" alt="Vansh Kashyap" width="560" height="747" />
          <figcaption>
            <strong>Vansh Kashyap</strong>
            <span class="label">New Delhi &middot; LZ Worth</span>
          </figcaption>
        </figure>

        <div class="prose">
          <h3>About</h3>
          <p>I design and build products end to end — the interface, the data model, the
          integrations and the automation that keeps them running once nobody is
          watching. Most of my work is React and Next.js on Firebase or Supabase, with
          n8n doing the parts that should happen without a person.</p>
          <h3>Aura Shakti</h3>
          <p>This app is one of those products, built end to end: Firebase auth and
          Firestore, the Gemini calls behind a server endpoint so the key never ships to
          the browser, the app lock with its salted hashes and WebAuthn, and the question
          bank the reasoning test scores against.</p>
          <h3>Also</h3>
          <p>I publish at <strong style="color:var(--ink);font-weight:600">@techbyvansh</strong>,
          where the work above tends to end up explained.</p>
        </div>

        <div class="stats">
          <div class="stat"><b>10</b><span>live web apps</span></div>
          <div class="stat"><b>3</b><span>company sites shipped</span></div>
          <div class="stat"><b>2</b><span>AI systems in production</span></div>
          <div class="stat"><b>300K+</b><span>content views</span></div>
        </div>

        <ul class="stack">
          <li>React</li><li>Next.js</li><li>TypeScript</li><li>Firebase</li>
          <li>Supabase</li><li>Tailwind</li><li>n8n</li><li>Gemini</li>
          <li>OpenAI</li><li>Vercel</li>
        </ul>
      </div>

      <div class="rise">
        <div class="links">
          <a href="https://vanshkashyap.lzworth.in">Portfolio <span>vanshkashyap.lzworth.in</span></a>
          <a href="https://techbyvansh.lzworth.in">Projects <span>techbyvansh.lzworth.in</span></a>
        </div>
        <p class="note" style="margin-top:1.5rem">Available for selected freelance projects.</p>
      </div>
    </div>
  </section>
""" + strip("Want something like this built?", "Start with the portfolio — the work there is live and clickable.", "https://vanshkashyap.lzworth.in", "See the work"),
)

# ── download ────────────────────────────────────────────────────────────────
APK = dict(
    file="download/AuraShakti-1.0.apk",
    version="1.0",
    size="8.3 MB",
    min_android="8.0",
    sha256="66cef971e4530d4e3d5a7e18efa919b384cd26008af9d11afddc50f1176f88d8",
)

PAGES["download.html"] = shell(
    "download.html",
    "Download — Aura Shakti",
    "Install Aura Shakti on Android: five rooms, a reasoning test, and a lock on the whole thing.",
    phead("Get it", "Install it on your phone.",
          "One file, straight from here. Android will ask once whether to allow "
          "an install from your browser — that prompt is there because this is "
          "not coming from the Play Store, and it is the same permission you "
          "would grant any direct download.")
    + f"""  <section class="tight">
    <div class="wrap">
      <div class="release rise">
        <div class="release__head">
          <div class="release__mark" aria-hidden="true">
            <img src="assets/icon.png" alt="" width="72" height="72" />
          </div>
          <div class="release__id">
            <h2>Aura Shakti</h2>
            <span class="label">Android &middot; version {APK['version']}</span>
          </div>
          <a class="btn btn--solid" id="get" href="{APK['file']}" download>Download APK</a>
        </div>

        <dl class="spec">
          <div><dt>Version</dt><dd>{APK['version']}</dd></div>
          <div><dt>Size</dt><dd>{APK['size']}</dd></div>
          <div><dt>Requires</dt><dd>Android {APK['min_android']} or newer</dd></div>
          <div><dt>Permissions</dt><dd>Camera, storage &mdash; both only when you use them</dd></div>
        </dl>

        <p class="release__hash">
          <span class="label">SHA-256</span>
          <code>{APK['sha256']}</code>
        </p>
      </div>

      <div class="grid rise" style="margin-top:clamp(2.5rem,5vw,3.5rem)">
        <div class="cell"><h3>What is inside</h3><p>All five rooms, the reasoning test, notes and PDF export, incognito, and the app lock. Nothing held back for a paid tier.</p></div>
        <div class="cell"><h3>Signing in</h3><p>Google sign-in, using your phone's own account picker. Your conversations follow the account, so a reinstall loses nothing.</p></div>
        <div class="cell"><h3>Updating</h3><p>Come back here and install the newer file over the top. Your chats stay where they are.</p></div>
      </div>

      <div class="prose rise" style="margin-top:clamp(2.5rem,5vw,3.5rem);max-width:60ch">
        <h3>If Android blocks the install</h3>
        <p>Open the downloaded file, and when the prompt appears allow your browser to
        install apps. On most phones that is Settings &rarr; Apps &rarr; Special access
        &rarr; Install unknown apps. You only have to do it once.</p>
        <h3>Checking the file</h3>
        <p>The SHA-256 above is the checksum of the exact file served from this page.
        If you care to, compare it after downloading — it should match character for
        character.</p>
      </div>
    </div>
  </section>

  <!-- Shown once the download has actually started. -->
  <div class="sendoff" id="sendoff" hidden>
    <div class="sendoff__box">
      <div class="sendoff__mark"><img src="assets/icon.png" alt="" width="64" height="64" /></div>
      <h2>Milte hain app mein.</h2>
      <p>The file is on its way. Open it when it lands, allow the install, and sign in
      with Google — that is the whole setup.</p>
      <button class="btn btn--ghost btn--sm" id="sendoffClose" type="button">Close</button>
    </div>
  </div>
""" + strip("Questions first?", "Cost, languages, privacy and what the lock actually protects.", "faq.html", "Read the FAQ"),
)

# ── FAQ ─────────────────────────────────────────────────────────────────────
FAQ = [
    ("Is it free?",
     "Yes. There is a daily limit on the faster models; past it the app falls back to a "
     "slower one rather than stopping. You can also paste your own API key in Settings "
     "and use your own quota."),
    ("Which languages does it understand?",
     "Hindi, Hinglish and English, and it answers in whichever you wrote in. The Poets "
     "room also handles Urdu written in Latin script."),
    ("Do my conversations leave my phone?",
     "The ones you have in normal mode do — they go to a model to be answered, and they "
     "are saved to your account so your history survives reinstalling. Incognito "
     "threads are never written down, and mood check-ins never leave the device at all."),
    ("Is the reasoning test a real IQ test?",
     "No, and it does not claim to be. It is a fixed bank of questions with arithmetic "
     "scoring, reported as a reasoning index. A clinical IQ requires a standardised test "
     "under supervised conditions."),
    ("Can I use my own API key?",
     "Yes. Settings, then Custom API key. With one set, the app talks to Google directly "
     "from your browser on your quota and does not use the server endpoint."),
    ("What happens if I forget my app lock?",
     "Signing out and back in clears the lock along with the local data it protects. "
     "There is deliberately no recovery code — a lock with a back door is not a lock."),
    ("Why do some characters share a colour?",
     "The colour marks the room, not the person. Council and Mentor are both the house "
     "red; the Psychologist is blue, the Teacher green and the Poets gold."),
    ("Is there an iPhone app?",
     "Not yet — Android only for now."),
]
faq_html = "".join(
    f"<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>" for q, a in FAQ
)

PAGES["faq.html"] = shell(
    "faq.html",
    "FAQ — Aura Shakti",
    "Common questions about Aura Shakti: cost, languages, privacy, the reasoning test, API keys and the app lock.",
    phead("FAQ", "The questions people actually ask.",
          "Short answers, including to the ones with an inconvenient answer.")
    + f"""  <section class="tight">
    <div class="wrap" style="max-width:56rem">
      <div class="faq rise">{faq_html}</div>
      <p class="note rise" style="margin-top:2rem">
        Something not answered here? The developer's contact details are on the
        <a href="developer.html" style="color:var(--accent)">developer page</a>.
      </p>
    </div>
  </section>
""" + strip("Ready when you are.", "One file, about eight megabytes. Free, and nothing held back for a paid tier."),
)

# ── write ───────────────────────────────────────────────────────────────────
for name, content in PAGES.items():
    with open(os.path.join(HERE, name), "w", encoding="utf-8") as fh:
        fh.write(content)
print(f"  wrote {len(PAGES)} pages: {', '.join(sorted(PAGES))}")
