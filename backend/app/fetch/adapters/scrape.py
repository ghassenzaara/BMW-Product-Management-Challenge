"""Scraped sources (plain HTTP, steps 5 to 7).

- XenForo forums (tmc, genesis-owners, lucid-owners): thread list -> threads ->
  posts, following ``<link rel="next">`` on every page (fetching-sources 3.9).
  One record per post.
- Expert review pages (magazines, step 7): one record per model page, URL from
  the slug of the subject on that site (fetching-sources 3.10).
- kbb: consumer reviews from the page's ``__NEXT_DATA__`` JSON.
"""

from __future__ import annotations

import json
import re
from urllib.parse import urljoin

from selectolax.lexbor import LexborHTMLParser

from app.fetch.adapters.base import FetchContext, FetchResult, adapter, cursor_key
from app.fetch.records import text_record
from app.fetch.subjects import Subject, author_hash

# Forum per competitor, from fetching-sources.md 3.4 and 3.9.
FORUMS = {
    "tmc": {"Tesla Model S": "https://teslamotorsclub.com/tmc/forums/model-s.73/"},
    "genesis-owners": {
        "Genesis G80": "https://www.genesisowners.com/genesis-forum/forums/genesis-g80-forum-g80-ev-forum-g80forum-com.107/",
        "Genesis G90": "https://www.genesisowners.com/genesis-forum/forums/genesis-g90-2023-second-generation.161/",
    },
    "lucid-owners": {"Lucid Air": "https://lucidowners.com/forums/air-bugs-issues-support.134/"},
}
MAGAZINES = {
    "caranddriver": ("https://www.caranddriver.com/{slug}", "US", "en"),
    "motortrend": ("https://www.motortrend.com/cars/{slug}/", "US", "en"),
    "autocar": ("https://www.autocar.co.uk/car-review/{slug}", "GB", "en"),
    "autoexpress": ("https://www.autoexpress.co.uk/{slug}", "GB", "en"),
    "topgear": ("https://www.topgear.com/car-reviews/{slug}", "GB", "en"),
    "drive-uk": ("https://www.drive.co.uk/cars/{slug}/review", "GB", "en"),
    "whatcar": ("https://www.whatcar.com/{slug}/review/", "GB", "en"),
    "carwow": ("https://www.carwow.co.uk/{slug}", "GB", "en"),
    "parkers": ("https://www.parkers.co.uk/{slug}/review/", "GB", "en"),
}
_WS = re.compile(r"\s+")


def _html(text: str) -> LexborHTMLParser:
    return LexborHTMLParser(text)


def _next(tree, base: str) -> str | None:
    link = tree.css_first('link[rel="next"]')
    return urljoin(base, link.attributes["href"]) if link and link.attributes.get("href") else None


def parse_thread_list(html: str, base: str) -> tuple[list[dict], str | None]:
    tree = _html(html)
    threads = []
    for item in tree.css(".structItem--thread"):
        a = item.css_first(".structItem-title a[data-tp-primary]") or item.css_first(".structItem-title a")
        latest = item.css_first("time.structItem-latestDate")
        if a and a.attributes.get("href"):
            threads.append({"url": urljoin(base, a.attributes["href"]), "title": a.text(strip=True),
                            "latest": int(latest.attributes.get("data-timestamp", 0)) if latest else 0})
    return threads, _next(tree, base)


def parse_thread(html: str, base: str) -> tuple[list[dict], str | None]:
    tree = _html(html)
    title = tree.css_first("h1")
    posts = []
    for art in tree.css("article.message"):
        body = art.css_first(".bbWrapper")
        when = art.css_first("time.u-dt")
        if not body:
            continue
        for quote in body.css("blockquote"):  # quoted earlier posts are not this author's statement
            quote.decompose()
        text = _WS.sub(" ", body.text(separator=" ")).strip()
        if text:
            posts.append({"id": art.attributes.get("data-content", "").replace("post-", ""),
                          "author": art.attributes.get("data-author"), "text": text,
                          "published": when.attributes.get("datetime") if when else None,
                          "thread_title": title.text(strip=True) if title else None})
    return posts, _next(tree, base)


def _xenforo(ctx: FetchContext, source: dict, subject: Subject, cursor: dict) -> FetchResult:
    out = FetchResult()
    start = FORUMS.get(source["source_id"], {}).get(subject.label)
    if not start:
        return out
    newest_seen = int(cursor.get(cursor_key(subject), 0))
    top = newest_seen
    url, pages = start, 0
    host = re.match(r"https?://[^/]+", start).group(0)
    while url and pages < ctx.max_pages:
        r = ctx.client.get(url, source_id=source["source_id"])
        out.requests += 1
        pages += 1
        threads, url = parse_thread_list(r.text, host)
        if not ctx.backfill:
            threads = [t for t in threads if t["latest"] > newest_seen]
            if not threads:
                break
        for t in threads:
            top = max(top, t["latest"])
            turl, tpages = t["url"], 0
            while turl and tpages < (ctx.max_pages if ctx.backfill else 3):
                tr = ctx.client.get(turl, source_id=source["source_id"])
                out.requests += 1
                tpages += 1
                posts, turl = parse_thread(tr.text, host)
                thread_id = re.search(r"\.(\d+)/", t["url"]).group(1) if re.search(r"\.(\d+)/", t["url"]) else t["url"]
                for p in posts:
                    out.records.append(text_record(
                        source=source, subject=subject, record_id=f"{source['source_id']}-post-{p['id']}",
                        response=tr, text=p["text"], url=f"{t['url']}post-{p['id']}", category="C",
                        content_type="owner", title=p["thread_title"] or t["title"], published_at=p["published"],
                        search_term=subject.label, thread_id=thread_id,
                        author_hash=author_hash(source["source_id"], p["author"]), country="US",
                        run_id=ctx.run_id))
    out.cursor[cursor_key(subject)] = top
    return out


