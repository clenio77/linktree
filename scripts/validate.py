#!/usr/bin/env python3
"""Validate digital card MVP for production readiness."""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED_FILES = [
    "index.html",
    "css/style.css",
    "js/app.js",
    "i18n/pt.json",
    "i18n/en.json",
    "img/clenio.jpeg",
    "img/twitter.png",
    "img/insta.svg",
    "img/linkedin.svg",
    "img/github.svg",
    "img/whatsapp.png",
    "README.md",
]
URL_RE = re.compile(r"^(https?://|mailto:)", re.I)
errors: list[str] = []
warnings: list[str] = []


def fail(msg: str) -> None:
    errors.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        fail(f"Invalid JSON {path.relative_to(ROOT)}: {exc}")
        return {}


def collect_urls(node, bag: list[str]) -> None:
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "url" and isinstance(value, str):
                bag.append(value)
            else:
                collect_urls(value, bag)
    elif isinstance(node, list):
        for item in node:
            collect_urls(item, bag)


def check_files() -> None:
    for rel in REQUIRED_FILES:
        if not (ROOT / rel).exists():
            fail(f"Missing required file: {rel}")


def check_parity(pt: dict, en: dict) -> None:
    def keys(obj, prefix=""):
        out = set()
        if isinstance(obj, dict):
            for k, v in obj.items():
                path = f"{prefix}.{k}" if prefix else k
                if k in {"title", "description", "label", "name", "role", "bio", "url", "icon", "id"}:
                    out.add(path)
                out |= keys(v, path)
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                out |= keys(item, f"{prefix}[{i}]")
        return out

    pt_keys = keys(pt)
    en_keys = keys(en)
    missing_en = sorted(pt_keys - en_keys)
    missing_pt = sorted(en_keys - pt_keys)
    if missing_en:
        fail(f"EN missing keys present in PT: {missing_en}")
    if missing_pt:
        fail(f"PT missing keys present in EN: {missing_pt}")

    if len(pt.get("social", [])) != len(en.get("social", [])):
        fail("social list length differs between PT and EN")
    if len(pt.get("links", [])) != len(en.get("links", [])):
        fail("links list length differs between PT and EN")


def check_urls(messages: dict, label: str) -> None:
    urls: list[str] = []
    collect_urls(messages, urls)
    if not urls:
        fail(f"No URLs found in {label}")
        return
    for url in urls:
        if not url or not url.strip():
            fail(f"Empty URL in {label}")
        elif not URL_RE.match(url):
            fail(f"Invalid URL in {label}: {url!r}")


def check_html() -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    for needle in [
        'lang="pt"',
        'id="social-list"',
        'id="links-list"',
        'id="trust-list"',
        'data-lang="pt"',
        'data-lang="en"',
        "js/app.js",
        'meta name="description"',
        'profile.company',
    ]:
        if needle not in html:
            fail(f"index.html missing expected marker: {needle}")

    empty_hrefs = re.findall(r'href=""', html)
    if empty_hrefs:
        fail(f"Found {len(empty_hrefs)} empty href attributes in index.html")


def check_js() -> None:
    js = (ROOT / "js/app.js").read_text(encoding="utf-8")
    for needle in ["localStorage", "applyLanguage", "create-qr-code", "i18n/"]:
        if needle not in js:
            fail(f"js/app.js missing expected marker: {needle}")


def check_http(base: str) -> None:
    paths = [
        "/",
        "/index.html",
        "/css/style.css",
        "/js/app.js",
        "/i18n/pt.json",
        "/i18n/en.json",
        "/img/clenio.jpeg",
    ]
    for path in paths:
        url = base.rstrip("/") + path
        try:
            with urllib.request.urlopen(url, timeout=5) as res:
                if res.status != 200:
                    fail(f"HTTP {res.status} for {url}")
                body = res.read()
                if path.endswith(".json"):
                    json.loads(body.decode("utf-8"))
                if path in {"/", "/index.html"} and b"data-lang" not in body:
                    fail(f"HTML at {url} missing language controls")
        except urllib.error.URLError as exc:
            fail(f"Could not fetch {url}: {exc}")


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else ""
    check_files()
    pt = load_json(ROOT / "i18n/pt.json")
    en = load_json(ROOT / "i18n/en.json")
    if pt and en:
        check_parity(pt, en)
        check_urls(pt, "pt.json")
        check_urls(en, "en.json")
    check_html()
    check_js()
    if base:
        check_http(base)

    print("=== Digital Card MVP Validation ===")
    if warnings:
        print("Warnings:")
        for w in warnings:
            print(f"  - {w}")
    if errors:
        print("Errors:")
        for e in errors:
            print(f"  - {e}")
        print(f"RESULT: FAIL ({len(errors)} errors)")
        return 1

    print("RESULT: PASS — ready for production checks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
