# Flux — what's done, what's coming

Plain-language list of everything on the fix-and-improve list, so you can see at
a glance where each item stands. No code knowledge needed to read this.

- **CHANGELOG.md** (and the "What's changed" card in Settings) = everything that
  has *ever* shipped, generated from the project's history.
- **This file** = the things you've asked for that are *not done yet*, plus the
  ones just finished, in the order they're being worked.

Status key: **Done** · **Queued** · **Needs you** (blocked on something only you
can do, like a dashboard setting or a decision).

Last updated: 2026-08-30.

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
| Mood was barely used | Fixed by asking. Nothing in Flux ever asked how you were — you had to remember the tab existed, open it, drag two sliders and press Save. Now a small card at the top of the Dashboard asks once in the morning and once in the evening, and one tap on a face logs it. It can't become annoying: each one appears at most once a day, closing it counts as answering for that half of the day, and a card you've dismissed won't come back until tomorrow. Two taps a day, maximum. There's also an "Add sleep & stress" link if you want the full version. Morning and evening answers are stored separately now, so an evening check-in no longer quietly overwrites the morning one — the gap between the two is the interesting bit. **Worth knowing:** I first put this card floating in the bottom-right corner, and the test suite caught it sitting on top of a button — which for a student would have meant not being able to press Apply on their own study plan. I moved it into the page rather than nudging it around, so it can't cover anything at all. |
| Focus timer full-screen mode | Added. There's a **Full screen** button on the Timer tab's Focus view: a big ring and big digits on an empty screen, with Reset, Pause and Exit. Escape leaves it, and so does the Exit button. It's a *view* of your timer, not a second one — pausing in full screen pauses the real timer, so the two can't drift apart and show different times. The small timer that follows you around the planner (the one you asked for) **already existed** — it's the pill that appears while a focus session is running, top-centre on a phone and bottom-right on a laptop, and clicking it takes you back to the Timer tab. I left it alone rather than build a second one. If you'd rather it sat up in the top bar next to New Task, that's a small change — say the word. |
| Clock, stopwatch, countdown and alarms | Added. The Timer tab now has five tabs across the top — Focus, Clock, Stopwatch, Countdown, Alarms — and opens on Focus, so your Pomodoro timer is exactly where it was. **Clock**: big local time and date, plus world clocks you can add from a list. **Stopwatch**: start, pause, and laps with split times. **Countdown**: one-tap 1/5/10/15/30/60 minutes, or set your own hours-minutes-seconds with a label, and a progress bar. **Alarms**: as many as you like, repeating on chosen weekdays or one-off, snooze 9 minutes, switch on and off. They chime, and pop up a notification if you've allowed those. Your alarms follow your account across devices; a running stopwatch or countdown stays on the device you started it on. The important part you can't see: none of these tick a number downwards. Phones and laptops stop running background timers when the screen goes off, so anything built that way quietly loses time — and an alarm would simply never ring. Everything here works out the real time from the clock instead, so leaving the tab, locking your phone or shutting the lid can't make it wrong, and an alarm that came due while you were away rings when you come back. Once, not over and over. |
| Flux AI scrolled away from its own answer | Fixed. Three things were wrong at once. The code meant to follow the answer as it typed was pointed at the wrong part of the page, so it did nothing — the text just grew off the bottom of the screen. Then the moment an answer finished, Flux yanked you to the very bottom of it, which on a long answer threw away wherever you'd got to. Now it follows along while you're at the bottom, and the instant you scroll up to read, it leaves you alone completely — no more being dragged back down mid-sentence. Your own messages still jump to the bottom, because you just pressed send. |
| Flux AI was too wordy | Fixed, and it should cost you less per answer. The instructions Flux runs on asked for brevity once, vaguely, then asked for length three times, specifically — including a line telling it to *always* work from first principles, show alternate approaches and list common mistakes. When instructions contradict, the specific one wins, so every answer came pre-loaded with depth nobody asked for. Now short by default: a question like "when is this due" gets a sentence, and extra depth is offered at the end ("want me to go through why?") rather than written unprompted. The one exception is work you're handing in for a grade — that still gets full worked solutions, because that's where the length is actually worth paying for. |
| Favourites didn't stick | Fixed. Starring a subject in Study Tools was saved to the browser you did it in and nowhere else — so it survived a reload, but starring Biology on your laptop left your phone showing the default order. Favourites now travel with your account and appear the moment you sign in anywhere. Two extras worth knowing: if a favourites list arrives damaged or half-written, Flux keeps what you already had rather than quietly unstarring everything; and the little divider that separates your starred subjects from the rest used to drift out of place if the list mentioned a subject that no longer exists — which only became possible once the list started moving between devices. |
| Light mode | Done. Two rounds. The first found the root cause: the animated background is drawn on a canvas that only checked the theme about once a second, so switching to light left the dark backdrop painted underneath everything — and while that canvas was paused (hidden tab, low-power mode) it never updated at all. This round was the tab-by-tab sweep. Rather than guess, I measured every piece of text on all 11 tabs against the colour actually behind it: **24 unreadable spots, now 1.** Study Tools was the worst by far — 10 of the 24 — because that whole tab was built dark-only and had no light version at all; its panels were painting themselves near-black on a white page. Also fixed: the Done/Overdue/High numbers on the dashboard (neon colours meant for a black background, sitting on their own pale tint — "Done" was 1.14 where 4.5 is the readable minimum), the selected button in every Timer and filter row (dark grey text on a blue button, because a light-mode rule was overwriting the white label), and the coloured period badges on School Info. The one left is a 45m label on the dashboard that's a hair under the line — deliberately faint, and it reads fine. |
| Old emojis flashed in Owner Controls | Flux replaces every emoji with a clean line icon, but it does that by watching the page and swapping them a split second after they appear — so the ☢️ and 🧪 were on screen briefly before the real icons took over. The owner sidebar now draws the icons itself, so they're correct from the first frame. Same for the warning symbol and the tool/stop icon in Nuke Controls, and the icons on the Overview insights. |
| Privacy policy and terms didn't match reality | Fixed: email sign-up wasn't mentioned, Google features were described as live when they're switched off, Anthropic wasn't listed even though your students' text goes there, and mood/wellbeing data, staff verification details and feedback messages weren't mentioned at all. Also confirmed the claim that you can't read people's planners — the database genuinely blocks it. |
| Staff can add the classes they teach | Added, exactly like the student version but for the other side of the desk. On School Info a teacher types the period the way the school writes it — `A1`, `B3` — and names what they teach in that hour: A1 · American Lit, A2 · World History. Opening a class reveals its assigned work and events: a due date, a tick when it's done, and a red date when it isn't and the day has passed. Assignments and events are coloured differently, because an assembly isn't a thing to grade. Your timetable follows your account, so typing it on a laptop puts it on your phone. It's kept separate from a student's class list — the two look identical but mean opposite things, and sharing one place would have folded "American Lit, period A1" into the grade average of anyone who is both a student and a teacher. |
| **Why the staff section felt broken** | This turned out to be one fault, not many. The Lesson Hub and the "what's on now" strip both read *the classes you attend* — a student's list. Staff normally have none, so every count was 0 and every list was empty, permanently, for every member of staff. The Lesson Hub was the clearest case: it said "No classes yet" directly underneath its own message telling you to add the periods you teach in School Info. Until this batch there was no other list to read, so it was less a bug than a missing half. Now that teachers have a timetable, those surfaces read it — and the Lesson Hub works: your classes for the day, each with attendance, lesson notes and materials. It also used to show *every* class every day, so a teacher with an A1 and a B1 saw both on the same Tuesday and their attendance quietly overwrote each other's. It now shows only what actually meets today. |
| The dashboard opened on six zeros | Fixed. Rosters 0, Assignments 0, Join queue 0, To review 0, Messages 0, Due soon 0 — six numbers, none of them news, and the first thing a teacher ever saw. Half were only ever zero because of the fault above. The strip now shows only the counts that have something to say, and disappears when none do; a zero tells you nothing the empty text below doesn't already say in words. |
| "Classes" meant three different things | Fixed. There was "Your Classes" on the dashboard, "Classes" in the sidebar, and now "My classes" on School Info — two of them the same feature and the third unrelated. They're two ideas and now read as two: **My classes** is what you teach and when; **Rosters** is who's in the room, joined by code. The empty message on each points at the other, since being in the wrong one is the likeliest reason you're reading it. |
| Now / next period bar, and an attendance reminder | Added, both to the top of the staff dashboard — your pick of "rebuild around today", and your own idea for the reminder. The bar names the lesson you're in, the room, how long is left and what's next. Then it asks once — "Take attendance for World History" — with **Take it** and **Not now**. It can't nag: it goes quiet the moment attendance is marked anywhere, and a class you've waved away stays quiet for the rest of the day. It also can't lie: dismissing the reminder is never recorded as having taken the register, which is the one mistake here that would actually matter. |
| Three bugs found on the way | **Attendance was filed on the wrong day.** Lesson notes and attendance used the world clock rather than yours, so anything saved after 8pm here landed on tomorrow — and at a school east of us the entire teaching day landed on yesterday. **A teacher's timetable read as empty after signing in.** It was loaded once when the page started, before Flux knew who you were, so it looked in the wrong drawer and kept looking there until you reloaded. **The tests were passing for the wrong reason** — the pretend teacher used for testing only ever had a *student's* timetable, which is exactly what hid all of the above. |

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
| Teacher mode — the rest | Started; the big fault behind "nothing works" is fixed (see Done). Still to do: the leftover **BETA** badges on four cards of a live product, a "Classroom timer" card that duplicates the Timer tab, a greyed-out row of Google links that does nothing until connected, and grouping the remaining widgets into labelled sections instead of a pile. |
| Random student picker | Agreed, not built yet. Pick a name fairly from a class, with a "don't repeat until everyone's had a turn" mode. It needs a list of names per class first — you type or paste them in, since it can't rely on students having joined by code. |
| Does the staff section still feel laggy? | **Worth checking now.** I couldn't measure the speed honestly — the browser I test in runs the page hidden, which freezes the animation timing, so any number I quoted would have been invented. What I can say is that the page holds ~3,900 elements, 350 shadows and about 45 animations looping forever (32 of them decorative twinkling stars). That's plenty to keep a school laptop busy, and it's the first thing I'd cut — but I'd rather you tell me whether it still feels slow now the empty widgets are gone than have me strip out visuals on a guess. |

### Features and fixes

| What | Notes |
|------|-------|
| Timer is badly centred | **Can't reproduce — could you send a screenshot?** I measured it on a phone-sized screen and a laptop screen: the ring, the digits, the label, the mode buttons, the presets and the dots are all within a pixel of dead centre. I also checked it doesn't shuffle sideways as the numbers change (a common cause of "looks off-centre") — every value from 25:00 down to 09:59 is exactly the same width. My guess is the mobile spacing work earlier in this batch fixed it. If you can still see it, a photo and which tab/phone would let me find it in a minute. |
| Language tools are weak | Needs far more material, and the conjugator doesn't work well. |

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
