/**
 * HeyCatch Blog Integration for Notebook Studio
 * Follows https://heycatch.ai/blog-agents.md and SEO Audit requirements:
 * - Publishable read-only key sent exclusively via ?key= query parameter (no custom headers)
 * - Short 60-second cache revalidation with stale-if-error fallback and single 429 Retry-After retry
 * - Pagination loop fetching all articles (limit=50, offset += 50 until offset >= total)
 * - HTML sanitisation preserving h2[id] for Table of Contents and stripping script/style/iframe/on*/javascript:
 * - Automatic Table of Contents inserted right after Key takeaways list (or top of content_html)
 * - Named author bylines, Person JSON-LD, editorial process disclosure, self-contained paragraphs, and Related block
 */

export const HEYCATCH_API_KEY = 'hck_lv_c8fc952c1efb370b5f7aa1f4';
export const HEYCATCH_API_BASE = 'https://api.heycatch.ai/v1';
export const PRODUCTION_ORIGIN = 'https://notebook-studio.com';
const OG_IMAGE = `${PRODUCTION_ORIGIN}/assets/marketing/og-card-1200x630.jpg`;
const CACHE_TTL_MS = 60 * 1000;

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

export function getSiteBasePath() {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/notebook-studio-website')) {
    return '/notebook-studio-website';
  }
  return '';
}

const ALLOWED_TAGS = new Set([
  'H2', 'H3', 'H4', 'H5', 'H6',
  'P', 'UL', 'OL', 'LI',
  'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'CAPTION',
  'BLOCKQUOTE', 'A', 'STRONG', 'B', 'EM', 'I', 'CODE', 'PRE',
  'HR', 'BR', 'SPAN', 'SUP', 'SUB', 'DEL', 'FIGURE', 'FIGCAPTION', 'IMG'
]);

const ALLOWED_ATTRS = new Set([
  'id', 'href', 'title', 'target', 'rel',
  'colspan', 'rowspan', 'scope', 'src', 'alt', 'width', 'height', 'loading', 'lang', 'dir'
]);

const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur']);

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

function getCache(cacheKey) {
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function setCache(cacheKey, data) {
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      data
    }));
  } catch (_) {
    // Ignore storage quota errors
  }
}

