"""
Figure redraw pilot: helper steps that need Python.

  python scripts/figures_pilot.py select [--count 20]   pick figures, render their PDF pages
  python scripts/figures_pilot.py render                run the AI-written drawing scripts
  python scripts/figures_pilot.py review                build papers/_figures/review.html
  python scripts/figures_pilot.py render-one <folder>   run script.py in one folder (used by generate-questions.ts)

The AI step in between is scripts/draw-figures.ts. Needs pymupdf and matplotlib.
Everything is written under papers/_figures (git-ignored).
"""

import ast
import html
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path("papers")
OUT = ROOT / "_figures"
ALLOWED_IMPORTS = {"matplotlib", "numpy", "math", "mpl_toolkits"}
BANNED_NAMES = {"open", "exec", "eval", "compile", "__import__", "input", "globals", "locals", "getattr", "setattr"}


def select(count: int) -> None:
    import pymupdf

    questions = json.loads((ROOT / "_extracted" / "all.json").read_text(encoding="utf-8"))
    # Current-syllabus papers only, newest first, so the pilot reflects what will be used.
    questions = [q for q in questions if q["year"] >= 2022]
    questions.sort(key=lambda q: (-q["year"], q["id"]))

    picked, seen_topics = [], {"graph": set(), "diagram": set()}
    want = {"graph": count // 2, "diagram": count - count // 2}
    for q in questions:
        for fig in q["figures"]:
            kind = fig["type"]
            if kind not in want or want[kind] == 0:
                continue
            # One figure per topic per kind, for a spread of subject matter.
            if q["primary_topic"] in seen_topics[kind]:
                continue
            seen_topics[kind].add(q["primary_topic"])
            want[kind] -= 1
            picked.append((q, fig))
            break
        if not any(want.values()):
            break

    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    for q, fig in picked:
        fid = f"{q['id']}_{''.join(c if c.isalnum() else '_' for c in fig['label']).strip('_')}"
        fdir = OUT / fid
        fdir.mkdir(exist_ok=True)
        doc = pymupdf.open(ROOT / q["qp_file"])
        # Find the page that actually carries this figure's caption.
        page_no = next(
            (p for p in q["qp_pages"] if 1 <= p <= len(doc) and fig["label"] in doc[p - 1].get_text()),
            q["qp_pages"][0] if q["qp_pages"] else 1,
        )
        doc[page_no - 1].get_pixmap(dpi=110).save(fdir / "page.png")
        parts = [p for p in q["parts"] if fig["label"] in p["text"]]
        manifest.append(
            {
                "id": fid,
                "question_id": q["id"],
                "label": fig["label"],
                "type": fig["type"],
                "description": fig["description"],
                "topic": q["primary_topic"],
                "page": page_no,
                "qp_file": q["qp_file"],
                "context": q["context"],
                "part_text": parts[0]["text"] if parts else "",
            }
        )
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    kinds = {k: sum(1 for m in manifest if m["type"] == k) for k in ("graph", "diagram")}
    print(f"Selected {len(manifest)} figures {kinds} -> {OUT}")


def check_script(source: str) -> str | None:
    """Return a reason to refuse running the script, or None if it looks like plain plotting code."""
    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        return f"syntax error: {e}"
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                if a.name.split(".")[0] not in ALLOWED_IMPORTS:
                    return f"import of {a.name} is not allowed"
        elif isinstance(node, ast.ImportFrom):
            if (node.module or "").split(".")[0] not in ALLOWED_IMPORTS:
                return f"import from {node.module} is not allowed"
        elif isinstance(node, ast.Name) and node.id in BANNED_NAMES:
            return f"use of {node.id} is not allowed"
        elif isinstance(node, ast.Attribute) and node.attr.startswith("__"):
            return f"use of {node.attr} is not allowed"
    return None


def render_dir(fdir: Path) -> dict:
    """Check and run script.py inside fdir. Returns {"ok": bool, "error": str} and writes status.json."""
    runner = Path(__file__).with_name("figure_runner.py").resolve()
    script = fdir / "script.py"
    for stale in ("figure.svg", "figure.png"):
        (fdir / stale).unlink(missing_ok=True)
    if not script.exists():
        result = {"ok": False, "error": "no script was produced"}
    else:
        reason = check_script(script.read_text(encoding="utf-8"))
        if reason:
            result = {"ok": False, "error": f"refused to run: {reason}"}
        else:
            try:
                res = subprocess.run(
                    [sys.executable, str(runner), "script.py"],
                    cwd=fdir, capture_output=True, text=True, timeout=60,
                    env={**os.environ, "MPLBACKEND": "Agg"},
                )
                good = res.returncode == 0 and (fdir / "figure.svg").exists()
                err = "" if good else (res.stderr.strip().splitlines() or ["no figure.svg was written"])[-1]
                result = {"ok": good, "error": err}
            except subprocess.TimeoutExpired:
                result = {"ok": False, "error": "timed out after 60 s"}
    (fdir / "status.json").write_text(json.dumps(result))
    return result


def render() -> None:
    manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
    ok = 0
    for m in manifest:
        st = render_dir(OUT / m["id"])
        ok += st["ok"]
        print(f"  {'ok  ' if st['ok'] else 'FAIL'} {m['id']}{'' if st['ok'] else ': ' + st['error']}")
    print(f"\nRendered {ok} of {len(manifest)}.")


def review() -> None:
    manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
    cards, ok = [], 0
    for m in manifest:
        fdir = OUT / m["id"]
        st = json.loads((fdir / "status.json").read_text()) if (fdir / "status.json").exists() else {"ok": False, "error": "not rendered"}
        ok += st["ok"]
        notes = (fdir / "notes.txt").read_text(encoding="utf-8") if (fdir / "notes.txt").exists() else ""
        right = (
            f'<img src="{m["id"]}/figure.svg" alt="redraw">'
            if st["ok"]
            else f'<p class="fail">No drawing: {html.escape(st["error"])}</p>'
        )
        cards.append(
            f"""<section class="card{'' if st['ok'] else ' bad'}">
<h2>{html.escape(m['label'])} <small>{html.escape(m['type'])} · {html.escape(m['topic'])} · {html.escape(m['question_id'])} · page {m['page']}</small></h2>
<p class="desc">{html.escape(m['description'])}</p>
{f'<p class="note"><b>Model notes:</b> {html.escape(notes)}</p>' if notes else ''}
<div class="cols"><div><h3>Original page</h3><img src="{m['id']}/page.png" alt="original page"></div>
<div><h3>Redraw</h3>{right}</div></div></section>"""
        )
    page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Figure redraw pilot</title>
<style>
body{{font:15px/1.5 system-ui,sans-serif;margin:0 auto;padding:16px;max-width:1200px;background:#f4f4f5;color:#18181b}}
h1{{font-size:20px;margin:0 0 4px}} h2{{font-size:16px;margin:0 0 6px}} h3{{font-size:13px;margin:0 0 6px;color:#52525b}}
small{{font-weight:400;color:#52525b;margin-left:8px}} .card{{background:#fff;border:1px solid #d4d4d8;border-radius:8px;padding:12px 16px;margin:0 0 16px}}
.card.bad{{border-left:6px solid #dc2626}} .desc{{color:#3f3f46;margin:0 0 6px}} .note{{color:#52525b;margin:0 0 8px}}
.cols{{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}}
@media(max-width:800px){{.cols{{grid-template-columns:1fr}}}}
img{{max-width:100%;border:1px solid #e4e4e7;background:#fff}} .fail{{color:#b91c1c}}
</style></head><body><h1>Figure redraw pilot</h1>
<p>{ok} of {len(manifest)} figures produced a drawing. Compare each redraw with the figure of the same label on the original page.</p>
{''.join(cards)}</body></html>"""
    (OUT / "review.html").write_text(page, encoding="utf-8")
    print(f"Review page: {OUT / 'review.html'} ({ok} of {len(manifest)} drawn)")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "select":
        n = int(sys.argv[sys.argv.index("--count") + 1]) if "--count" in sys.argv else 20
        select(n)
    elif cmd == "render":
        render()
    elif cmd == "review":
        review()
    elif cmd == "render-one":
        # Used by generate-questions.ts: render the script in one folder, print the result as JSON.
        print(json.dumps(render_dir(Path(sys.argv[2]))))
    else:
        print(__doc__)
        sys.exit(1)
