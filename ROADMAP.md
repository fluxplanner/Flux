# Flux — what's done, what's coming

Plain-language list of everything on the fix-and-improve list, so you can see at
a glance where each item stands. No code knowledge needed to read this.

- **CHANGELOG.md** (and the "What's changed" card in Settings) = everything that
  has *ever* shipped, generated from the project's history.
- **This file** = the things you've asked for that are *not done yet*, plus the
  ones just finished, in the order they're being worked.

Status key: **Done** · **Queued** · **Needs you** (blocked on something only you
can do, like a dashboard setting or a decision).

Last updated: 2026-08-29.

---

## Done

| What | Notes |
|------|-------|
| Remove Apple and Microsoft sign-in | Buttons and the sign-in path behind them are gone. Google and email remain. |
| Email sign-up sent you to a page that doesn't exist | Two separate faults. The confirmation email pointed at the wrong address, and even once that was fixed the app treated the link as if you had a second Flux tab open and closed itself. Both fixed. Expired or already-used links now explain themselves instead of failing quietly. **See "Needs you" below — one setting must be changed in Supabase before this works live.** |
| "Check your email" looked like an error | It was in the red error box and shook. Now green. |
| Login page advertised things Flux doesn't do | Five Google logos, "Calendar + Google sync", "two-way Google Calendar sync" and a Gmail/Drive/Classroom card, while Google has been paused since Canvas shipped. All hidden automatically while Google is off, and they come straight back when you switch it on. Co-work rooms and Office hours were both badged NEW — both removed, along with the two reviews that described them. Canvas added, since it's live. |
| Made-up reviews on the login page | The four quotes from "Aisha", "Jordan", "Mr. Delgado" and "Mr. Kim" are gone. They're empty placeholders now, and the whole section stays hidden until you put a real one in — so nobody sees blank cards in the meantime. Instructions for adding one are in a comment right above them. |
| A teacher whose verification request failed got stuck | The Submit button went to "Submitting…" and stayed disabled and dead, even when the request errored. The only way out was reloading. It resets now and explains what went wrong, so they can just try again. |
| Nothing told you a teacher was waiting | Requests only loaded while you had Owner Controls › Staff verify open, so one could sit unseen forever. There's now a red count badge on the Staff verify row that you can see from any tab, updating live, plus a message when you sign in telling you how many are waiting. The approve/reject screen itself was already working correctly. |
| Nobody could delete their own data | The privacy policy promised a "delete my data" button in Settings. There wasn't one — the only delete was hidden in the developer panel and only you could see it. Every student and teacher who read that policy was reading something untrue. Settings → Data & info now has a **Your data** card: download a copy, or delete everything. |
| Big empty gap at the bottom of every tab | The bottom nav is about 65 pixels tall, but three separate things were each leaving room for it — so every tab scrolled roughly 120 pixels past its own last card into blank page. Flux AI was worst: that tab is a fixed height and shouldn't scroll at all, so the extra room was pure emptiness under a chat that had already ended. There's now one setting that says how much room the nav needs, used once. Measured on a phone-sized screen: the gap after the last card went from 119 pixels to 23, the same on every tab. |
| Nav icons sat too far off the bottom edge | The bar padded itself by the full height of the iPhone home-indicator strip, leaving the icons floating with an empty band underneath. Now a little over half that — closer, without the buttons sitting on the home indicator. |
| The nav highlight got stuck on the wrong tab | Three faults. For Settings, Profile, Goals, Mood, Notes and School — the tabs that live under "More" rather than in the bar — the underline was never even told to move, so it sat under whichever main tab you last opened. On top of that, both the highlight and the underline animate, and neither animation runs while your phone is locked or you're in another app; the code recorded them as "arrived" the moment it started them, so an interrupted move stranded the highlight until you reloaded. All three fixed, and the highlight is re-checked whenever you come back to Flux. |
| Pills were off-centre | Dashboard: the Tasks / Done / Overdue / High counts were pinned to the left inside their capsules — about 21 pixels off the middle — which is what looked wrong with four of them in a row. Now dead centre. Study Tools: the pills themselves were fine; the strips they sit in slid sideways by about 13 pixels when you picked a subject, leaving the first pill sliced against the screen edge while everything else on the page lined up. Both strips now stop at the page margin. |
| Task cards had far too many buttons | Nine of them: school/outside, repeat, timer, copy link, Google Calendar, co-work, edit, ask AI, delete. Now four — timer, edit, ask Flux AI, delete. Nothing was thrown away: school-vs-outside became a "Belongs to" box in the Edit window, repeat was already in there, copy link is still on right-click, the Google Calendar button did nothing anyway while Google is paused, and co-work is one line from coming back. |
| Achievements | Gone. There were actually two systems running at once — the badges card on the dashboard with its popup and sound, and a quieter one that fired a message on your first task, tenth task, streaks and so on. Both removed, along with the Achievements row in the mobile More menu. Badges anyone already earned are left in their data rather than deleted, so nothing is lost if you ever want it back. |
| Dismissed feedback came back | The list of what you'd dismissed was only ever stored in one browser. Open Flux on your phone, or clear your browsing data, and that list was empty — and since feedback is stored on the server, everything you'd already dealt with reappeared. The dismissed list now travels with your account, and both devices' dismissals are combined rather than one overwriting the other. |
| The graphing calculator opened with y=sin(x) | Three places were doing it — the real Desmos window and two built-in fallbacks. All open on an empty grid now. |
| The Notebook tab | Paused. The sidebar tab labelled "Notebook" held a notes list plus a NotebookLM-style workspace, and that workspace is the part NotebookLM does better. Hidden rather than deleted — every note you've written is still saved and still syncing, and one setting brings the whole tab back. It's also gone from the Settings tab list, so a paused feature can't be switched on by accident. |
| The locker box at the top of School Info | Your classes are the first thing on that tab now. The box was mostly dead: four panels showing "—" that nothing ever filled in, sitting above the four fields that actually set them — and the two "reveal" buttons pointed at the dead panels, so there was no working way to read your own combination back. What's left is a small "Locker, counselor & student ID" strip below your classes that opens when you tap it. Nothing was lost. |
| Counselor messaging and office hours | Both paused. Neither finished the round trip: "Book appointment" saved a request but nothing ever confirmed a slot back to the student, "Message" opened a composer against a counselor account most schools haven't linked, and the Staff office hours card needs a database table almost nobody has set up — so it sat on the School tab reading "no office hours have been published yet" indefinitely. Hidden, not deleted; two settings bring it all back. A counselor's own dashboard is untouched — this removes only the student's way in, including the "Book counselor" row in the mobile menu. |
| Your name is now the first thing on Profile | The tab used to open with your counselor's face and bio, above your own details. Your name, photo and details lead it now; the counselor card moved to the bottom (and is paused anyway). Also tightened the spacing under your name — that gap was nearly double every other gap on the page. |
| The last of the achievements | A third badge system was still running under your name on Profile — "On a roll", "Task Master", "Study Streak", "Note Taker", and "Complete tasks to earn badges!" when you had none. Gone with the rest. Staff role labels (✓ Directory, Work mode) share that spot and stay, since those are labels, not rewards. |
| Favourites didn't stick | Fixed. Starring a subject in Study Tools was saved to the browser you did it in and nowhere else — so it survived a reload, but starring Biology on your laptop left your phone showing the default order. Favourites now travel with your account and appear the moment you sign in anywhere. Two extras worth knowing: if a favourites list arrives damaged or half-written, Flux keeps what you already had rather than quietly unstarring everything; and the little divider that separates your starred subjects from the rest used to drift out of place if the list mentioned a subject that no longer exists — which only became possible once the list started moving between devices. |
| Light mode | Done. Two rounds. The first found the root cause: the animated background is drawn on a canvas that only checked the theme about once a second, so switching to light left the dark backdrop painted underneath everything — and while that canvas was paused (hidden tab, low-power mode) it never updated at all. This round was the tab-by-tab sweep. Rather than guess, I measured every piece of text on all 11 tabs against the colour actually behind it: **24 unreadable spots, now 1.** Study Tools was the worst by far — 10 of the 24 — because that whole tab was built dark-only and had no light version at all; its panels were painting themselves near-black on a white page. Also fixed: the Done/Overdue/High numbers on the dashboard (neon colours meant for a black background, sitting on their own pale tint — "Done" was 1.14 where 4.5 is the readable minimum), the selected button in every Timer and filter row (dark grey text on a blue button, because a light-mode rule was overwriting the white label), and the coloured period badges on School Info. The one left is a 45m label on the dashboard that's a hair under the line — deliberately faint, and it reads fine. |
| Old emojis flashed in Owner Controls | Flux replaces every emoji with a clean line icon, but it does that by watching the page and swapping them a split second after they appear — so the ☢️ and 🧪 were on screen briefly before the real icons took over. The owner sidebar now draws the icons itself, so they're correct from the first frame. Same for the warning symbol and the tool/stop icon in Nuke Controls, and the icons on the Overview insights. |
| Privacy policy and terms didn't match reality | Fixed: email sign-up wasn't mentioned, Google features were described as live when they're switched off, Anthropic wasn't listed even though your students' text goes there, and mood/wellbeing data, staff verification details and feedback messages weren't mentioned at all. Also confirmed the claim that you can't read people's planners — the database genuinely blocks it. |

