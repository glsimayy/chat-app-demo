from __future__ import annotations

import html
import json
import re
import textwrap
from collections import defaultdict
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    LongTable,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents


ROOT = Path(__file__).resolve().parents[1]
MARKDOWN_PATH = ROOT / "docs" / "api-java-webhook-reference.md"
OPENAPI_PATH = ROOT / "docs" / "openapi.snapshot.json"
PDF_PATH = ROOT / "output" / "pdf" / "ello-api-java-webhook-dokumani.pdf"

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN_X = 17 * mm
MARGIN_TOP = 18 * mm
MARGIN_BOTTOM = 17 * mm
CONTENT_WIDTH = PAGE_WIDTH - (2 * MARGIN_X)

NAVY = colors.HexColor("#17324D")
BLUE = colors.HexColor("#2F6B95")
GREEN = colors.HexColor("#2F855A")
INK = colors.HexColor("#263746")
MUTED = colors.HexColor("#64727E")
PALE_BLUE = colors.HexColor("#EEF5FA")
PALE_GREEN = colors.HexColor("#ECF7F0")
PALE_RED = colors.HexColor("#FCEEEE")
LINE_COLOR = colors.HexColor("#C7D7E2")
WHITE = colors.white

HTTP_METHODS = {"get", "post", "put", "patch", "delete", "options", "head"}
TAG_ORDER = [
    "health",
    "metrics",
    "auth",
    "users",
    "conversations",
    "calls",
    "bookmarks",
    "contact invitations",
    "support tickets",
    "bot",
    "dev",
]


def load_openapi() -> dict:
    return json.loads(OPENAPI_PATH.read_text(encoding="utf-8-sig"))


def operation_auth(operation: dict) -> str:
    security = operation.get("security", [])
    if any("bearer" in name.lower() for item in security for name in item):
        return "Bearer JWT"

    parameters = operation.get("parameters", [])
    header_names = {
        str(parameter.get("name", "")).lower()
        for parameter in parameters
        if parameter.get("in") == "header"
    }
    if "x-bot-secret" in header_names:
        return "x-bot-secret"
    if "x-dev-secret" in header_names:
        return "x-dev-secret"
    return "Public"


def schema_name(schema: dict | None) -> str:
    if not schema:
        return "-"
    if "$ref" in schema:
        return schema["$ref"].split("/")[-1]
    if schema.get("type") == "array":
        return f"array<{schema_name(schema.get('items'))}>"
    if "allOf" in schema:
        names = [schema_name(item) for item in schema["allOf"]]
        return " + ".join(name for name in names if name != "-")
    return schema.get("type", "object")


def operation_request(operation: dict) -> str:
    request_body = operation.get("requestBody")
    if not request_body:
        return "-"
    content = request_body.get("content", {})
    if "multipart/form-data" in content:
        return "multipart/form-data"
    media = content.get("application/json") or next(iter(content.values()), {})
    return schema_name(media.get("schema"))


def operation_success(operation: dict) -> str:
    responses = operation.get("responses", {})
    return ", ".join(
        status for status in responses if str(status).startswith("2")
    ) or "-"


def operation_purpose(operation: dict) -> str:
    if operation.get("summary"):
        return operation["summary"].strip()
    for status, response in operation.get("responses", {}).items():
        if str(status).startswith("2") and response.get("description"):
            return response["description"].strip()
    return "API operation"


def generate_endpoint_catalog(openapi: dict) -> str:
    grouped: dict[str, list[tuple[str, str, dict]]] = defaultdict(list)
    for path, path_item in openapi.get("paths", {}).items():
        for method, operation in path_item.items():
            if method not in HTTP_METHODS:
                continue
            tag = (operation.get("tags") or ["other"])[0]
            grouped[tag].append((method.upper(), path, operation))

    tag_rank = {tag: index for index, tag in enumerate(TAG_ORDER)}
    lines: list[str] = []
    for tag in sorted(grouped, key=lambda item: (tag_rank.get(item, 999), item)):
        operations = sorted(grouped[tag], key=lambda item: (item[1], item[0]))
        lines.extend(
            [
                f"### {tag.title()}",
                "",
                "| Method | Path | Auth | Request | Success | Purpose |",
                "| --- | --- | --- | --- | --- | --- |",
            ]
        )
        for method, path, operation in operations:
            values = [
                f"`{method}`",
                f"`{path}`",
                operation_auth(operation),
                f"`{operation_request(operation)}`",
                operation_success(operation),
                operation_purpose(operation),
            ]
            lines.append("| " + " | ".join(markdown_escape(value) for value in values) + " |")
        lines.append("")
    return "\n".join(lines).rstrip()