adapter("tmc", "genesis-owners", "lucid-owners")(_xenforo)


def article_text(html: str) -> tuple[str | None, str]:
    """Title and paragraphs of an article page. Sites that render the text in the browser
    (TopGear: review sections only in ``__NEXT_DATA__``) fall back to the JSON-LD
    ``articleBody`` and then to the prose strings of the page's Next.js data."""
    tree = _html(html)
    for bad in tree.css("script, style, nav, header, footer, aside, form, noscript"):
        bad.decompose()
    title = tree.css_first("h1")
    root = tree.css_first("article") or tree.css_first("main") or tree.body
    paragraphs = [_WS.sub(" ", p.text()).strip() for p in (root.css("p") if root else [])]
    text = "\n\n".join(p for p in paragraphs if len(p) > 40)
    if len(text) < 200:
        text = _embedded_text(html) or text
    return (title.text(strip=True) if title else None), text


def _prose(fragment: str) -> list[str]:
    """Paragraphs of an HTML fragment (or plain text) longer than 40 characters."""
    tree = _html(f"<body>{fragment}</body>")
    parts = [_WS.sub(" ", p.text()).strip() for p in tree.css("p")] or [_WS.sub(" ", tree.body.text()).strip()]
    return [p for p in parts if len(p) > 40]


def _embedded_text(html: str) -> str:
    for m in re.finditer(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', html, re.S):
        try:
            data = json.loads(m.group(1))
        except ValueError:
            continue
        for node in data if isinstance(data, list) else data.get("@graph", [data]) if isinstance(data, dict) else []:
            if isinstance(node, dict) and isinstance(node.get("articleBody"), str) and len(node["articleBody"]) > 200:
                return "\n\n".join(_prose(node["articleBody"]))
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not m:
        return ""
    try:
        props = json.loads(m.group(1)).get("props", {}).get("pageProps", {})
    except ValueError:
        return ""
    found: list[str] = []

    def walk(node) -> None:
        if isinstance(node, dict):
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)
        elif isinstance(node, str) and len(node) > 200 and "<p" in node:
            found.extend(_prose(node))

    walk(props)
    return "\n\n".join(dict.fromkeys(found))


def _magazine(ctx: FetchContext, source: dict, subject: Subject, cursor: dict) -> FetchResult:
    out = FetchResult()
    pattern, country, language = MAGAZINES[source["source_id"]]
    for slug in subject.slugs.get(source["source_id"], []):
        if slug.endswith("/reviews/") and source["source_id"] != "parkers":
            continue
        url = pattern.format(slug=slug.rstrip("/").removesuffix("/reviews"))
        r = ctx.client.get(url, source_id=source["source_id"])
        out.requests += 1
        if r.status != 200:
            out.notes.append(f"{url}: HTTP {r.status}")
            continue
        title, text = article_text(r.text)
        if len(text) < 200:
            out.notes.append(f"{url}: no article text found")
            continue
        out.records.append(text_record(
            source=source, subject=subject, record_id=f"{source['source_id']}-{slug.replace('/', '-')}",
            response=r, text=text, url=url, category="D", content_type="expert", title=title,
            search_term=slug, country=country, language=language, run_id=ctx.run_id))
    return out


adapter(*MAGAZINES)(_magazine)


def _find_reviews(node, found: list) -> None:
    """Walk __NEXT_DATA__ and collect objects that look like consumer reviews."""
    if isinstance(node, dict):
        keys = set(node)
        text_key = next((k for k in ("reviewText", "text", "body", "comments") if isinstance(node.get(k), str)), None)
        if text_key and keys & {"rating", "overallRating", "ratingValue", "stars"} and len(node[text_key]) > 40:
            found.append(node)
        for v in node.values():
            _find_reviews(v, found)
    elif isinstance(node, list):
        for v in node:
            _find_reviews(v, found)


@adapter("kbb")
def kbb(ctx: FetchContext, source: dict, subject: Subject, cursor: dict) -> FetchResult:
    out = FetchResult()
    for slug in subject.slugs.get("kbb", []):
        years = [slug.rsplit("/", 1)[1]] if re.search(r"/\d{4}$", slug) else ["2025", "2024"]
        base = re.sub(r"/\d{4}$", "", slug)
        for year in years:
            url = f"https://www.kbb.com/{base}/{year}/consumer-reviews/"
            r = ctx.client.get(url, source_id="kbb")
            out.requests += 1
            m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', r.text, re.S)
            if not m:
                continue
            found: list = []
            _find_reviews(json.loads(m.group(1)), found)
            for i, rev in enumerate(found):
                text = next(rev[k] for k in ("reviewText", "text", "body", "comments") if isinstance(rev.get(k), str))
                rating = next((rev[k] for k in ("rating", "overallRating", "ratingValue", "stars") if k in rev), None)
                rid = rev.get("id") or rev.get("reviewId") or f"{year}-{i}"
                out.records.append(text_record(
                    source=source, subject=subject, record_id=f"kbb-{base.replace('/', '-')}-{rid}", response=r,
                    text=text, url=url, category="B", content_type="owner", title=rev.get("title"),
                    published_at=rev.get("date") or rev.get("submissionDate"), search_term=base, country="US",
                    rating_value=float(rating) if isinstance(rating, (int, float)) else None, rating_scale=5,
                    author_hash=author_hash("kbb", rev.get("author") or rev.get("nickname")),
                    model_year=year, run_id=ctx.run_id))
    return out