---

## Needs you

| What | What to do |
|------|------------|
| Turn on the new confirmation link | The code now sends people back to the right page, but Supabase will refuse an address that isn't on its approved list. Steps are at the bottom of this file. **Until this is done, email sign-up still won't work.** |
| Real quotes for the login page | The section is empty and hidden. When you have genuine quotes from students or staff, send them over and they go straight in. |
| Do you want verification requests emailed to you? | Right now you get a badge and a sign-in message — both need you to open Flux. An actual email is possible: Flux already has email-sending code, but it needs a Resend account key set in Supabase. Tell me if you have one, or want one, and I'll wire it up. |

---

## Queued

Grouped by area. Roughly in the order they'll be worked, highest impact first.

### Light mode and mobile

| What | Notes |
|------|-------|
| Mobile looks too different from desktop | Match the desktop styling more closely; the animation is fine and stays. |
| Settings on mobile is a mess | Full rework. |

### Reorganisation

| What | Notes |
|------|-------|
| Study Tools is overwhelming | Needs real structure, not just tidying. The single biggest one here. |
| Extracurriculars is crowded | Group related things together. |
| Settings has random items everywhere | Needs a proper order. |
| Teacher mode | Your words: "hot garbage". Things off-centre, things not working. Full review, redo where needed. |