def property_type(meta: dict) -> str:
    if "$ref" in meta:
        value = meta["$ref"].split("/")[-1]
    elif meta.get("type") == "array":
        value = f"array<{property_type(meta.get('items', {}))}>"
    elif "allOf" in meta:
        value = " + ".join(property_type(item) for item in meta["allOf"])
    elif "oneOf" in meta:
        value = " | ".join(property_type(item) for item in meta["oneOf"])
    else:
        value = meta.get("type", "object")
    if meta.get("nullable"):
        value += " | null"
    return value


def property_rules(meta: dict) -> str:
    parts: list[str] = []
    if meta.get("format"):
        parts.append(f"format={meta['format']}")
    if "enum" in meta:
        parts.append("enum=" + ", ".join(str(value) for value in meta["enum"]))
    for key in (
        "minimum",
        "maximum",
        "minLength",
        "maxLength",
        "minItems",
        "maxItems",
        "pattern",
        "default",
    ):
        if key in meta:
            parts.append(f"{key}={meta[key]}")
    if meta.get("description"):
        parts.append(str(meta["description"]).replace("\n", " "))
    return "; ".join(parts) or "-"


def generate_schema_catalog(openapi: dict) -> str:
    lines: list[str] = []
    schemas = openapi.get("components", {}).get("schemas", {})
    for name, schema in schemas.items():
        lines.extend([f"#### {name}", ""])
        required = set(schema.get("required", []))
        properties = schema.get("properties", {})
        if not properties:
            lines.extend(
                [
                    f"Tür: `{property_type(schema)}`",
                    "",
                ]
            )
            continue
        lines.extend(
            [
                "| Field | Type | Required | Rules / Description |",
                "| --- | --- | --- | --- |",
            ]
        )
        for field_name, meta in properties.items():
            lines.append(
                "| "
                + " | ".join(
                    [
                        f"`{markdown_escape(field_name)}`",
                        f"`{markdown_escape(property_type(meta))}`",
                        "Yes" if field_name in required else "No",
                        markdown_escape(property_rules(meta)),
                    ]
                )
                + " |"
            )
        lines.append("")
    return "\n".join(lines).rstrip()


def markdown_escape(value: str) -> str:
    return value.replace("|", r"\|").replace("\n", " ")


def replace_generated_section(
    markdown: str,
    start_marker: str,
    end_marker: str,
    content: str,
) -> str:
    pattern = re.compile(
        rf"{re.escape(start_marker)}.*?{re.escape(end_marker)}",
        re.DOTALL,
    )
    replacement = f"{start_marker}\n{content}\n{end_marker}"
    updated, count = pattern.subn(lambda _: replacement, markdown)
    if count != 1:
        raise RuntimeError(f"Generated section markers not found: {start_marker}")
    return updated


def update_markdown(openapi: dict) -> str:
    markdown = MARKDOWN_PATH.read_text(encoding="utf-8")
    markdown = replace_generated_section(
        markdown,
        "<!-- OPENAPI_ENDPOINTS_START -->",
        "<!-- OPENAPI_ENDPOINTS_END -->",
        generate_endpoint_catalog(openapi),
    )
    markdown = replace_generated_section(
        markdown,
        "<!-- OPENAPI_SCHEMAS_START -->",
        "<!-- OPENAPI_SCHEMAS_END -->",
        generate_schema_catalog(openapi),
    )
    MARKDOWN_PATH.write_text(markdown, encoding="utf-8", newline="\n")
    return markdown


def register_fonts() -> tuple[str, str]:
    regular = Path("C:/Windows/Fonts/arial.ttf")
    bold = Path("C:/Windows/Fonts/arialbd.ttf")
    mono = Path("C:/Windows/Fonts/consola.ttf")
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("ElloSans", str(regular)))
        pdfmetrics.registerFont(TTFont("ElloSans-Bold", str(bold)))
        pdfmetrics.registerFont(
            TTFont("ElloMono", str(mono if mono.exists() else regular))
        )
        return "ElloSans", "ElloSans-Bold"
    pdfmetrics.registerFont(TTFont("ElloMono", str(mono))) if mono.exists() else None
    return "Helvetica", "Helvetica-Bold"


