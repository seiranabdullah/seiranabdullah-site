# Daily site statistics to your email (free, ~15 minutes)

The site already contains the analytics code. Only your Measurement ID is missing.

## 1. Create Google Analytics 4
1. Go to analytics.google.com and sign in with seiranabdullah@gmail.com.
2. Admin → Create → Property → name it "seiranabdullah.me", time zone Latvia, currency EUR.
3. Choose Web, enter `https://seiranabdullah.me`, and create the stream.
4. Copy the **Measurement ID** (it looks like `G-AB12CD34EF`).

## 2. Paste the ID into the site (one place only)
Open **main.js**, search for:

    const GA_ID = 'G-XXXXXXXXXX';

Replace `G-XXXXXXXXXX` with your ID and upload main.js again.
Visitors then see a small cookie banner. Statistics are counted only after they press ACCEPT (EU rules).

## 3. Daily email report
1. Go to lookerstudio.google.com → Create → Report → Google Analytics → choose your property.
2. Add the charts you want (suggested list below).
3. Share ▾ → **Schedule delivery** → Recipients: seiranabdullah@gmail.com → Repeat: **Daily** → Time: 09:00.

You will get a PDF of yesterday's numbers every morning.

## What you can see
- Visitors today (users, new users) and visits (sessions)
- Average time on site (engagement time)
- Which pages were opened (Home / Pricing)
- Countries and cities, phone vs desktop
- Where visitors came from: Google, LinkedIn, Instagram, direct link, your emails
- Custom events built into the site:
  - `whatsapp_click` (place: contact / one_minute_popup)
  - `telegram_click`
  - `form_open`, `form_submit` (contact form)
  - `email_copy`
  - `cv_download`
  - `one_minute_popup` (someone stayed 60 seconds)
  - `pricing_teaser_click`
  - `story_complete` (someone scrolled through the whole "How I work" story)
  - `studio_tool` (which tool in My studio they clicked)
  - `social_click` (Behance, YouTube, LinkedIn, Instagram, Facebook)

Tip: in GA4 → Admin → Events, mark `form_submit` and `whatsapp_click` as **Key events**. Then the report also shows how many visitors contacted you.

## Contact form
The form sends messages through FormSubmit (free). The **first** message triggers an email to seiranabdullah@gmail.com asking you to confirm. Click "Activate form" once, and every message after that arrives automatically.

## Privacy (EU)
The cookie banner is already built in. Google Analytics loads only after a visitor accepts, and the choice is remembered.