### Features and fixes

| What | Notes |
|------|-------|
| Focus timer needs a full-screen mode | Plus a small version that follows you around the planner when you click away, so you can see it from any tab. Suggested spot: top bar, next to New Task. |
| Timer is badly centred | Same tab. |
| Mood is barely used | Prompt everyone morning and night so it actually gets logged. |
| Language tools are weak | Needs far more material, and the conjugator doesn't work well. |
| Flux AI scrolls away from its own answer | The tab jumps to the bottom and you can't read what it said. |
| Flux AI is too wordy | Shorter answers, which also makes your API credits last longer. |

---

## How to turn on the confirmation link

Do this once, and email sign-up starts working. Takes about a minute.

1. Go to **supabase.com** and sign in.
2. Open the **Flux** project.
3. In the left sidebar click **Authentication**.
4. Click **URL Configuration**.
5. Find **Site URL**. Set it to exactly:
   `https://fluxplanner.github.io/Flux/`
6. Below that, find **Redirect URLs** and click **Add URL**. Add exactly:
   `https://fluxplanner.github.io/Flux/`
7. Click **Add URL** once more and add this second one, which lets sign-up work
   while the site is being tested on a computer:
   `http://localhost:3344/`
8. Click **Save**.

To check it worked: open Flux in a private browsing window, sign up with an
email address you can read, and click the link in the email. It should open Flux
and sign you straight in. If it says the link expired, request a new one — links
are only valid for a limited time.