class ReportDocTemplate(BaseDocTemplate):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._bookmark_index = 0

    def beforeDocument(self):
        self._bookmark_index = 0

    def afterFlowable(self, flowable):
        if not isinstance(flowable, Paragraph):
            return
        style_name = flowable.style.name
        if style_name not in {"Heading1", "Heading2"}:
            return
        level = {"Heading1": 0, "Heading2": 1}[style_name]
        text = flowable.getPlainText()
        key = f"heading-{self._bookmark_index}"
        self._bookmark_index += 1
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(text, key, level=level, closed=False)
        self.notify("TOCEntry", (level, text, self.page, key))


class SectionLabel(Flowable):
    def __init__(self, text: str, font_name: str):
        super().__init__()
        self.text = text
        self.font_name = font_name
        self.width = 73 * mm
        self.height = 9 * mm

    def draw(self):
        self.canv.setFillColor(BLUE)
        self.canv.roundRect(0, 0, self.width, self.height, 4.5 * mm, fill=1, stroke=0)
        self.canv.setFillColor(WHITE)
        self.canv.setFont(self.font_name, 8.2)
        self.canv.drawCentredString(self.width / 2, 3.1 * mm, self.text.upper())


def make_styles(font_name: str, bold_font: str):
    sample = getSampleStyleSheet()
    return {
        "cover_title": ParagraphStyle(
            "CoverTitle",
            parent=sample["Title"],
            fontName=bold_font,
            fontSize=27,
            leading=32,
            alignment=TA_CENTER,
            textColor=NAVY,
            spaceAfter=5 * mm,
        ),
        "cover_subtitle": ParagraphStyle(
            "CoverSubtitle",
            parent=sample["Normal"],
            fontName=font_name,
            fontSize=11.5,
            leading=16,
            alignment=TA_CENTER,
            textColor=MUTED,
        ),
        "h1": ParagraphStyle(
            "Heading1",
            parent=sample["Heading1"],
            fontName=bold_font,
            fontSize=17,
            leading=21,
            textColor=NAVY,
            spaceBefore=1 * mm,
            spaceAfter=3 * mm,
            keepWithNext=True,
        ),
        "h2": ParagraphStyle(
            "Heading2",
            parent=sample["Heading2"],
            fontName=bold_font,
            fontSize=12.5,
            leading=16,
            textColor=BLUE,
            spaceBefore=3 * mm,
            spaceAfter=2 * mm,
            keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "Heading3",
            parent=sample["Heading3"],
            fontName=bold_font,
            fontSize=10,
            leading=13,
            textColor=GREEN,
            spaceBefore=3 * mm,
            spaceAfter=2 * mm,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=sample["BodyText"],
            fontName=font_name,
            fontSize=8.4,
            leading=11.8,
            textColor=INK,
            spaceAfter=1.8 * mm,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=sample["BodyText"],
            fontName=font_name,
            fontSize=8.2,
            leading=11,
            textColor=INK,
            leftIndent=5 * mm,
            firstLineIndent=-3.5 * mm,
            bulletIndent=1.3 * mm,
            spaceAfter=0.8 * mm,
        ),
        "note": ParagraphStyle(
            "Note",
            parent=sample["BodyText"],
            fontName=font_name,
            fontSize=8.3,
            leading=12,
            textColor=INK,
            leftIndent=3 * mm,
            rightIndent=3 * mm,
            borderColor=LINE_COLOR,
            borderWidth=0.7,
            borderPadding=7,
            backColor=PALE_BLUE,
            spaceBefore=2 * mm,
            spaceAfter=3 * mm,
        ),
        "code": ParagraphStyle(
            "Code",
            parent=sample["Code"],
            fontName="ElloMono" if "ElloMono" in pdfmetrics.getRegisteredFontNames() else font_name,
            fontSize=6.8,
            leading=9.3,
            textColor=colors.HexColor("#1E2D38"),
            wordWrap="CJK",
        ),
        "table": ParagraphStyle(
            "TableBody",
            parent=sample["BodyText"],
            fontName=font_name,
            fontSize=6.8,
            leading=8.7,
            textColor=INK,
        ),
        "table_header": ParagraphStyle(
            "TableHeader",
            parent=sample["BodyText"],
            fontName=bold_font,
            fontSize=6.8,
            leading=8.7,
            textColor=WHITE,
        ),
        "toc_title": ParagraphStyle(
            "TocTitle",
            parent=sample["Heading1"],
            fontName=bold_font,
            fontSize=19,
            leading=23,
            textColor=NAVY,
            spaceAfter=6 * mm,
        ),
    }