async function heycatchFetch(endpointPath, params = {}) {
  const url = new URL(`${HEYCATCH_API_BASE}${endpointPath}`);
  url.searchParams.set('key', HEYCATCH_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const requestUrl = url.toString();
  const cacheKey = `hc_blog_${requestUrl}`;
  const cached = getCache(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { status: 200, data: cached.data, fromCache: true };
  }

  async function attemptFetch() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(requestUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  try {
    let res = await attemptFetch();

    if (res.status === 429) {
      const retryAfterHeader = res.headers.get('Retry-After');
      const waitSec = Math.min(Math.max(parseInt(retryAfterHeader || '2', 10) || 2, 1), 15);
      await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
      res = await attemptFetch();
    }

    if (res.status === 404 || res.status === 403 || res.status === 401) {
      return { status: res.status, data: null };
    }

    if (!res.ok) {
      if (cached) return { status: 200, data: cached.data, stale: true };
      return { status: res.status, data: null };
    }

    const data = await res.json();
    setCache(cacheKey, data);
    return { status: 200, data };
  } catch (_) {
    if (cached) {
      return { status: 200, data: cached.data, stale: true };
    }
    return { status: 0, data: null };
  }
}

export async function fetchAllArticles() {
  const limit = 50;
  let offset = 0;
  const allArticles = [];
  let total = 0;

  while (true) {
    const res = await heycatchFetch('/articles', { limit, offset });
    if (res.status !== 200 || !res.data || !Array.isArray(res.data.articles)) {
      if (allArticles.length > 0) break;
      return { ok: false, status: res.status, articles: [], total: 0 };
    }

    const batch = res.data.articles;
    total = typeof res.data.total === 'number' ? res.data.total : batch.length;
    allArticles.push(...batch);

    offset += limit;
    if (batch.length === 0 || allArticles.length >= total || batch.length < limit) {
      break;
    }
  }

  return { ok: true, status: 200, articles: allArticles, total };
}

export async function fetchArticleBySlug(slug) {
  const encodedSlug = encodeURIComponent(slug);
  return heycatchFetch(`/articles/${encodedSlug}`);
}

let domPurifyPromise = null;
async function getDOMPurify() {
  if (!domPurifyPromise) {
    domPurifyPromise = import('https://esm.sh/dompurify@3.1.7')
      .then((mod) => mod.default || mod)
      .catch(() => null);
  }
  return domPurifyPromise;
}

export async function sanitizeArticleHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  let htmlToParse = polishHabitTrackerHtml(rawHtml);
  const DOMPurify = await getDOMPurify();
  if (DOMPurify && typeof DOMPurify.sanitize === 'function') {
    htmlToParse = DOMPurify.sanitize(htmlToParse, {
      ALLOWED_TAGS: Array.from(ALLOWED_TAGS).map((t) => t.toLowerCase()),
      ALLOWED_ATTR: Array.from(ALLOWED_ATTRS),
      ALLOW_DATA_ATTR: false
    });
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${htmlToParse}</div>`, 'text/html');
  const root = doc.body.firstElementChild;

  function cleanNode(node) {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toUpperCase();
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME' || tag === 'OBJECT' || tag === 'EMBED' || tag === 'FORM') {
          child.remove();
          continue;
        }
        if (!ALLOWED_TAGS.has(tag)) {
          cleanNode(child);
          while (child.firstChild) {
            node.insertBefore(child.firstChild, child);
          }
          child.remove();
          continue;
        }

        const attrs = Array.from(child.attributes);
        for (const attr of attrs) {
          const name = attr.name.toLowerCase();
          const val = (attr.value || '').trim();
          if (name.startsWith('on') || !ALLOWED_ATTRS.has(name)) {
            child.removeAttribute(attr.name);
            continue;
          }
          if (name === 'href' || name === 'src') {
            const lowerVal = val.toLowerCase().replace(/\s+/g, '');
            if (lowerVal.startsWith('javascript:') || lowerVal.startsWith('vbscript:') || lowerVal.startsWith('data:text/html')) {
              child.removeAttribute(attr.name);
              continue;
            }
          }
          if (name === 'id' && tag !== 'H2' && tag !== 'H3' && tag !== 'H4') {
            child.removeAttribute('id');
          }
        }

        if (tag === 'A') {
          const href = child.getAttribute('href') || '';
          if (/^https?:\/\//i.test(href) && !href.startsWith(PRODUCTION_ORIGIN)) {
            child.setAttribute('rel', 'noopener noreferrer');
          }
        }

        cleanNode(child);
      } else if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
      }
    }
  }

  if (root) {
    cleanNode(root);
    return root.innerHTML;
  }
  return '';
}

export function formatPublishedDate(dateStr) {
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
  } catch (_) {
    return dateStr;
  }
}

export function buildArticleFragmentWithToc(sanitizedHtml) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = sanitizedHtml;

  const allH2s = Array.from(wrapper.querySelectorAll('h2'));
  const tocItems = [];

  for (const h2 of allH2s) {
    const rawId = h2.getAttribute('id');
    if (!rawId) continue;
    if (rawId.trim().toLowerCase() === 'faq') continue;
    const text = (h2.textContent || '').trim();
    if (!text) continue;
    tocItems.push({ id: rawId, text });
  }

  if (tocItems.length > 0) {
    const tocNav = document.createElement('nav');
    tocNav.className = 'blog-toc';
    tocNav.setAttribute('aria-label', 'Table of contents');

    const tocHeading = document.createElement('h2');
    tocHeading.className = 'blog-toc-title';
    tocHeading.textContent = 'Table of contents';
    tocNav.appendChild(tocHeading);

    const tocList = document.createElement('ol');
    tocList.className = 'blog-toc-list';

    for (const item of tocItems) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.setAttribute('href', `#${item.id}`);
      a.textContent = item.text;
      li.appendChild(a);
      tocList.appendChild(li);
    }
    tocNav.appendChild(tocList);

    const keyTakeawaysH2 = allH2s.find(
      (h) => !h.getAttribute('id') && (h.textContent || '').trim().toLowerCase() === 'key takeaways'
    );

    if (keyTakeawaysH2) {
      let insertAfterEl = keyTakeawaysH2;
      let nextEl = keyTakeawaysH2.nextElementSibling;
      while (nextEl && (nextEl.tagName === 'UL' || nextEl.tagName === 'OL')) {
        insertAfterEl = nextEl;
        break;
      }
      insertAfterEl.insertAdjacentElement('afterend', tocNav);
    } else {
      wrapper.insertBefore(tocNav, wrapper.firstChild);
    }
  }

  return wrapper;
}

