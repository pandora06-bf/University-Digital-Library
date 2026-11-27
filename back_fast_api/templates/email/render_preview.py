"""Render các mẫu bằng Jinja2 thật, kiểm tra thiếu biến, không gửi email."""
import json
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape


def render_previews():
    root = Path(__file__).resolve().parent
    output = root / "preview"
    output.mkdir(exist_ok=True)
    context = json.loads((root / "sample_context.json").read_text(encoding="utf-8"))
    environment = Environment(
        loader=FileSystemLoader(root),
        autoescape=select_autoescape(["html", "xml"]),
        undefined=StrictUndefined,
    )
    for name in ("receipt", "due_reminder", "hold_notice", "top_up"):
        rendered = environment.get_template(f"{name}.html").render(**context)
        (output / f"{name}.html").write_text(rendered, encoding="utf-8")
        print(f"Rendered {name}: {len(rendered.encode('utf-8'))} bytes")


if __name__ == "__main__":
    render_previews()
