#!/usr/bin/env python3
"""Silent, captioned capture of the CapPurse guided demo.

Follows submit/DEMO_VIDEO_SCRIPT.md. No wallet, no network, no voice.
Does not print or read any wallet secret. Local recording only — do not upload.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import TimeoutError as PwTimeout
from playwright.sync_api import sync_playwright

ROOT = Path("/workspace/money/hackathons/tari-mvp/cappurse")
OUT = ROOT / "submit" / "video"
STILLS = OUT / "stills"
WORK = Path("/tmp/cappurse-demo-record")
PORT = int(os.environ.get("CAPPURSE_PORT", "8765"))
URL = f"http://127.0.0.1:{PORT}/web/"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
W, H = 1280, 800

# Sleep queue injected into the real app.js sleep() so the 7-step demo
# holds each storyboard beat without changing the committed source.
VIDEO_PACE = [6000, 8000, 10000, 8000, 10000, 7000, 9000, 4000]


def say(msg: str) -> None:
    print(msg, flush=True)


FILM_CSS = """
  #cappurse-caption {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 80;
    padding: 8px 20px 10px;
    background: rgba(10, 14, 20, 0.94); color: #f3f6fb;
    font: 500 16px/1.3 "IBM Plex Sans", "DejaVu Sans", sans-serif;
    border-top: 1px solid rgba(230, 180, 70, 0.45);
    pointer-events: none; letter-spacing: 0.01em;
  }
  body { padding-bottom: 52px; }
  /* Recording-only: hide the manual forms so the 7 steps and account
     balances stay above the caption at 1280x800. */
  #form-alice, #form-bob, #form-mallory, #roles, .kicker:has(+ #roles) { display: none !important; }
  .steps li { padding-top: 4px !important; padding-bottom: 4px !important; }