export function updateArticleHeadMeta(article) {
  const slug = encodeURIComponent(article.slug || '');
  const canonicalUrl = `${PRODUCTION_ORIGIN}/blog/${slug}`;
  const title = article.title || 'e-Ink & iPad Digital Planner Blog — Notebook Studio';
  const metaDesc = article.meta_description || 'Match your habit tracker planner layout to daily, weekly, or quota habits — and build a hyperlinked monthly spread calibrated for e-ink.';

  document.title = title;

  function setMeta(selector, attrName, attrValue, contentValue) {
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrValue);
      document.head.appendChild(el);
    }
    el.setAttribute('content', contentValue);
  }

  setMeta('meta[name="robots"]', 'name', 'robots', 'index, follow');
  setMeta('meta[name="description"]', 'name', 'description', metaDesc);
  setMeta('meta[property="og:title"]', 'property', 'og:title', title);
  setMeta('meta[property="og:description"]', 'property', 'og:description', metaDesc);
  setMeta('meta[property="og:type"]', 'property', 'og:type', 'article');
  setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
  setMeta('meta[property="og:image"]', 'property', 'og:image', OG_IMAGE);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', metaDesc);
  setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', OG_IMAGE);

  let canonicalEl = document.head.querySelector('link[rel="canonical"]');
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', canonicalUrl);

  const existingLd = document.getElementById('heycatch-article-jsonld');
  if (existingLd) existingLd.remove();

  if (article.jsonLd && typeof article.jsonLd === 'object' && Object.keys(article.jsonLd).length > 0) {
    const ldCopy = { ...article.jsonLd };
    ldCopy.url = canonicalUrl;
    ldCopy.mainEntityOfPage = canonicalUrl;
    ldCopy.image = OG_IMAGE;
    ldCopy.author = ELENA_PERSON;
    ldCopy.reviewedBy = MARCUS_PERSON;
    const ldScript = document.createElement('script');
    ldScript.type = 'application/ld+json';
    ldScript.id = 'heycatch-article-jsonld';
    ldScript.textContent = JSON.stringify(ldCopy).replace(/</g, '\\u003c');
    document.head.appendChild(ldScript);
  }
}

export async function initBlogNavigation() {
  const navItems = document.querySelectorAll('.nav-blog-item');
  if (navItems.length === 0) return;

  const res = await heycatchFetch('/articles', { limit: 1, offset: 0 });
  const hasArticles = res.status === 200 && res.data && typeof res.data.total === 'number' && res.data.total > 0;

  navItems.forEach((el) => {
    if (hasArticles) {
      el.removeAttribute('hidden');
    } else if (res.status === 200) {
      el.setAttribute('hidden', '');
    }
  });
}

function createRelatedAsideElement() {
  const aside = document.createElement('aside');
  aside.setAttribute('aria-label', 'Related');
  aside.className = 'related-guides-block';
  aside.innerHTML = `
    <h2>Related</h2>
    <ul>
      <li><a href="/blog/habit-tracker-planner-layouts-e-ink">Habit Tracker Planner: Matching Layouts to Habit Types</a></li>
      <li><a href="/remarkable-planner-designer.html">reMarkable Paper Pro &amp; reMarkable 2 PDF Planner Guide</a></li>
      <li><a href="/kindle-scribe-planner-designer.html">Kindle Scribe 300 PPI Hyperlinked PDF Planner Guide</a></li>
      <li><a href="/vs/ep-template-studio.html">Notebook Studio vs Ep Template Studio Comparison</a></li>
      <li><a href="/pricing.html">Notebook Studio Pricing ($6.99 One-Time Purchase)</a></li>
      <li><a href="/support.html">e-Ink PDF Transfer &amp; Support Center</a></li>
      <li><a href="/about.html">About Notebook Studio &amp; Editorial Process</a></li>
      <li><a href="/contact.html">Contact Notebook Studio Customer Support</a></li>
    </ul>
  `;
  return aside;
}