def inline_markup(value: str) -> str:
    placeholders: list[str] = []

    def stash_code(match):
        placeholders.append(
            f"<font name='ElloMono' color='#17324D'>{html.escape(match.group(1))}</font>"
        )
        return f"@@CODE{len(placeholders) - 1}@@"

    escaped = re.sub(r"`([^`]+)`", stash_code, value)
    escaped = html.escape(escaped, quote=False)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"<u><font color='#2F6B95'>\1</font></u>", escaped)
    for index, replacement in enumerate(placeholders):
        escaped = escaped.replace(html.escape(f"@@CODE{index}@@"), replacement)
    return escaped


def code_flowable(code: str, styles) -> Table:
    wrapped: list[str] = []
    for raw_line in code.splitlines() or [""]:
        if not raw_line:
            wrapped.append("")
            continue
        indent = len(raw_line) - len(raw_line.lstrip(" "))
        chunks = textwrap.wrap(
            raw_line,
            width=96,
            subsequent_indent=" " * min(indent + 2, 12),
            replace_whitespace=False,
            drop_whitespace=False,
        ) or [raw_line]
        wrapped.extend(chunks)
    rendered = "<br/>".join(
        html.escape(line).replace(" ", "&nbsp;") for line in wrapped
    )
    paragraph = Paragraph(rendered or "&nbsp;", styles["code"])
    table = Table([[paragraph]], colWidths=[CONTENT_WIDTH])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F4F7F9")),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE_COLOR),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def split_table_row(line: str) -> list[str]:
    stripped = line.strip().strip("|")
    cells = re.split(r"(?<!\\)\|", stripped)
    return [cell.strip().replace(r"\|", "|") for cell in cells]


def table_widths(headers: list[str], rows: list[list[str]]) -> list[float]:
    normalized = [re.sub(r"`|\*|_", "", header).strip().lower() for header in headers]
    if normalized == ["method", "path", "auth", "request", "success", "purpose"]:
        return [13 * mm, 55 * mm, 25 * mm, 32 * mm, 16 * mm, CONTENT_WIDTH - 141 * mm]
    if normalized == ["field", "type", "required", "rules / description"]:
        return [38 * mm, 40 * mm, 19 * mm, CONTENT_WIDTH - 97 * mm]
    if normalized == ["alan", "kural"]:
        return [48 * mm, CONTENT_WIDTH - 48 * mm]
    if normalized == ["değişken", "zorunlu", "varsayılan", "açıklama"]:
        return [43 * mm, 20 * mm, 39 * mm, CONTENT_WIDTH - 102 * mm]
    if normalized == ["bileşen", "teknoloji", "görev"]:
        return [38 * mm, 38 * mm, CONTENT_WIDTH - 76 * mm]
    if normalized == ["kod", "kullanım"]:
        return [22 * mm, CONTENT_WIDTH - 22 * mm]

    column_count = len(headers)
    scores = []
    for column in range(column_count):
        maximum = max(
            len(re.sub(r"`|\*|_", "", row[column]))
            for row in [headers, *rows]
            if column < len(row)
        )
        scores.append(max(8, min(maximum, 42)))
    total = sum(scores)
    return [CONTENT_WIDTH * score / total for score in scores]


def markdown_table(rows: list[list[str]], styles) -> LongTable:
    headers = rows[0]
    body = rows[2:]
    widths = table_widths(headers, body)
    rendered_rows: list[list[Paragraph]] = [
        [Paragraph(inline_markup(value), styles["table_header"]) for value in headers]
    ]
    for row in body:
        padded = row + [""] * (len(headers) - len(row))
        rendered_rows.append(
            [Paragraph(inline_markup(value), styles["table"]) for value in padded[: len(headers)]]
        )
    table = LongTable(rendered_rows, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("GRID", (0, 0), (-1, -1), 0.35, LINE_COLOR),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PALE_BLUE]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3.5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3.5),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return table


