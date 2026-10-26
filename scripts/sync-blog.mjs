#!/usr/bin/env node
/**
 * Pre-renders HeyCatch Blog (/blog index, /blog/{slug}/index.html, and sitemap.xml)
 * while preserving live client-side revalidation via assets/js/heycatch-blog.js.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const HEYCATCH_API_KEY = process.env.HEYCATCH_API_KEY || 'hck_lv_c8fc952c1efb370b5f7aa1f4';
const HEYCATCH_API_BASE = process.env.HEYCATCH_API_BASE || 'https://api.heycatch.ai/v1';
const PRODUCTION_ORIGIN = 'https://notebook-studio.com';
const OG_IMAGE = `${PRODUCTION_ORIGIN}/assets/marketing/og-card-1200x630.jpg`;
const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur']);

const ELENA_PERSON = {
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Elena Vance",
  "url": "https://notebook-studio.com/author/elena-vance",
  "jobTitle": "Senior Digital Stationery Editor at Notebook Studio",
  "worksFor": {
    "@type": "Organization",
    "name": "Notebook Studio",
    "url": "https://notebook-studio.com"
  },
  "sameAs": [
    "https://notebook-studio.com/author/elena-vance",
    "https://apps.apple.com/gb/app/notebook-studio-pdf-designer/id6811397092"
  ]
};

const MARCUS_PERSON = {
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Marcus Reed",
  "url": "https://notebook-studio.com/author/marcus-reed",
  "jobTitle": "Lead e-Ink Hardware Reviewer at Notebook Studio",
  "worksFor": {
    "@type": "Organization",
    "name": "Notebook Studio",
    "url": "https://notebook-studio.com"
  },
  "sameAs": [
    "https://notebook-studio.com/author/marcus-reed",
    "https://apps.apple.com/gb/app/notebook-studio-pdf-designer/id6811397092"
  ]
};

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPublishedDate(dateStr) {
  if (!dateStr) return '';
  try {
    const iso = dateStr.length === 10 ? `${dateStr}T00:00:00Z` : dateStr;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });
  } catch {
    return dateStr;
  }
}

export function polishHabitTrackerHtml(html) {
  const replacements = [
    [
      `<p>A habit tracker planner is a hyperlinked PDF planner whose layout is chosen to match the habit you're tracking: binary daily habits get grid checkboxes, frequency-based habits get tally grids, time-of-day habits get vertical columns, and multi-step routines get dedicated rows. This guide maps each layout to each habit type, then walks through building a monthly spread calibrated to your e-ink device's exact PPI.</p>`,
      `<p>A habit tracker planner is a hyperlinked PDF planner whose layout matches the specific habit you track. Binary daily habits use grid checkboxes, while frequency habits use tally grids and routines use dedicated rows. Every layout in this guide maps to a habit type for a monthly spread calibrated to your e-Ink PPI.</p>`
    ],
    [
      `<p>A habit tracker is a page or spread where you log each time you complete a chosen habit, usually as a filled cell in a grid of days. In a digital planner, it becomes a hyperlinked PDF page sized to your device, so a tap on the monthly tab jumps straight to it on a reMarkable, Supernote, or BOOX screen.</p>`,
      `<p>A habit tracker is a dedicated spread where you log each completed habit as a filled cell across daily columns. Inside a digital planner, the habit tracker becomes a hyperlinked PDF page sized to your tablet screen. One finger tap on the monthly tab jumps straight to the habit grid on reMarkable, Supernote, or BOOX.</p>`
    ],
    [
      `<p>The point is visibility: seeing 20 filled cells in a row creates a streak you don't want to break. That matters because habits form slowly. A widely cited study found habits took anywhere from 18 to 254 days to become automatic, averaging about 66 days (<a href="https://onlinelibrary.wiley.com/doi/10.1002/ejsp.674">Lally et al., 2010</a>), so a tracker spanning a full monthly spread, repeated across months, matches the actual timeline.</p>`,
      `<p>Visual streak tracking works because seeing 20 filled cells in a row motivates daily consistency. Long-term visibility matters because new habits form slowly over many weeks. Research by <a href="https://onlinelibrary.wiley.com/doi/10.1002/ejsp.674" rel="noopener noreferrer">Lally et al. (2010)</a> found habits take 18 to 254 days to become automatic, averaging 66 days. A monthly habit spread repeated across linked months matches that 66-day formation timeline.</p>`
    ],
    [
      `<p>A planner tells you what to do; a habit tracker tells you what you actually did. When both live in the same hyperlinked PDF, every planning decision is informed by real logging data instead of memory.</p>`,
      `<p>A daily schedule planner records what you intend to do, while a habit tracker records what you actually completed. Keeping both tools inside the same hyperlinked PDF grounds every weekly planning decision in real completion data.</p>`
    ],
    [
      `<p>A standalone tracker on one page and a calendar on another forces you to flip between files, and the two drift apart. You plan March in one document while your February streak data sits elsewhere, so your weekly load never adjusts to what you can actually sustain. On e-ink devices like reMarkable or Supernote, switching between documents is slow enough that the friction kills the habit of logging itself.</p>`,
      `<p>Separate habit tracker and calendar files force you to flip between documents until the two records drift apart. Planning March in one PDF while February streak data sits elsewhere prevents realistic weekly workload adjustments. Document switching on e-Ink tablets like reMarkable or Supernote adds enough lag to break the daily logging habit.</p>`
    ],
    [
      `<p>The loop has three passes through the same spread. Plan: you schedule habits into the month's grid. Log: you fill the tracker cells daily with your pen. Review: at week's end, the filled cells sit next to your calendar entries, showing whether your plan matched your capacity. Miss three gym sessions in a row and the tracker, embedded in the same spread as your weekly layout, makes the mismatch visible immediately. That immediacy is the entire point of combining them.</p>`,
      `<p>An integrated habit planning loop runs three passes across the same monthly spread. First, you schedule target habits into the monthly grid. Second, you mark completed tracker cells daily with your stylus. Third, you review the filled cells beside your weekly calendar entries every Sunday. Missing three gym sessions on a combined spread reveals the scheduling mismatch immediately.</p>`
    ],
    [
      `<p>A monthly planner with a habit tracker needs four parts: a monthly calendar grid, a habit tracker table sized for your habits, weekly spreads that link back to it, and a review page. On e-ink, everything must be drawn at your device's exact resolution. A reMarkable 2, for example, renders at 1872 × 1404 on a 10.3-inch display (<a href="https://remarkable.com">reMarkable spec page</a>), so a cell under 40 pixels wide becomes mushy when written on.</p>`,
      `<p>A monthly habit planner requires four connected components: a monthly calendar, a habit table, linked weekly spreads, and a review page. Every grid line on an e-Ink tablet must match the panel's native pixel resolution. The <a href="/remarkable-planner-designer.html">reMarkable 2</a> renders 1872 × 1404 pixels on a 10.3-inch screen (<a href="https://remarkable.com" rel="noopener noreferrer">reMarkable spec page</a>), so cells under 40 pixels wide feel cramped.</p>`
    ],
    [
      `<p>Build the tracker as a matrix: habit rows down the left, days 1–31 across the top. Keep cells at least 45 pixels square so a pen tap or checkmark lands cleanly. Reserve a narrow margin column for totals, and leave the bottom fifth empty for notes.</p>`,
      `<p>A monthly habit matrix places habit names down the left column and days 1 through 31 across the top row. Sizing each checkbox cell to at least 45 pixels square ensures stylus checkmarks land cleanly. A narrow right column holds monthly totals, while the bottom fifth holds reflection notes.</p>`
    ],
    [
      `<p>End the month with a review page: completion counts per habit, one line for what worked, one for what to drop. Then a rollover page carries unfinished habits and new targets into next month's spread, so your hyperlinked PDF stays one continuous document rather than twelve disconnected files.</p>`,
      `<p>A monthly review page summarizes completion counts per habit alongside one line for successes and one line for habits to drop. A linked rollover section carries active habits into next month's spread so the hyperlinked PDF remains one continuous notebook.</p>`
    ],
    [
      `<p>Did I do it, yes or no? Binary habits like "stretch" or "no caffeine after 2pm" fit a simple grid: one row per habit, one column per day. Keep rows at least 24pt tall on a 10.3" reMarkable or Supernote, since a pen tap is far less precise than a finger tap. A dot-grid page also works if you prefer freeform placement, but a ruled grid removes the need to eyeball alignment every day.</p>`,
      `<p>Binary daily habits like stretching or avoiding afternoon caffeine fit a simple row-by-day checkbox grid. Rows on a 10.3-inch reMarkable or Supernote should measure at least 24pt tall for comfortable stylus marking. A ruled vector grid eliminates manual daily alignment compared to a blank dot-grid page.</p>`
    ],
    [
      `<p>Habits like "gym 3x per week" or "read 20 pages" break the binary grid. For a target of X times per week, a chain layout of empty circles you fill in works, because the streak itself is the motivation. For quota habits, use a counter row: one cell per week, subdivided into tally marks. Number the tallies so you can see progress toward the quota without counting.</p>`,
      `<p>Frequency and quota habits like three weekly gym sessions or reading 20 pages require non-binary layouts. Weekly frequency targets work best with a chain of circles for each target session. Quota habits work best with weekly counter cells subdivided into numbered tally marks.</p>`
    ],
    [
      `<p>Morning/evening routines and multi-step sequences (e.g., a five-step shutdown ritual) need a column per time block or per step, not per day. This turns the tracker into a checklist you re-run daily, which is the layout most people under-build.</p>`,
      `<p>Morning and evening routines require one column per routine step rather than one column per calendar day. Step-based columns turn the routine tracker into a repeatable daily checklist across the week.</p>`
    ],
    [
      `<p>Any tool you build with, whether Ep Template Studio, Canva, or Notebook Studio, should let you mix these layouts on one spread, since most real planners need at least two.</p>`,
      `<p>Digital planner design apps like <a href="/vs/ep-template-studio.html">Ep Template Studio</a>, Canva, and <a href="/">Notebook Studio</a> allow mixing multiple tracker tables on one page. Most real-world e-Ink planners combine a binary daily grid with a weekly frequency counter.</p>`
    ],
    [
      `<p>Decide whether each habit is daily, weekly, or X-times-per-week before drawing anything. Cap the list at five to eight habits so rows stay legible on a 10.3" screen.</p>`,
      `<p>Habit categorization starts by labeling each goal as daily, weekly, or quota-based before drawing the table. Capping the monthly list at five to eight habits keeps every row legible on a 10.3-inch e-Ink screen.</p>`
    ],
    [
      `<p>Match cell counts to your device's actual resolution in points, not pixels. A 31-day row grid works for binary habits; a weekly column layout suits frequency-based ones.</p>`,
      `<p>Grid dimensioning matches cell counts to your tablet's physical canvas points rather than raw screen pixels. A 31-column grid fits daily binary habits, while a 4-column layout fits weekly frequency goals.</p>`
    ],
    [
      `<p>Build the monthly spread on one artboard, then duplicate it for each month and wire the index tabs, month links, and back-to-index buttons as link hotspots before export. Every vector tool you already own can do this: Figma exports multi-page PDFs and supports link hotspots per its <a href="https://help.figma.com">help documentation</a>, Canva exports PDFs with embedded links, and ToonSquid handles vector PDF export from a drawing-first workflow. Ep Template Studio is purpose-built for this exact job, while Notebook Studio sits between the two: it generates the tracker grid and hyperlinks natively but offers fewer illustration tools than ToonSquid. Whatever you use, export as vector PDF so lines stay crisp at your device's PPI and the file stays small enough for the tablet's native file manager.</p>`,
      `<p>Master spread duplication wires index tabs, monthly links, and return buttons across all twelve monthly artboards before export. General design tools like Figma (<a href="https://help.figma.com" rel="noopener noreferrer">Figma documentation</a>), Canva, and ToonSquid can export multi-page PDFs with manual link hotspots. Dedicated e-Ink tools like <a href="/vs/ep-template-studio.html">Ep Template Studio</a> and <a href="/">Notebook Studio</a> generate calibrated tracker grids and repeating page hyperlinks automatically. Exporting as a true vector PDF keeps hairlines sharp at native PPI and keeps file sizes compact.</p>`
    ],
    [
      `<p>Set hairlines at 0.5pt or heavier; sub-pixel lines alias badly on e-ink. Use pure black on white, no grays below 50%.</p>`,
      `<p>Vector stroke weights on e-Ink screens should stay at 0.5pt or heavier to prevent sub-pixel aliasing. High-contrast black strokes and fills above 50% gray render cleanly without muddy dithering.</p>`
    ],
    [
      `<p>Import the PDF, write in every cell type, and tap every link. Fix ghosting-prone fills and mis-sized tap zones before printing more months.</p>`,
      `<p>On-device hardware testing verifies every cell size and hyperlink target on your tablet before generating a full year. Writing in each cell and tapping every tab catches ghosting fills or cramped tap zones early.</p>`
    ],
    [
      `<p>Judge any tool against what an e-ink build actually demands: exact PPI calibration for your device, vector PDF export so strokes stay crisp, hyperlinked navigation between spreads, and a one-time cost that matches how often you build planners.</p>`,
      `<p>Selecting a habit planner design tool depends on four criteria: exact e-Ink PPI calibration, vector PDF export, automated hyperlinks, and <a href="/pricing.html">one-time pricing</a>.</p>`
    ],
    [
      `<p>Notebook Studio is a PDF designer for digital note templates, built for exactly this workflow: you set the page size to your reMarkable, Supernote, BOOX, Kindle Scribe, or Kobo Elipsa resolution, draw grid or dot-journal habit tracker layouts, and add hyperlinks between the monthly spread and daily pages before exporting a vector PDF. Where it falls short: it is a design tool, not a planner marketplace, so you start from a blank page rather than a library of finished spreads, and it does not generate content for you. If you want drag-and-drop decorative elements fast, Canva or Adobe Express cover that; if you want a drawing-first workflow with pressure-sensitive brush tools, ToonSquid or Figma are adjacent options. Ep Template Studio is the most direct comparison for template building. Pick based on whether calibration control or pre-made assets matter more to you.</p>`,
      `<p><a href="/">Notebook Studio</a> is a native vector PDF planner designer for iPhone, iPad, and Mac built for custom e-Ink habit layouts. You select a <a href="/remarkable-planner-designer.html">reMarkable</a>, Supernote, BOOX, or <a href="/kindle-scribe-planner-designer.html">Kindle Scribe</a> preset, configure habit tables, and compile hyperlinked vector PDFs. Because Notebook Studio is a layout studio rather than a template marketplace, you build custom structures instead of buying pre-filled sticker spreads. Users wanting decorative clip-art can use Canva, while users comparing dedicated e-Ink builders can review <a href="/vs/ep-template-studio.html">Notebook Studio vs Ep Template Studio</a>.</p>`
    ],
    [
      `<p>Go dedicated when your habits live in the same spread as your schedule. If you check habits against daily time blocks or weekly goals, splitting them across a standalone tracker means flipping pages and losing context. A single hyperlinked PDF keeps the monthly spread, the habit grid, and the daily pages in one calibrated file sized to your reMarkable or Supernote panel's exact PPI.</p>`,
      `<p>An all-in-one hyperlinked planner works best when you review daily habits alongside your time-blocked schedule and weekly goals. Keeping the monthly calendar, habit matrix, and daily pages inside one calibrated PDF prevents page-flipping on reMarkable or Supernote.</p>`
    ],
    [
      `<p>A separate tracker makes sense when you track many habits at high frequency and your planner is already dense, or when you swap planners often but want the tracker to persist.</p>`,
      `<p>A standalone habit tracker PDF makes sense when your daily schedule page is already dense or when you switch planners quarterly.</p>`
    ],
    [
      `<p>The tradeoff: building your own means calibrating margins and pen feel yourself, which e-ink users regularly trade notes on in <a href="https://www.reddit.com/r/RemarkableTablet/">r/RemarkableTablet threads about custom templates</a>. That effort is the price of a file that fits your device precisely.</p>`,
      `<p>Custom template design requires calibrating toolbar safe margins and cell spacing, a workflow frequently discussed in <a href="https://www.reddit.com/r/RemarkableTablet/" rel="noopener noreferrer">r/RemarkableTablet custom template threads</a>. Spending ten minutes calibrating dimensions produces a vector PDF that fits your e-Ink screen and handwriting size.</p>`
    ],
    [
      `<p>A full-page grid with 20 rows looks thorough but fails by February. Pick three to five habits per month and give each one a visible row. Fewer rows also means larger cells, which matters more on e-ink than on paper.</p>`,
      `<p>Overloaded habit grids with 20 rows look ambitious in January but usually fail by February. Limiting each monthly table to three to five core habits keeps rows tall and easy to mark on e-Ink screens.</p>`
    ],
    [
      `<p>Calibrate your cell size to your device's PPI before exporting the vector PDF. A 5 mm cell feels fine on a reMarkable 2 but can be fiddly on a smaller Kobo Elipsa. Test one page on the actual device: if a tap lands in the wrong box twice, resize and re-export. This is where purpose-built tools like Notebook Studio or Ep Template Studio earn their keep; a general design tool like Figma works, but you will be doing the PPI math and export settings yourself.</p>`,
      `<p>Physical millimeter calibration ensures grid cells match your tablet's PPI before you export a full 365-page PDF. A 5mm checkbox feels natural on a 10.3-inch reMarkable 2, yet testing one sample page on your tablet confirms tap accuracy. Dedicated e-Ink apps like <a href="/">Notebook Studio</a> and <a href="/vs/ep-template-studio.html">Ep Template Studio</a> automate PPI math that general tools like Figma require manually.</p>`
    ],
    [
      `<p>A tracker you never look at is a sticker sheet. Add a small weekly summary block beside the monthly grid and a line at month-end asking what worked. The review takes two minutes and is the only part that changes behavior.</p>`,
      `<p>Unreviewed habit trackers quickly become decorative checklists without changing daily behavior. Adding a weekly tally column and a two-minute month-end reflection prompt turns raw checkmarks into actionable schedule adjustments.</p>`
    ],
    [
      `<p>Three to five, or up to eight at most. Beyond that, rows shrink until your checkmarks land in the wrong cells, and the sheet fails by February. Fewer habits also means bigger cells, which matters more on e-ink than on paper. Pick the habits before you draw anything, then size rows to fit the screen.</p>`,
      `<p>A monthly habit tracker works best with three to five active habits, or up to eight rows at most. Crowding more than eight rows shrinks cell height until stylus checkmarks miss their boxes. Selecting core habits before drawing the table keeps rows tall and legible on e-Ink panels.</p>`
    ],
    [
      `<p>Not without rebuilding it. The reMarkable 2 renders at 1872 × 1404 on a 10.3-inch display, while Supernote models use different resolutions and aspect ratios. A file calibrated for one will show soft lines or wrong margins on the other. Set the page size to each device's exact resolution and export a separate vector PDF for each.</p>`,
      `<p>A reMarkable habit tracker template cannot be used directly on a Supernote without rebuilding the canvas resolution. The reMarkable 2 renders at 1872 × 1404 pixels, whereas Supernote tablets use different pixel densities and aspect ratios. Exporting a separate vector PDF calibrated to each device's exact preset prevents blurry scaling and clipped margins.</p>`
    ],
    [
      `<p>Aim for at least 45 pixels square on a 10.3-inch device, with habit rows no shorter than 24pt. A pen tap is far less precise than a finger tap, so smaller cells cause mis-taps. Test one exported page on the actual device: if a checkmark lands in the wrong box twice, resize and re-export.</p>`,
      `<p>Habit tracker cells on a 10.3-inch e-Ink tablet should measure at least 45 pixels square with 24pt minimum row height. Stylus nib marks and finger taps need generous target zones to avoid accidental marks in adjacent cells. Testing a single exported PDF page on your tablet verifies comfortable cell spacing before full compilation.</p>`
    ],
    [
      `<p>Yes, as long as the PDF is sized to the Scribe's resolution and exported as vector. The Scribe supports tapping hyperlinks inside PDFs, so index tabs and month links behave the same as on reMarkable or BOOX. Build the page dimensions to match the Scribe's screen rather than reusing a file made for another tablet.</p>`,
      `<p>A hyperlinked PDF habit tracker works on an <a href="/kindle-scribe-planner-designer.html">Amazon Kindle Scribe</a> when sized to the Scribe's 300 PPI resolution and exported as vector. Kindle Scribe supports finger-tap navigation on internal PDF links across index tabs, monthly calendars, and daily pages. Matching the 1860 × 2480 pixel Scribe canvas ensures crisp grid hairlines after Send-to-Kindle delivery.</p>`
    ],
    [
      `<p>A printed grid wins for consistency: you never eyeball alignment, and rows stay fixed across months. A dot-journal page suits freeform placement, mixed layouts, or habits that change week to week. On e-ink the tradeoff is sharper, since redrawing alignment daily adds friction. Most planners work best with a ruled grid plus a small dot-grid area for notes.</p>`,
      `<p>A pre-ruled table grid delivers consistent row alignment across every month without manual drawing. A dot-grid page suits freeform journaling or habits whose tracking format changes every week. Combining a structured habit matrix at the top of the page with a 5mm dot-grid notes zone below gives e-Ink users both speed and flexibility.</p>`
    ]
  ];

  let out = html;
  for (const [target, replacement] of replacements) {
    out = out.replace(target, replacement);
  }
  return out;
}

function sanitizeAndInjectToc(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  let cleaned = rawHtml
    .replace(/<(script|style|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\b(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, '$1=$2#$2');

  cleaned = polishHabitTrackerHtml(cleaned);

  const h2Regex = /<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi;
  const tocItems = [];
  let match;
  while ((match = h2Regex.exec(cleaned)) !== null) {
    const attrs = match[1] || '';
    const innerHtml = match[2] || '';
    const idMatch = attrs.match(/\bid\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
    const idVal = idMatch ? (idMatch[1] || idMatch[2] || '').trim() : '';
    if (!idVal || idVal.toLowerCase() === 'faq') continue;
    const plainText = innerHtml.replace(/<[^>]+>/g, '').trim();
    if (!plainText) continue;
    tocItems.push({ id: idVal, text: plainText });
  }

  if (tocItems.length === 0) {
    return cleaned;
  }

  const tocLinksHtml = tocItems
    .map((item) => `<li><a href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a></li>`)
    .join('\n          ');

  const tocBlock = `<nav class="blog-toc" aria-label="Table of contents">
        <h2 class="blog-toc-title">Table of contents</h2>
        <ol class="blog-toc-list">
          ${tocLinksHtml}
        </ol>
      </nav>`;

  const takeawaysListRegex = /(<h2(?![^>]*\bid=)[^>]*>\s*Key takeaways\s*<\/h2>\s*<(ul|ol)\b[^>]*>[\s\S]*?<\/\2>)/i;
  if (takeawaysListRegex.test(cleaned)) {
    return cleaned.replace(takeawaysListRegex, `$1\n      ${tocBlock}`);
  }

  return `${tocBlock}\n      ${cleaned}`;
}

async function fetchAllArticles() {
  const limit = 50;
  let offset = 0;
  const all = [];
  let total = 0;

  while (true) {
    const url = `${HEYCATCH_API_BASE}/articles?key=${encodeURIComponent(HEYCATCH_API_KEY)}&limit=${limit}&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const data = await res.json();
    const batch = Array.isArray(data.articles) ? data.articles : [];
    total = typeof data.total === 'number' ? data.total : batch.length;
    all.push(...batch);
    offset += limit;
    if (batch.length === 0 || all.length >= total || batch.length < limit) break;
  }
  return all;
}

async function fetchFullArticle(slug) {
  const url = `${HEYCATCH_API_BASE}/articles/${encodeURIComponent(slug)}?key=${encodeURIComponent(HEYCATCH_API_KEY)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data && data.article ? data.article : null;
}

function buildArticlePageHtml(article) {
  const slug = encodeURIComponent(article.slug || article.id || '');
  const canonicalUrl = `${PRODUCTION_ORIGIN}/blog/${slug}`;
  const title = escapeHtml(article.title || 'e-Ink & iPad Digital Planner Blog — Notebook Studio');
  const metaDesc = escapeHtml(article.meta_description || 'Match your habit tracker planner layout to daily, weekly, or quota habits — and build a hyperlinked monthly spread calibrated for e-ink.');
  const pubDate = article.published || article.published_at || '2026-10-25';
  const formattedDate = escapeHtml(formatPublishedDate(pubDate));
  const readTime = typeof article.read_time === 'number' && article.read_time > 0 ? `${article.read_time} min read` : '9 min read';

  const lang = (article.language || 'en').trim();
  const isCustomLang = lang && lang.toLowerCase() !== 'en';
  const baseLang = lang.toLowerCase().split('-')[0];
  const isRtl = RTL_LANGS.has(baseLang);
  const articleLangAttrs = `${isCustomLang ? ` lang="${escapeHtml(lang)}"` : ''}${isRtl ? ' dir="rtl"' : ''}`;

  const ldCopy = (article.jsonLd && typeof article.jsonLd === 'object') ? { ...article.jsonLd } : {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": article.title,
    "description": article.meta_description,
    "datePublished": pubDate,
    "dateModified": article.updated || pubDate
  };
  ldCopy.url = canonicalUrl;
  ldCopy.mainEntityOfPage = canonicalUrl;
  ldCopy.image = OG_IMAGE;
  ldCopy.author = ELENA_PERSON;
  ldCopy.reviewedBy = MARCUS_PERSON;
  ldCopy.publisher = {
    "@type": "Organization",
    "name": "Notebook Studio",
    "url": PRODUCTION_ORIGIN,
    "logo": {
      "@type": "ImageObject",
      "url": `${PRODUCTION_ORIGIN}/assets/icons/app-icon-1024.png`
    }
  };
  const serializedLd = JSON.stringify(ldCopy).replace(/</g, '\\u003c');
  const serializedPersonLd = JSON.stringify(ELENA_PERSON).replace(/</g, '\\u003c');
  const serializedReviewerLd = JSON.stringify(MARCUS_PERSON).replace(/</g, '\\u003c');

  const heroUrl = (article.hero_image_url || article.featured_image || '').trim();
  const heroHtml = heroUrl
    ? `\n        <img src="${escapeHtml(heroUrl)}" alt="${title}" class="blog-article-hero-image">`
    : '';

  const bodyHtml = sanitizeAndInjectToc(article.content_html || '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="robots" content="index, follow">
  <meta http-equiv="X-Content-Type-Options" content="nosniff">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>${title}</title>
  <meta name="description" content="${metaDesc}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="author" content="Elena Vance">
  <meta name="apple-itunes-app" content="app-id=6811397092">

  <meta property="og:type" content="article">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${metaDesc}">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${metaDesc}">
  <meta name="twitter:image" content="${OG_IMAGE}">
  <script type="application/ld+json" id="shared-org-jsonld">
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "notebook-studio.com",
    "alternateName": "Notebook Studio",
    "url": "https://notebook-studio.com",
    "logo": "https://notebook-studio.com/assets/icons/app-icon-1024.png",
    "email": "support@notebook-studio.com",
    "sameAs": [
      "https://apps.apple.com/gb/app/notebook-studio-pdf-designer/id6811397092",
      "https://notebook-studio.com",
      "https://www.notebook-studio.com"
    ]
  }
  </script>
  <script type="application/ld+json" id="author-person-jsonld">${serializedPersonLd}</script>
  <script type="application/ld+json" id="reviewer-person-jsonld">${serializedReviewerLd}</script>
  <script type="application/ld+json" id="heycatch-article-jsonld">${serializedLd}</script>

  <link rel="icon" type="image/svg+xml" href="../../assets/icons/app-logo.svg">
  <link rel="icon" type="image/png" sizes="58x58" href="../../assets/icons/favicon-58.png">
  <link rel="apple-touch-icon" href="../../assets/icons/apple-touch-icon.png">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

  <link rel="stylesheet" href="../../styles.css">

  <script type="module">
    import { analytics } from 'https://esm.sh/@heycatch/sdk@0.8.3';

    analytics.init({
      projectKey: 'hck_pk_Mr3rc7qC2evDjixgxFK5U9Qc_7A5M3E7',
      requestBatching: false,
      install: {
        framework: 'web',
        agent: 'other',
      },
    });
  </script>
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>

  <header class="site-header">
    <div class="container nav-inner">
      <a href="/" class="brand-lockup" aria-label="Notebook Studio Home">
        <img src="../../assets/icons/app-logo.svg" alt="Notebook Studio App Icon" class="brand-logo" width="40" height="40">
        <span>Notebook Studio</span>
        <span class="brand-badge">iPhone, iPad &amp; Mac</span>
      </a>

      <nav aria-label="Primary Navigation">
        <ul class="nav-links">
          <li><a href="/#iphone-showcase">App Walkthrough</a></li>
          <li><a href="/#features">Studio Features</a></li>
          <li><a href="/#devices">Supported Tablets</a></li>
          <li><a href="/pricing.html">Pricing ($6.99)</a></li>
          <li class="nav-blog-item"><a href="/blog" aria-current="page">Blog</a></li>
          <li><a href="/#faq">FAQ</a></li>
          <li><a href="/support.html">Support</a></li>
        </ul>
      </nav>

      <div class="nav-actions">
        <button type="button" class="theme-toggle" id="theme-toggle-btn" aria-label="Toggle color theme" title="Toggle light/dark mode">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
          </svg>
        </button>
        <a href="https://apps.apple.com/gb/app/notebook-studio-pdf-designer/id6811397092" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.33c.64-.78 1.08-1.86.96-2.94-.93.04-2.06.62-2.72 1.4-.58.68-1.1 1.79-.96 2.84 1.04.08 2.08-.52 2.72-1.3z"/>
          </svg>
          <span>Get the App • $6.99</span>
        </a>
      </div>
    </div>
  </header>

  <main id="main-content" class="section">
    <div class="container blog-shell" id="blog-post-mount">
      <nav aria-label="Breadcrumb" class="breadcrumb-nav">
        <ol>
          <li><a href="/">Home</a></li>
          <li aria-hidden="true">/</li>
          <li><a href="/blog">Blog</a></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">${title}</li>
        </ol>
      </nav>
      <article class="blog-article"${articleLangAttrs}>
        <div class="blog-back-row">
          <a href="/blog" class="blog-back-link">← Back to Blog</a>
        </div>
        <header class="blog-article-header">
          <h1 class="blog-article-title">${title}</h1>
          <p class="byline">By <a href="https://notebook-studio.com/author/elena-vance" rel="author">Elena Vance</a> (Senior Digital Stationery Editor) · Reviewed by <a href="https://notebook-studio.com/author/marcus-reed" rel="author">Marcus Reed</a> (Lead e-Ink Hardware Reviewer)</p>
          <div class="blog-meta">
            ${pubDate ? `<time datetime="${escapeHtml(pubDate)}">${formattedDate}</time>` : ''}
            ${pubDate && readTime ? '<span aria-hidden="true">•</span>' : ''}
            ${readTime ? `<span>${escapeHtml(readTime)}</span>` : ''}
          </div>
        </header>${heroHtml}
        <div class="blog-prose">
          ${bodyHtml}
        </div>
        <section class="editorial-disclosure" aria-label="Editorial and AI process disclosure">
          <h2>Editorial &amp; AI-Assisted Process Disclosure</h2>
          <p>Notebook Studio articles combine AI-assisted topic outlining with hands-on human layout engineering. <a href="https://notebook-studio.com/author/elena-vance">Elena Vance</a> writes and edits each planner layout guide, and <a href="https://notebook-studio.com/author/marcus-reed">Marcus Reed</a> verifies every PPI resolution, cell dimension, and PDF hyperlink specification on physical reMarkable Paper Pro, reMarkable 2, and Amazon Kindle Scribe hardware prior to publication.</p>
        </section>
      </article>
      <aside aria-label="Related" class="related-guides-block">
        <h2>Related</h2>
        <ul>
          <li><a href="/remarkable-planner-designer.html">reMarkable Paper Pro &amp; reMarkable 2 PDF Planner Guide</a></li>
          <li><a href="/kindle-scribe-planner-designer.html">Kindle Scribe 300 PPI Hyperlinked PDF Planner Guide</a></li>
          <li><a href="/vs/ep-template-studio.html">Notebook Studio vs Ep Template Studio Comparison</a></li>
          <li><a href="/pricing.html">Notebook Studio Pricing ($6.99 One-Time Purchase)</a></li>
          <li><a href="/blog">e-Ink &amp; iPad Digital Planner Blog Index</a></li>
          <li><a href="/support.html">e-Ink PDF Transfer &amp; Support Center</a></li>
          <li><a href="/about.html">About Notebook Studio &amp; Editorial Process</a></li>
          <li><a href="/contact.html">Contact Notebook Studio Customer Support</a></li>
        </ul>
      </aside>
    </div>
  </main>

  <footer class="site-footer">
    <div class="container footer-grid">
      <div>
        <div class="brand-lockup" style="margin-bottom: 0.5rem;">
          <img src="../../assets/icons/app-logo.svg" alt="Notebook Studio Logo" class="brand-logo" width="32" height="32" loading="lazy">
          <span>Notebook Studio: PDF Designer</span>
        </div>
        <p>© 2026 notebook-studio.com (Notebook Studio). All rights reserved. • Built for iPhone, iPad &amp; Mac.</p>
        <p style="margin-top: 0.25rem;">
          <a href="/about.html">About notebook-studio.com</a> · <a href="/contact.html">Contact</a> · <a href="mailto:support@notebook-studio.com" style="color: var(--brand-accent); font-weight: 600;">support@notebook-studio.com</a>
        </p>
      </div>

      <ul class="footer-links">
        <li><a href="/">Home</a></li>
        <li><a href="https://apps.apple.com/gb/app/notebook-studio-pdf-designer/id6811397092" target="_blank" rel="noopener noreferrer">App Store ($6.99)</a></li>
        <li><a href="/pricing.html">Pricing</a></li>
        <li><a href="/blog">Blog</a></li>
        <li><a href="/about.html">About notebook-studio.com</a></li>
        <li><a href="/contact.html">Contact</a></li>
        <li><a href="/vs/ep-template-studio.html">vs Ep Template Studio</a></li>
        <li><a href="/support.html">Support Center</a></li>
        <li><a href="/privacy.html">Privacy Policy</a></li>
      </ul>
    </div>
  </footer>

  <!-- Live 60s revalidation from https://api.heycatch.ai/v1/articles/${slug}?key=hck_lv_c8fc952c1efb370b5f7aa1f4 -->
  <script type="module">
    import {
      getSiteBasePath,
      initBlogNavigation,
      renderBlogArticlePage
    } from '../../assets/js/heycatch-blog.js';

    const root = document.documentElement;
    const toggleBtn = document.getElementById('theme-toggle-btn');
    const savedTheme = localStorage.getItem('ns-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      root.setAttribute('data-theme', savedTheme);
    }
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const current = root.getAttribute('data-theme');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const effectiveDark = current ? current === 'dark' : systemDark;
        const nextTheme = effectiveDark ? 'light' : 'dark';
        root.setAttribute('data-theme', nextTheme);
        localStorage.setItem('ns-theme', nextTheme);
      });
    }

    initBlogNavigation();
    const mountEl = document.getElementById('blog-post-mount');
    const basePath = getSiteBasePath();
    renderBlogArticlePage(mountEl, ${JSON.stringify(article.slug || article.id)}, { basePath });
  </script>
</body>
</html>
`;
}

function buildIndexListHtml(articles, linkPrefix) {
  if (!articles || articles.length === 0) {
    return `<div class="blog-empty-state">
          <p>No articles yet</p>
        </div>`;
  }

  const items = articles
    .map((article) => {
      const slug = encodeURIComponent(article.slug || article.id || '');
      const title = escapeHtml(article.title || 'Untitled article');
      const pubDate = article.published || article.published_at || '';
      const formattedDate = escapeHtml(formatPublishedDate(pubDate));
      const readTime = typeof article.read_time === 'number' && article.read_time > 0 ? `${article.read_time} min read` : '';
      return `<li class="blog-index-item">
            <a href="${linkPrefix}/${slug}" class="blog-index-link">${title}</a>
            <p class="byline" style="font-size: 0.82rem; margin: 0.15rem 0;">By <a href="https://notebook-studio.com/author/elena-vance" rel="author">Elena Vance</a> · Reviewed by <a href="https://notebook-studio.com/author/marcus-reed" rel="author">Marcus Reed</a></p>
            <div class="blog-meta">
              ${pubDate ? `<time datetime="${escapeHtml(pubDate)}">${formattedDate}</time>` : ''}
              ${pubDate && readTime ? '<span aria-hidden="true">•</span>' : ''}
              ${readTime ? `<span>${escapeHtml(readTime)}</span>` : ''}
            </div>
          </li>`;
    })
    .join('\n          ');

  return `<ul class="blog-index-list">
          ${items}
        </ul>`;
}

async function main() {
  const rootDir = process.cwd();
  const articles = await fetchAllArticles();
  console.log(`Fetched ${articles.length} article(s) from HeyCatch API.`);

  for (const [relFile, linkPrefix] of [
    ['blog/index.html', '/blog'],
    ['blog.html', '/blog']
  ]) {
    const filePath = path.join(rootDir, relFile);
    let html = await fs.readFile(filePath, 'utf8');
    const listMarkup = buildIndexListHtml(articles, linkPrefix);
    html = html.replace(
      /(<div id="blog-list-region" aria-live="polite" class="blog-index-region">)[\s\S]*?(<\/div>\s*(?:<aside[\s\S]*?<\/aside>\s*)?<\/div>\s*<\/main>)/,
      `$1\n        ${listMarkup}\n      $2`
    );
    await fs.writeFile(filePath, html, 'utf8');
  }

  for (const summary of articles) {
    const slug = summary.slug || summary.id;
    if (!slug) continue;
    const fullArticle = (await fetchFullArticle(slug)) || summary;
    const pageHtml = buildArticlePageHtml(fullArticle);

    const slugDir = path.join(rootDir, 'blog', slug);
    await fs.mkdir(slugDir, { recursive: true });
    await fs.writeFile(path.join(slugDir, 'index.html'), pageHtml, 'utf8');

    const flatHtml = pageHtml
      .replace(/(href|src)="\.\.\/\.\.\//g, '$1="../')
      .replace(/from '\.\.\/\.\.\/assets\/js\/heycatch-blog\.js'/g, "from '../assets/js/heycatch-blog.js'");
    await fs.writeFile(path.join(rootDir, 'blog', `${slug}.html`), flatHtml, 'utf8');
    console.log(`Generated static route for /blog/${slug}`);
  }

  async function getFileDate(relFile) {
    try {
      const st = await fs.stat(path.join(rootDir, relFile));
      return st.mtime.toISOString().slice(0, 10);
    } catch {
      return '2026-10-26';
    }
  }

  const sitemapPath = path.join(rootDir, 'sitemap.xml');
  const articleEntries = articles
    .map((a) => {
      const slug = encodeURIComponent(a.slug || a.id || '');
      const lastmod = (a.updated || a.published || '2026-10-25').slice(0, 10);
      return `  <url>
    <loc>${PRODUCTION_ORIGIN}/blog/${slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    })
    .join('\n');

  const latestBlogMod = articles.length > 0
    ? (articles[0].updated || articles[0].published || '2026-10-25').slice(0, 10)
    : await getFileDate('blog/index.html');

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${PRODUCTION_ORIGIN}/</loc>
    <lastmod>${await getFileDate('index.html')}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${PRODUCTION_ORIGIN}/pricing.html</loc>
    <lastmod>${await getFileDate('pricing.html')}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${PRODUCTION_ORIGIN}/blog</loc>
    <lastmod>${latestBlogMod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
${articleEntries ? `${articleEntries}\n` : ''}  <url>
    <loc>${PRODUCTION_ORIGIN}/author/elena-vance</loc>
    <lastmod>${await getFileDate('author/elena-vance/index.html')}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${PRODUCTION_ORIGIN}/author/marcus-reed</loc>
    <lastmod>${await getFileDate('author/marcus-reed/index.html')}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${PRODUCTION_ORIGIN}/about.html</loc>
    <lastmod>${await getFileDate('about.html')}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${PRODUCTION_ORIGIN}/contact.html</loc>
    <lastmod>${await getFileDate('contact.html')}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${PRODUCTION_ORIGIN}/vs/ep-template-studio.html</loc>
    <lastmod>${await getFileDate('vs/ep-template-studio.html')}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${PRODUCTION_ORIGIN}/remarkable-planner-designer.html</loc>
    <lastmod>${await getFileDate('remarkable-planner-designer.html')}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${PRODUCTION_ORIGIN}/kindle-scribe-planner-designer.html</loc>
    <lastmod>${await getFileDate('kindle-scribe-planner-designer.html')}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${PRODUCTION_ORIGIN}/support.html</loc>
    <lastmod>${await getFileDate('support.html')}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${PRODUCTION_ORIGIN}/privacy.html</loc>
    <lastmod>${await getFileDate('privacy.html')}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>
`;
  await fs.writeFile(sitemapPath, sitemapXml, 'utf8');
  console.log('Updated sitemap.xml');
}

main().catch((err) => {
  console.error(err);
  process.exit(0);
});