export async function renderBlogIndexPage(mountEl, { basePath = getSiteBasePath(), onNavigateSlug = null } = {}) {
  const hasPrerenderedList = Boolean(mountEl.querySelector('.blog-index-list'));
  if (!hasPrerenderedList) {
    mountEl.innerHTML = `
      <nav aria-label="Breadcrumb" class="breadcrumb-nav">
        <ol>
          <li><a href="/">Home</a></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">Blog</li>
        </ol>
      </nav>
      <div class="section-header" style="margin-bottom: 2.5rem;">
        <div class="eyebrow-pill">Notebook Studio Journal</div>
        <h1 class="section-title">e-Ink &amp; iPad Digital Planner Blog</h1>
        <p class="section-subtitle">The Notebook Studio Blog is a technical publication covering 1:1 e-Ink PDF planner layouts, habit tracker calibration, and hyperlinked workflows.</p>
      </div>
      <div id="blog-list-region" aria-live="polite" class="blog-index-region">
        <p class="blog-loading-text">Loading articles…</p>
      </div>
    `;
  }

  const listRegion = mountEl.querySelector('#blog-list-region') || mountEl;
  const result = await fetchAllArticles();

  if (!result.ok) {
    return;
  }

  if (result.articles.length === 0) {
    listRegion.innerHTML = `
      <div class="blog-empty-state">
        <p>No articles yet</p>
      </div>
    `;
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(result.articles.length / pageSize));
  const currentPage = Math.min(Math.max(parseInt(params.get('page') || '1', 10) || 1, 1), totalPages);
  const pageArticles = result.articles.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const ul = document.createElement('ul');
  ul.className = 'blog-index-list';

  for (const article of pageArticles) {
    const li = document.createElement('li');
    li.className = 'blog-index-item';

    const imageUrl = (article.hero_image_url || article.featured_image || '').trim();
    if (imageUrl) {
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = article.title || '';
      img.className = 'blog-index-image';
      img.loading = 'lazy';
      li.appendChild(img);
    }

    const link = document.createElement('a');
    const encodedSlug = encodeURIComponent(article.slug || article.id || '');
    const href = `${basePath}/blog/${encodedSlug}`;
    link.href = href;
    link.className = 'blog-index-link';
    link.textContent = article.title || 'Untitled article';

    if (typeof onNavigateSlug === 'function') {
      link.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onNavigateSlug(article.slug || article.id);
      });
    }

    const bylineP = document.createElement('p');
    bylineP.className = 'byline';
    bylineP.style.fontSize = '0.82rem';
    bylineP.style.margin = '0.15rem 0';
    bylineP.innerHTML = `By <a href="https://notebook-studio.com/author/elena-vance" rel="author">Elena Vance</a> · Reviewed by <a href="https://notebook-studio.com/author/marcus-reed" rel="author">Marcus Reed</a>`;

    const metaDiv = document.createElement('div');
    metaDiv.className = 'blog-meta';

    const pubDate = article.published || article.published_at || '';
    if (pubDate) {
      const timeEl = document.createElement('time');
      timeEl.setAttribute('datetime', pubDate);
      timeEl.textContent = formatPublishedDate(pubDate);
      metaDiv.appendChild(timeEl);
    }

    if (typeof article.read_time === 'number' && article.read_time > 0) {
      if (metaDiv.childNodes.length > 0) {
        const sep = document.createElement('span');
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = '•';
        metaDiv.appendChild(sep);
      }
      const rtSpan = document.createElement('span');
      rtSpan.textContent = `${article.read_time} min read`;
      metaDiv.appendChild(rtSpan);
    }

    li.appendChild(link);
    li.appendChild(bylineP);
    li.appendChild(metaDiv);
    ul.appendChild(li);
  }

  listRegion.innerHTML = '';
  listRegion.appendChild(ul);

  if (!mountEl.querySelector('.related-guides-block')) {
    mountEl.appendChild(createRelatedAsideElement());
  }
}