def parse_markdown(markdown: str, styles) -> list:
    marker = "<!-- PDF_BODY -->"
    if marker not in markdown:
        raise RuntimeError("PDF body marker is missing")
    lines = markdown.split(marker, 1)[1].splitlines()
    story: list = []
    index = 0

    while index < len(lines):
        line = lines[index].rstrip()
        stripped = line.strip()

        if not stripped:
            index += 1
            continue

        if stripped == "<!-- pagebreak -->":
            story.append(PageBreak())
            index += 1
            continue

        if stripped.startswith("<!--"):
            index += 1
            continue

        if stripped.startswith("```"):
            index += 1
            code_lines: list[str] = []
            while index < len(lines) and not lines[index].strip().startswith("```"):
                code_lines.append(lines[index].rstrip("\n"))
                index += 1
            if index < len(lines):
                index += 1
            story.append(code_flowable("\n".join(code_lines), styles))
            story.append(Spacer(1, 2.5 * mm))
            continue

        heading_match = re.match(r"^(#{2,4})\s+(.+)$", stripped)
        if heading_match:
            level = len(heading_match.group(1))
            style = {2: styles["h1"], 3: styles["h2"], 4: styles["h3"]}[level]
            story.append(Paragraph(inline_markup(heading_match.group(2)), style))
            index += 1
            continue

        if (
            stripped.startswith("|")
            and index + 1 < len(lines)
            and re.match(r"^\s*\|?\s*:?-+", lines[index + 1])
        ):
            table_lines = [line]
            index += 1
            while index < len(lines) and lines[index].strip().startswith("|"):
                table_lines.append(lines[index].rstrip())
                index += 1
            story.append(markdown_table([split_table_row(value) for value in table_lines], styles))
            story.append(Spacer(1, 3 * mm))
            continue

        bullet_match = re.match(r"^[-*]\s+(.+)$", stripped)
        numbered_match = re.match(r"^(\d+)\.\s+(.+)$", stripped)
        if bullet_match:
            story.append(
                Paragraph(inline_markup(bullet_match.group(1)), styles["bullet"], bulletText="-")
            )
            index += 1
            continue
        if numbered_match:
            story.append(
                Paragraph(
                    inline_markup(numbered_match.group(2)),
                    styles["bullet"],
                    bulletText=f"{numbered_match.group(1)}.",
                )
            )
            index += 1
            continue

        if stripped.startswith("> "):
            note_lines = [stripped[2:]]
            index += 1
            while index < len(lines) and lines[index].strip().startswith("> "):
                note_lines.append(lines[index].strip()[2:])
                index += 1
            story.append(Paragraph(inline_markup(" ".join(note_lines)), styles["note"]))
            continue

        paragraph_lines = [stripped]
        index += 1
        while index < len(lines):
            candidate = lines[index].strip()
            if (
                not candidate
                or candidate.startswith("#")
                or candidate.startswith("```")
                or candidate.startswith("|")
                or candidate.startswith("<!--")
                or candidate.startswith("> ")
                or re.match(r"^[-*]\s+", candidate)
                or re.match(r"^\d+\.\s+", candidate)
            ):
                break
            paragraph_lines.append(candidate)
            index += 1
        story.append(
            Paragraph(inline_markup(" ".join(paragraph_lines)), styles["body"])
        )

    return story


def page_chrome(canvas, doc):
    if canvas.getPageNumber() == 1:
        return
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.setFont("ElloSans-Bold", 8.1)
    canvas.drawString(MARGIN_X, PAGE_HEIGHT - 10.5 * mm, "ellO / API + Java Webhook")
    canvas.setFillColor(MUTED)
    canvas.setFont("ElloSans", 7.6)
    canvas.drawRightString(
        PAGE_WIDTH - MARGIN_X,
        PAGE_HEIGHT - 10.5 * mm,
        "v0.1 teknik referans",
    )
    canvas.setStrokeColor(LINE_COLOR)
    canvas.line(MARGIN_X, PAGE_HEIGHT - 13.5 * mm, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 13.5 * mm)
    canvas.line(MARGIN_X, 12 * mm, PAGE_WIDTH - MARGIN_X, 12 * mm)
    canvas.setFont("ElloSans", 7.6)
    canvas.drawString(MARGIN_X, 7.7 * mm, "Kaynak: OpenAPI + uygulama kodu")
    canvas.drawRightString(
        PAGE_WIDTH - MARGIN_X,
        7.7 * mm,
        f"Sayfa {canvas.getPageNumber()}",
    )
    canvas.restoreState()