"""


def prepare_film_ui(page) -> None:
    page.add_style_tag(content=FILM_CSS)
    page.evaluate(
        """() => {
          if (!document.getElementById('cappurse-caption')) {
            const el = document.createElement('div');
            el.id = 'cappurse-caption';
            document.body.appendChild(el);
          }
        }"""
    )


def set_caption(page, text: str) -> None:
    page.evaluate(
        """(text) => {
          const el = document.getElementById('cappurse-caption');
          if (el) el.textContent = text;
        }""",
        text,
    )


def still(page, name: str) -> Path:
    STILLS.mkdir(parents=True, exist_ok=True)
    path = STILLS / name
    page.screenshot(path=str(path), full_page=False)
    say(f"still {path}")
    return path


def fail_page(page, msg: str) -> None:
    try:
        still(page, "FAILURE.png")
    except Exception:
        pass
    raise RuntimeError(msg)


def start_server() -> subprocess.Popen:
    WORK.mkdir(parents=True, exist_ok=True)
    log = (WORK / "server.log").open("w")
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=str(ROOT),
        stdout=log,
        stderr=subprocess.STDOUT,
    )
    deadline = time.time() + 15
    while time.time() < deadline:
        if proc.poll() is not None:
            raise RuntimeError("http.server exited early: " + (WORK / "server.log").read_text(errors="replace"))
        try:
            import urllib.request
            urllib.request.urlopen(URL, timeout=1).read(64)
            return proc
        except Exception:
            time.sleep(0.2)
    raise RuntimeError("http.server did not become ready")


def patched_app_js() -> str:
    src = (ROOT / "web" / "app.js").read_text()
    old = "function sleep(ms) {\n  return new Promise((r) => setTimeout(r, ms));\n}"
    new = (
        "function sleep(ms) {\n"
        "  try {\n"
        "    const q = window.__capPurseVideoPace;\n"
        "    if (Array.isArray(q) && q.length) ms = q.shift();\n"
        "  } catch (_) {}\n"
        "  return new Promise((r) => setTimeout(r, ms));\n"
        "}"
    )
    if old not in src:
        raise RuntimeError("could not patch sleep() in app.js for recording")
    src = src.replace(old, new, 1)
    anchor = "  } catch (err) {\n    log(\"fail\", \"FAIL — guided demo stopped early: \" + err.message);"
    hook = "    await sleep(1);\n  } catch (err) {\n    log(\"fail\", \"FAIL — guided demo stopped early: \" + err.message);"
    if anchor not in src:
        raise RuntimeError("could not insert final-narration hold")
    src = src.replace(anchor, hook, 1)
    return src


def make_card(path: Path, title: str, subtitle: str, duration: float) -> None:
    def esc(s: str) -> str:
        return s.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")

    cmd = [
        "ffmpeg", "-y", "-f", "lavfi",
        "-i", f"color=c=0x0d1218:s={W}x{H}:d={duration}",
        "-vf",
        (
            f"drawtext=fontfile={FONT_B}:text='{esc(title)}':fontcolor=0xf3f6fb:"
            f"fontsize=48:x=(w-text_w)/2:y=(h/2)-70,"
            f"drawtext=fontfile={FONT}:text='{esc(subtitle)}':fontcolor=0xe6b446:"
            f"fontsize=22:x=(w-text_w)/2:y=(h/2)+8"
        ),
        "-pix_fmt", "yuv420p", "-r", "30", str(path),
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def transcode(src: Path, dest: Path) -> None:
    cmd = [
        "ffmpeg", "-y", "-i", str(src),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-an",
        "-vf", f"scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2",
        str(dest),
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def concat_mp4(parts: list[Path], dest: Path) -> None:
    lst = WORK / "concat.txt"
    lst.write_text("".join(f"file '{p}'\n" for p in parts))
    cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-an",
        "-movflags", "+faststart", str(dest),
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def duration_sec(path: Path) -> float:
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=nk=1:nw=1", str(path),
    ], text=True)
    return float(out.strip())


def run_browser() -> Path:
    STILLS.mkdir(parents=True, exist_ok=True)
    video_dir = WORK / "pw-video"
    if video_dir.exists():
        shutil.rmtree(video_dir)
    video_dir.mkdir(parents=True)
    js = patched_app_js()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=True,
            executable_path="/usr/bin/google-chrome",
            args=["--disable-dev-shm-usage", "--no-sandbox"],
        )
        context = browser.new_context(
            viewport={"width": W, "height": H},
            record_video_dir=str(video_dir),
            record_video_size={"width": W, "height": H},
            timezone_id="Europe/London",
            locale="en-GB",
        )
        page = context.new_page()
        page.route("**/web/app.js", lambda route: route.fulfill(
            content_type="application/javascript; charset=utf-8", body=js
        ))
        page.add_init_script(f"window.__capPurseVideoPace = {VIDEO_PACE!r};")
        page.set_default_timeout(20_000)
        page.goto(URL, wait_until="networkidle")
        page.wait_for_selector("#run-demo", timeout=20_000)
        prepare_film_ui(page)
        # Reset so the opening ledger line is the scripted one.
        page.locator("#reset").click()
        page.wait_for_function(
            """() => document.querySelector('#log') && document.querySelector('#log').innerText.includes('Alice holds 1,000 TARI')""",
            timeout=10_000,
        )
        set_caption(page, "CapPurse: a spend-capped allowance vault for Tari Ootle. Demo mode, not connected to a wallet.")
        time.sleep(7.0)
        still(page, "01-title-banner.png")

        set_caption(page, "One click runs a 7-step story. Every step checks the ledger.")
        time.sleep(1.5)
        still(page, "02-ready-to-run.png")
        page.locator("#run-demo").click()

        def wait_step(n: int, caption: str, still_name: str, hold: float) -> None:
            try:
                page.wait_for_selector(f'li[data-step="{n}"].done', timeout=25_000)
            except PwTimeout:
                fail_page(page, f"step {n + 1} did not complete")
            set_caption(page, caption)
            time.sleep(hold)
            still(page, still_name)

        wait_step(0, "Alice deposits 1,000 TARI. Vault 1,000, Alice 0.", "03-step1-deposit.png", 6.5)
        wait_step(1, "Bob gets a 100 TARI cap, cafe and vendor only, refilling every 50 epochs.", "04-step2-grant.png", 8.5)
        wait_step(2, "Bob pays the cafe 40. He still holds 0 himself, 60 remain, and he has a receipt.", "05-step3-spend.png", 6.5)
        wait_step(3, "Bob tries 70 → blocked: \"amount exceeds remaining cap\". Nothing moved.", "06-step4-overcap.png", 8.5)
        wait_step(4, "Unlisted shop → blocked: \"merchant is not on the allowlist\".", "07-step5-allowlist.png", 5.5)
        wait_step(5, "50 epochs pass, the cap refills to 100, Bob pays the vendor 100.", "08-step6-refill.png", 7.5)
        wait_step(6, "Alice revokes Bob; his next spend is blocked. Mallory cannot withdraw (\"Access Denied: owner only\"). Alice takes back 860.", "09-step7-revoke.png", 7.0)

        # Final narration (held by the last paced sleep)
        set_caption(page, "All 11 of 11 checks passed. Final: Alice 860, cafe 40, vendor 100, vault 0.")
        page.wait_for_function(
            """() => (document.querySelector('#narration-text')||{}).textContent &&
                     document.querySelector('#narration-text').textContent.includes('all 11 of 11 checks passed')""",
            timeout=15_000,
        )
        time.sleep(2.5)
        still(page, "10-final-checks.png")

        set_caption(page, "The Rust template lists 12 public methods with caller rules; 15 Ootle engine tests and 17 JS rule tests pass.")
        page.locator('button[data-tab="integrate"]').click()
        page.wait_for_selector("#tab-integrate.tabpage.on, #tab-integrate.on, .tabpage.on#tab-integrate", timeout=10_000)
        time.sleep(1.0)
        # Scroll the mapping table slowly
        page.evaluate("document.getElementById('tab-integrate')?.scrollIntoView({block:'start'})")
        time.sleep(2.0)
        page.evaluate("""() => {
          const el = document.getElementById('tab-integrate') || document.scrollingElement;
          el.scrollBy(0, 180);
        }""")
        time.sleep(2.5)
        page.evaluate("""() => {
          const el = document.getElementById('tab-integrate') || document.scrollingElement;
          el.scrollBy(0, 220);
        }""")
        time.sleep(2.5)
        still(page, "11-integrate-tab.png")

        page.close()
        context.close()
        browser.close()

    videos = list(video_dir.glob("*.webm")) + list(video_dir.glob("*.mp4"))
    if not videos:
        raise RuntimeError("Playwright did not write a video file")
    return videos[0]


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    STILLS.mkdir(parents=True, exist_ok=True)
    proc = None
    try:
        say("starting static demo server")
        proc = start_server()
        raw = run_browser()
        body = WORK / "body.mp4"
        transcode(raw, body)
        title = WORK / "title.mp4"
        end = WORK / "end.mp4"
        make_card(title, "CapPurse", "A spend-capped allowance vault for Tari Ootle  ·  demo mode, no wallet", 4)
        make_card(end, "CapPurse — MIT", "Tari November 2026 Build Contest (MVP)", 2)
        dest = OUT / "cappurse-guided-demo.mp4"
        concat_mp4([title, body, end], dest)
        dur = duration_sec(dest)
        say(f"VIDEO {dest} duration={dur:.1f}s size={dest.stat().st_size}")
        if dur < 80 or dur > 115:
            say(f"WARNING: duration {dur:.1f}s is outside the ~90s target window")
        return 0
    finally:
        if proc and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except PwTimeout as e:
        say(f"TIMEOUT: {e}")
        sys.exit(2)
    except Exception as e:
        say(f"ERROR: {type(e).__name__}: {e}")
        sys.exit(1)