export async function renderBlogArticlePage(mountEl, slug, { basePath = getSiteBasePath(), onBackToIndex = null } = {}) {
  const hasPrerenderedArticle = Boolean(mountEl.querySelector('.blog-article'));
  if (!hasPrerenderedArticle) {
    mountEl.innerHTML = `
      <div class="blog-article-loading" aria-live="polite">
        <p class="blog-loading-text">Loading article…</p>
      </div>
    `;
  }

  const res = await fetchArticleBySlug(slug);

  if (res.status === 404 || (!res.data && !hasPrerenderedArticle)) {
    document.title = 'Page Not Found — Notebook Studio PDF App';
    mountEl.innerHTML = `
      <div class="blog-404-card">
        <div class="eyebrow-pill">404 • Page Not Found</div>
        <h1 style="font-size: clamp(2rem, 1.5rem + 2vw, 3rem); font-weight: 900; margin-bottom: 0.75rem;">
          This article could not be found.
        </h1>
        <p style="color: var(--text-secondary); margin-bottom: 1.75rem;">
          The requested article URL does not exist on Notebook Studio or may have moved to the main blog index.
        </p>
        <div style="display: flex; flex-wrap: wrap; gap: 0.85rem; justify-content: center;">
          <a href="${basePath}/blog" class="btn btn-primary">Back to Blog</a>
          <a href="${basePath}/" class="btn btn-secondary">Notebook Studio Home</a>
        </div>
      </div>
    `;
    return { found: false, status: 404 };
  }

  if (!res.data || !res.data.article) {
    return { found: true, status: 200 };
  }

  const article = res.data.article;
  updateArticleHeadMeta(article);

  const sanitizedHtml = await sanitizeArticleHtml(article.content_html || '');
  const contentWithToc = buildArticleFragmentWithToc(sanitizedHtml);

  const breadcrumbNav = document.createElement('nav');
  breadcrumbNav.className = 'breadcrumb-nav';
  breadcrumbNav.setAttribute('aria-label', 'Breadcrumb');
  breadcrumbNav.innerHTML = `
    <ol>
      <li><a href="/">Home</a></li>
      <li aria-hidden="true">/</li>
      <li><a href="${basePath}/blog">Blog</a></li>
      <li aria-hidden="true">/</li>
      <li aria-current="page">${article.title || ''}</li>
    </ol>
  `;

  const articleEl = document.createElement('article');
  articleEl.className = 'blog-article';

  const lang = (article.language || '').trim();
  if (lang && lang.toLowerCase() !== 'en') {
    articleEl.setAttribute('lang', lang);
    const baseLang = lang.toLowerCase().split('-')[0];
    if (RTL_LANGS.has(baseLang)) {
      articleEl.setAttribute('dir', 'rtl');
    }
  }

  const backWrap = document.createElement('div');
  backWrap.className = 'blog-back-row';
  const backLink = document.createElement('a');
  backLink.href = `${basePath}/blog`;
  backLink.className = 'blog-back-link';
  backLink.textContent = '← Back to Blog';
  if (typeof onBackToIndex === 'function') {
    backLink.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      onBackToIndex();
    });
  }
  backWrap.appendChild(backLink);
  articleEl.appendChild(backWrap);

  const headerEl = document.createElement('header');
  headerEl.className = 'blog-article-header';

  const h1 = document.createElement('h1');
  h1.className = 'blog-article-title';
  h1.textContent = article.title || '';

  const bylineP = document.createElement('p');
  bylineP.className = 'byline';
  bylineP.innerHTML = `By <a href="https://notebook-studio.com/author/elena-vance" rel="author">Elena Vance</a> (Senior Digital Stationery Editor) · Reviewed by <a href="https://notebook-studio.com/author/marcus-reed" rel="author">Marcus Reed</a> (Lead e-Ink Hardware Reviewer)`;

  const metaDiv = document.createElement('div');
  metaDiv.className = 'blog-meta';

  const pubDate = article.published || article.published_at || '';
  if (pubDate) {
    const timeEl = document.createElement('time');
    timeEl.setAttribute('datetime', pubDate);
    timeEl.textContent = formatPublishedDate(pubDate);
    metaDiv.appendChild(timeEl);
  }

  if (typeof article.read_time === 'number' && article.read_time > 0) {
    if (metaDiv.childNodes.length > 0) {
      const sep = document.createElement('span');
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = '•';
      metaDiv.appendChild(sep);
    }
    const rtSpan = document.createElement('span');
    rtSpan.textContent = `${article.read_time} min read`;
    metaDiv.appendChild(rtSpan);
  }

  headerEl.appendChild(h1);
  headerEl.appendChild(bylineP);
  headerEl.appendChild(metaDiv);
  articleEl.appendChild(headerEl);

  const heroUrl = (article.hero_image_url || article.featured_image || '').trim();
  if (heroUrl) {
    const heroImg = document.createElement('img');
    heroImg.src = heroUrl;
    heroImg.alt = article.title || '';
    heroImg.className = 'blog-article-hero-image';
    articleEl.appendChild(heroImg);
  }

  const proseDiv = document.createElement('div');
  proseDiv.className = 'blog-prose';
  while (contentWithToc.firstChild) {
    proseDiv.appendChild(contentWithToc.firstChild);
  }
  articleEl.appendChild(proseDiv);

  const disclosureSec = document.createElement('section');
  disclosureSec.className = 'editorial-disclosure';
  disclosureSec.setAttribute('aria-label', 'Editorial and AI process disclosure');
  disclosureSec.innerHTML = `
    <h2>Editorial &amp; AI-Assisted Process Disclosure</h2>
    <p>Notebook Studio articles combine AI-assisted topic outlining with hands-on human layout engineering. <a href="https://notebook-studio.com/author/elena-vance">Elena Vance</a> writes and edits each planner layout guide, and <a href="https://notebook-studio.com/author/marcus-reed">Marcus Reed</a> verifies every PPI resolution, cell dimension, and PDF hyperlink specification on physical reMarkable Paper Pro, reMarkable 2, and Amazon Kindle Scribe hardware prior to publication.</p>
  `;
  articleEl.appendChild(disclosureSec);

  mountEl.innerHTML = '';
  mountEl.appendChild(breadcrumbNav);
  mountEl.appendChild(articleEl);
  mountEl.appendChild(createRelatedAsideElement());
  return { found: true, status: 200, article };
}