def build_pdf(markdown: str, openapi: dict):
    PDF_PATH.parent.mkdir(parents=True, exist_ok=True)
    font_name, bold_font = register_fonts()
    styles = make_styles(font_name, bold_font)
    frame = Frame(
        MARGIN_X,
        MARGIN_BOTTOM,
        CONTENT_WIDTH,
        PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM,
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )
    doc = ReportDocTemplate(
        str(PDF_PATH),
        pagesize=A4,
        leftMargin=MARGIN_X,
        rightMargin=MARGIN_X,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM,
        title="ellO API ve Java Webhook Teknik Referansı",
        author="ellO",
        subject="NestJS REST, Socket.IO ve Spring Boot webhook sözleşmesi",
    )
    doc.addPageTemplates([PageTemplate(id="content", frames=[frame], onPage=page_chrome)])

    operation_count = sum(
        1
        for path_item in openapi.get("paths", {}).values()
        for method in path_item
        if method in HTTP_METHODS
    )
    schema_count = len(openapi.get("components", {}).get("schemas", {}))

    story: list = [
        Spacer(1, 22 * mm),
        SectionLabel("Teknik Entegrasyon Referansı", bold_font),
        Spacer(1, 10 * mm),
        Paragraph("ellO API ve Java Webhook", styles["cover_title"]),
        Paragraph(
            "REST · Socket.IO · WebRTC Signaling · Spring Boot Adapter",
            styles["cover_subtitle"],
        ),
        Spacer(1, 15 * mm),
    ]
    cover_rows = [
        [Paragraph("<b>Belge kapsamı</b>", styles["body"])],
        [Paragraph(f"- {operation_count} REST operasyonu ve {schema_count} OpenAPI şeması", styles["body"])],
        [Paragraph("- JWT, grup rolleri, BOT ve webhook güvenlik sınırları", styles["body"])],
        [Paragraph("- Mesaj, attachment, ticket, call ve realtime sözleşmeleri", styles["body"])],
        [Paragraph("- Java timeout, retry, readiness ve hata çevirme davranışı", styles["body"])],
        [Paragraph("- Docker, test, troubleshooting ve production kontrol listesi", styles["body"])],
    ]
    cover_table = Table(cover_rows, colWidths=[133 * mm], hAlign="CENTER")
    cover_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALE_BLUE),
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#A8C5D8")),
                ("LEFTPADDING", (0, 0), (-1, -1), 9 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9 * mm),
                ("TOPPADDING", (0, 0), (-1, 0), 6 * mm),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 6 * mm),
            ]
        )
    )
    story.extend(
        [
            cover_table,
            Spacer(1, 14 * mm),
            Paragraph("v0.1 · 27.07.2026 · Secret içermeyen sürüm", styles["cover_subtitle"]),
            PageBreak(),
            Paragraph("İçindekiler", styles["toc_title"]),
        ]
    )
    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle(
            "TOC1",
            fontName=bold_font,
            fontSize=9,
            leading=13,
            leftIndent=0,
            firstLineIndent=0,
            textColor=NAVY,
            spaceAfter=1.5 * mm,
        ),
        ParagraphStyle(
            "TOC2",
            fontName=font_name,
            fontSize=8,
            leading=11,
            leftIndent=7 * mm,
            firstLineIndent=0,
            textColor=INK,
            spaceAfter=0.8 * mm,
        ),
        ParagraphStyle(
            "TOC3",
            fontName=font_name,
            fontSize=7.2,
            leading=9,
            leftIndent=13 * mm,
            firstLineIndent=0,
            textColor=MUTED,
        ),
    ]
    story.extend([toc, PageBreak()])
    story.extend(parse_markdown(markdown, styles))
    doc.multiBuild(story)


def main():
    openapi = load_openapi()
    markdown = update_markdown(openapi)
    build_pdf(markdown, openapi)
    operation_count = sum(
        1
        for path_item in openapi.get("paths", {}).values()
        for method in path_item
        if method in HTTP_METHODS
    )
    print(f"Markdown: {MARKDOWN_PATH}")
    print(f"OpenAPI snapshot: {OPENAPI_PATH}")
    print(f"PDF: {PDF_PATH}")
    print(
        f"Paths: {len(openapi.get('paths', {}))}, operations: {operation_count}, "
        f"schemas: {len(openapi.get('components', {}).get('schemas', {}))}"
    )


if __name__ == "__main__":
    main()
