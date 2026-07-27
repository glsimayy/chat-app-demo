from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Iterable

from reportlab.graphics.shapes import Drawing, Line, Rect, String
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
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.pdfgen.canvas import Canvas


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "backend" / "prisma" / "schema.prisma"
MARKDOWN_PATH = ROOT / "docs" / "database-data-model.md"
PDF_PATH = ROOT / "output" / "pdf" / "ellodb-veri-modeli.pdf"

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN_X = 18 * mm
MARGIN_TOP = 19 * mm
MARGIN_BOTTOM = 17 * mm
CONTENT_WIDTH = PAGE_WIDTH - (2 * MARGIN_X)

NAVY = colors.HexColor("#17324D")
BLUE = colors.HexColor("#2F6B95")
GREEN = colors.HexColor("#2F855A")
INK = colors.HexColor("#283747")
MUTED = colors.HexColor("#66737F")
PALE_BLUE = colors.HexColor("#EEF5FA")
PALE_GREEN = colors.HexColor("#ECF7F0")
LINE_COLOR = colors.HexColor("#C8D7E3")
WHITE = colors.white

SCALAR_TYPES = {
    "String",
    "Int",
    "BigInt",
    "Boolean",
    "DateTime",
    "Bytes",
    "Float",
    "Decimal",
    "Json",
}

MODEL_DESCRIPTIONS = {
    "User": "Kimlik doğrulama, rol, profil ve kullanıcıya bağlı tüm iş kayıtlarının merkezidir.",
    "ContactInvitation": "Kullanıcılar arasındaki bekleyen, kabul edilen veya reddedilen iletişim davetlerini tutar.",
    "SupportTicket": "Kullanıcının açtığı destek talebini, atanan admini, önceliği ve yaşam döngüsünü saklar.",
    "SupportTicketActivity": "Destek taleplerindeki atama, durum ve öncelik değişikliklerinin denetim geçmişidir.",
    "Conversation": "Direkt, grup ve yalnızca yöneticilere açık yönetim sohbetlerini tek yapıda temsil eder.",
    "ConversationParticipant": "Kullanıcı ile sohbet arasındaki üyelik, rol, okuma ve ayrılma durumunu tutar.",
    "Message": "Mesaj içeriğini, reply bağını, forward bilgisini ve yumuşak silme durumunu saklar.",
    "MessageBookmark": "Bir kullanıcının belirli bir mesajı kişisel olarak kaydetmesini sağlar.",
    "ConversationPreference": "Kullanıcıya özel sohbet kaydetme, arşivleme ve gizleme tercihlerini tutar.",
    "CallRecord": "Birebir sesli aramaların arayan, alıcı, durum ve zaman bilgisini kaydeder.",
    "MessageAttachment": "Mesaj eklerinin dosya adı, MIME türü, boyutu ve ikili verisini PostgreSQL'de saklar.",
}

MODEL_GROUPS = [
    ("Kimlik ve iletişim", ["User", "ContactInvitation"]),
    ("Destek sistemi", ["SupportTicket", "SupportTicketActivity"]),
    ("Sohbet çekirdeği", ["Conversation", "ConversationParticipant"]),
    ("Mesajlaşma", ["Message", "MessageAttachment"]),
    ("Kişisel durum ve çağrı", ["MessageBookmark", "ConversationPreference", "CallRecord"]),
]


@dataclass(frozen=True)
class Field:
    name: str
    raw_type: str
    attributes: str

    @property
    def base_type(self) -> str:
        return self.raw_type.removesuffix("?").removesuffix("[]")

    @property
    def optional(self) -> bool:
        return self.raw_type.endswith("?")


@dataclass(frozen=True)
class Model:
    name: str
    table_name: str
    fields: tuple[Field, ...]
    directives: tuple[str, ...]


@dataclass(frozen=True)
class Relation:
    source_model: str
    source_field: str
    source_columns: tuple[str, ...]
    target_model: str
    target_columns: tuple[str, ...]
    on_delete: str
    optional: bool
    unique: bool

    @property
    def cardinality(self) -> str:
        if self.unique:
            return "0..1 -> 1" if self.optional else "1 -> 1"
        return "N -> 0..1" if self.optional else "N -> 1"


def parse_blocks(schema: str, keyword: str) -> list[tuple[str, str]]:
    pattern = re.compile(rf"{keyword}\s+(\w+)\s*\{{(.*?)\n\}}", re.DOTALL)
    return [(match.group(1), match.group(2)) for match in pattern.finditer(schema)]


def parse_schema() -> tuple[list[Model], dict[str, list[str]], list[Relation]]:
    schema = SCHEMA_PATH.read_text(encoding="utf-8")
    enums: dict[str, list[str]] = {}
    for name, body in parse_blocks(schema, "enum"):
        enums[name] = [
            line.strip()
            for line in body.splitlines()
            if line.strip() and not line.strip().startswith("//")
        ]

    raw_models = parse_blocks(schema, "model")
    model_names = {name for name, _ in raw_models}
    models: list[Model] = []

    for name, body in raw_models:
        fields: list[Field] = []
        directives: list[str] = []
        table_name = name
        for raw_line in body.splitlines():
            line = raw_line.strip()
            if not line or line.startswith("//"):
                continue
            if line.startswith("@@"):
                directives.append(line)
                map_match = re.match(r'@@map\("([^"]+)"\)', line)
                if map_match:
                    table_name = map_match.group(1)
                continue
            parts = line.split(maxsplit=2)
            if len(parts) >= 2:
                fields.append(
                    Field(
                        name=parts[0],
                        raw_type=parts[1],
                        attributes=parts[2] if len(parts) == 3 else "",
                    )
                )
        models.append(
            Model(
                name=name,
                table_name=table_name,
                fields=tuple(fields),
                directives=tuple(directives),
            )
        )

    model_by_name = {model.name: model for model in models}
    relations: list[Relation] = []
    for model in models:
        physical_by_name = {field.name: field for field in model.fields}
        for field in model.fields:
            if field.base_type not in model_names or "@relation" not in field.attributes:
                continue
            fields_match = re.search(r"fields:\s*\[([^\]]+)\]", field.attributes)
            refs_match = re.search(r"references:\s*\[([^\]]+)\]", field.attributes)
            if not fields_match or not refs_match:
                continue
            source_columns = tuple(
                item.strip() for item in fields_match.group(1).split(",")
            )
            target_columns = tuple(
                item.strip() for item in refs_match.group(1).split(",")
            )
            delete_match = re.search(r"onDelete:\s*(\w+)", field.attributes)
            unique = all(
                "@unique" in physical_by_name[column].attributes
                for column in source_columns
                if column in physical_by_name
            )
            relations.append(
                Relation(
                    source_model=model.name,
                    source_field=field.name,
                    source_columns=source_columns,
                    target_model=field.base_type,
                    target_columns=target_columns,
                    on_delete=delete_match.group(1) if delete_match else "Default",
                    optional=field.optional,
                    unique=unique,
                )
            )

    if len(models) != 11:
        raise RuntimeError(
            f"Beklenen 11 Prisma modeli yerine {len(models)} model bulundu. "
            "Rapor açıklamalarını gözden geçirin."
        )
    if len(enums) != 10:
        raise RuntimeError(
            f"Beklenen 10 enum yerine {len(enums)} enum bulundu. "
            "Rapor açıklamalarını gözden geçirin."
        )
    return models, enums, relations


def is_physical(field: Field, enum_names: set[str]) -> bool:
    return field.base_type in SCALAR_TYPES or field.base_type in enum_names


def normalize_attributes(field: Field) -> str:
    labels: list[str] = []
    attrs = field.attributes
    if "@id" in attrs:
        labels.append("PK")
    if "@unique" in attrs:
        labels.append("Unique")
    if field.optional:
        labels.append("Nullable")
    else:
        labels.append("Not null")
    if "@updatedAt" in attrs:
        labels.append("Otomatik güncellenir")
    default_start = attrs.find("@default(")
    if default_start >= 0:
        value_start = default_start + len("@default(")
        depth = 1
        cursor = value_start
        while cursor < len(attrs) and depth:
            if attrs[cursor] == "(":
                depth += 1
            elif attrs[cursor] == ")":
                depth -= 1
            cursor += 1
        if depth == 0:
            labels.append(f"Default: {attrs[value_start:cursor - 1]}")
    db_match = re.search(r"@db\.(\w+)", attrs)
    if db_match:
        labels.append(db_match.group(1))
    return ", ".join(labels)


def display_type(field: Field) -> str:
    suffix = "?" if field.optional else ""
    if field.raw_type.endswith("[]"):
        suffix = "[]"
    return f"{field.base_type}{suffix}"


def model_directive_summary(model: Model) -> list[str]:
    values: list[str] = []
    for directive in model.directives:
        if directive.startswith("@@map"):
            continue
        values.append(directive.replace("@@", ""))
    return values


def markdown_escape(value: str) -> str:
    return value.replace("|", r"\|").replace("\n", " ")


def generate_markdown(
    models: list[Model],
    enums: dict[str, list[str]],
    relations: list[Relation],
) -> str:
    enum_names = set(enums)
    today = date.today().strftime("%d.%m.%Y")
    lines = [
        "# ElloDB Güncel Veri Modeli",
        "",
        f"Güncelleme tarihi: {today}",
        "",
        "Kaynak: `backend/prisma/schema.prisma`",
        "",
        "> Bu dosya `scripts/generate-database-model-report.py` tarafından "
        "üretilir. Şema değiştiğinde betiği yeniden çalıştırın.",
        "",
        "## Genel Bakış",
        "",
        "ellO, PostgreSQL üzerinde Prisma ORM kullanan gerçek zamanlı bir "
        "mesajlaşma uygulamasıdır. Güncel şema kullanıcı, iletişim daveti, "
        "destek talebi, direkt/grup/yönetim sohbeti, mesaj, reply, bookmark, "
        "kişisel sohbet tercihi, çağrı geçmişi ve kalıcı mesaj eki akışlarını "
        "kapsar.",
        "",
        f"- {len(models)} fiziksel tablo",
        f"- {len(enums)} enum",
        f"- {len(relations)} açık foreign-key ilişkisi",
        "- UUID tabanlı anahtarlar ve PostgreSQL",
        "- Mesaj retry idempotency, soft delete ve kullanıcıya özel tercihler",
        "",
        "## Model Envanteri",
        "",
        "| Prisma modeli | PostgreSQL tablosu | Fiziksel alan | Açıklama |",
        "| --- | --- | ---: | --- |",
    ]
    for model in models:
        physical = [
            field for field in model.fields if is_physical(field, enum_names)
        ]
        lines.append(
            f"| `{model.name}` | `{model.table_name}` | {len(physical)} | "
            f"{markdown_escape(MODEL_DESCRIPTIONS[model.name])} |"
        )

    lines.extend(["", "## Ayrıntılı Modeller", ""])
    for model in models:
        lines.extend(
            [
                f"### {model.name} (`{model.table_name}`)",
                "",
                MODEL_DESCRIPTIONS[model.name],
                "",
                "| Alan | Tür | Kural |",
                "| --- | --- | --- |",
            ]
        )
        for field in model.fields:
            if not is_physical(field, enum_names):
                continue
            lines.append(
                f"| `{field.name}` | `{display_type(field)}` | "
                f"{markdown_escape(normalize_attributes(field))} |"
            )
        directives = model_directive_summary(model)
        if directives:
            lines.extend(
                [
                    "",
                    "Model kuralları: "
                    + ", ".join(f"`{markdown_escape(value)}`" for value in directives),
                ]
            )
        lines.append("")

    lines.extend(
        [
            "## ER Diyagramı",
            "",
            "```mermaid",
            "erDiagram",
        ]
    )
    for relation in relations:
        target_mark = "o|" if relation.optional else "||"
        source_mark = "o|" if relation.unique else "o{"
        label = relation.source_field.replace('"', "")
        lines.append(
            f'  {relation.target_model} {target_mark}--{source_mark} '
            f'{relation.source_model} : "{label}"'
        )
    lines.extend(["```", "", "## İlişki Özeti", ""])
    lines.extend(
        [
            "| Kaynak | Hedef | FK alanı | Kardinalite | Silme davranışı |",
            "| --- | --- | --- | --- | --- |",
        ]
    )
    for relation in relations:
        lines.append(
            f"| `{relation.source_model}` | `{relation.target_model}` | "
            f"`{', '.join(relation.source_columns)}` | {relation.cardinality} | "
            f"`{relation.on_delete}` |"
        )

    lines.extend(["", "## Enumlar", ""])
    for enum_name, values in enums.items():
        lines.append(f"- `{enum_name}`: " + ", ".join(f"`{value}`" for value in values))

    lines.extend(
        [
            "",
            "## Veri Bütünlüğü ve Tasarım Notları",
            "",
            "- `users.email`, `users.username` ve isteğe bağlı `automationId` "
            "tekildir.",
            "- `conversations.externalRef` dış otomasyon çağrılarında "
            "idempotency sağlar. Farklı externalRef değerleriyle birden fazla "
            "BOT grubu oluşturulabilir.",
            "- `conversations.parentConversationId` bir grup için en fazla bir "
            "gizli yönetim sohbeti olmasını sağlar.",
            "- `conversation_participants` birleşik anahtarı aynı kullanıcıyı "
            "aynı sohbete iki kez eklemeyi engeller.",
            "- `messages(senderId, clientMessageId)` benzersizliği retry "
            "sırasında aynı mesajın iki kez yazılmasını engeller.",
            "- Okundu bilgisi ayrı MessageStatus tablosu yerine katılımcının "
            "`lastReadAt` alanıyla izlenir.",
            "- Mesaj reply ilişkisi `replyToMessageId` self-reference alanıyla "
            "korunur.",
            "- Dosyalar yalnızca URL olarak değil, `MessageAttachment.data` "
            "alanında `Bytes` olarak kalıcı saklanır.",
            "- Eski SQL Server raporundaki grup oluşturma trigger'ı güncel "
            "Prisma şemasında yoktur; yetkilendirme uygulama katmanındadır.",
            "- Direkt sohbet çifti için database-level unique pair key yoktur; "
            "tekilleştirme servis katmanında yapılır.",
            "",
            "## Doğrulama",
            "",
            "```powershell",
            "cd backend",
            "npm.cmd run prisma:validate",
            "npm.cmd run db:audit",
            "```",
            "",
        ]
    )
    return "\n".join(lines)


def register_fonts() -> tuple[str, str]:
    regular = Path("C:/Windows/Fonts/arial.ttf")
    bold = Path("C:/Windows/Fonts/arialbd.ttf")
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("ElloSans", str(regular)))
        pdfmetrics.registerFont(TTFont("ElloSans-Bold", str(bold)))
        return "ElloSans", "ElloSans-Bold"
    return "Helvetica", "Helvetica-Bold"


class PageNumberCanvas(Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states: list[dict] = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        page_count = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            if self._pageNumber > 1:
                self.setStrokeColor(LINE_COLOR)
                self.line(MARGIN_X, 12 * mm, PAGE_WIDTH - MARGIN_X, 12 * mm)
                self.setFillColor(MUTED)
                self.setFont("ElloSans", 8)
                self.drawString(MARGIN_X, 7.8 * mm, "ElloDB Veri Modeli")
                self.drawRightString(
                    PAGE_WIDTH - MARGIN_X,
                    7.8 * mm,
                    f"Sayfa {self._pageNumber} / {page_count}",
                )
            super().showPage()
        super().save()


class SectionLabel(Flowable):
    def __init__(self, text: str, font_name: str):
        super().__init__()
        self.text = text
        self.font_name = font_name
        self.width = 55 * mm
        self.height = 9 * mm

    def draw(self):
        self.canv.setFillColor(BLUE)
        self.canv.roundRect(0, 0, self.width, self.height, 4.5 * mm, fill=1, stroke=0)
        self.canv.setFillColor(WHITE)
        self.canv.setFont(self.font_name, 8.5)
        self.canv.drawCentredString(self.width / 2, 3.1 * mm, self.text.upper())


class SchemaDiagram(Flowable):
    def __init__(
        self,
        title: str,
        nodes: dict[str, tuple[float, float, float, float]],
        edges: Iterable[tuple[str, str]],
        font_name: str,
        bold_font: str,
    ):
        super().__init__()
        self.title = title
        self.nodes = nodes
        self.edges = list(edges)
        self.font_name = font_name
        self.bold_font = bold_font
        self.width = CONTENT_WIDTH
        self.height = 102 * mm

    def draw(self):
        canvas = self.canv
        canvas.setFillColor(PALE_BLUE)
        canvas.roundRect(0, 0, self.width, self.height, 3 * mm, fill=1, stroke=0)
        canvas.setFillColor(NAVY)
        canvas.setFont(self.bold_font, 11)
        canvas.drawString(7 * mm, self.height - 10 * mm, self.title)

        for source, target in self.edges:
            sx, sy, sw, sh = self.nodes[source]
            tx, ty, tw, th = self.nodes[target]
            start_x = sx + sw / 2
            start_y = sy + sh / 2
            end_x = tx + tw / 2
            end_y = ty + th / 2
            canvas.setStrokeColor(colors.HexColor("#94AFC1"))
            canvas.setLineWidth(0.8)
            canvas.line(start_x, start_y, end_x, end_y)

        for name, (x, y, width, height) in self.nodes.items():
            canvas.setFillColor(WHITE)
            canvas.setStrokeColor(BLUE if name in {"User", "Conversation", "Message"} else GREEN)
            canvas.setLineWidth(1.1)
            canvas.roundRect(x, y, width, height, 2 * mm, fill=1, stroke=1)
            canvas.setFillColor(NAVY)
            canvas.setFont(self.bold_font, 8.2)
            canvas.drawCentredString(x + width / 2, y + height - 5.2 * mm, name)
            canvas.setFillColor(MUTED)
            canvas.setFont(self.font_name, 6.8)
            canvas.drawCentredString(x + width / 2, y + 3.5 * mm, "PK/FK ilişkili model")


def make_styles(font_name: str, bold_font: str):
    sample = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            parent=sample["Title"],
            fontName=bold_font,
            fontSize=28,
            leading=33,
            alignment=TA_CENTER,
            textColor=NAVY,
            spaceAfter=5 * mm,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=sample["Normal"],
            fontName=font_name,
            fontSize=12,
            leading=17,
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
            spaceBefore=2 * mm,
            spaceAfter=4 * mm,
        ),
        "h2": ParagraphStyle(
            "Heading2",
            parent=sample["Heading2"],
            fontName=bold_font,
            fontSize=12,
            leading=15,
            textColor=BLUE,
            spaceBefore=3 * mm,
            spaceAfter=2 * mm,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=sample["BodyText"],
            fontName=font_name,
            fontSize=9,
            leading=13,
            textColor=INK,
            spaceAfter=2.5 * mm,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=sample["BodyText"],
            fontName=font_name,
            fontSize=7.4,
            leading=9.6,
            textColor=INK,
        ),
        "small_bold": ParagraphStyle(
            "SmallBold",
            parent=sample["BodyText"],
            fontName=bold_font,
            fontSize=7.4,
            leading=9.6,
            textColor=NAVY,
        ),
        "small_header": ParagraphStyle(
            "SmallHeader",
            parent=sample["BodyText"],
            fontName=bold_font,
            fontSize=7.4,
            leading=9.6,
            textColor=WHITE,
        ),
        "cover_box": ParagraphStyle(
            "CoverBox",
            parent=sample["BodyText"],
            fontName=font_name,
            fontSize=9.5,
            leading=15,
            textColor=INK,
            leftIndent=3 * mm,
            rightIndent=3 * mm,
        ),
        "note": ParagraphStyle(
            "Note",
            parent=sample["BodyText"],
            fontName=font_name,
            fontSize=8.3,
            leading=12,
            textColor=INK,
            borderColor=LINE_COLOR,
            borderWidth=0.6,
            borderPadding=8,
            backColor=PALE_BLUE,
            spaceBefore=2 * mm,
            spaceAfter=3 * mm,
        ),
    }


def cell(text: str, style) -> Paragraph:
    return Paragraph(str(text).replace("&", "&amp;"), style)


def styled_table(
    rows: list[list[object]],
    widths: list[float],
    font_name: str,
    repeat_rows: int = 1,
    compact: bool = False,
) -> Table:
    table = Table(rows, colWidths=widths, repeatRows=repeat_rows, hAlign="LEFT")
    body_size = 6.7 if compact else 7.2
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("FONTNAME", (0, 0), (-1, 0), "ElloSans-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), font_name),
                ("FONTSIZE", (0, 0), (-1, 0), 7.4),
                ("FONTSIZE", (0, 1), (-1, -1), body_size),
                ("LEADING", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.35, LINE_COLOR),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PALE_BLUE]),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
            ]
        )
    )
    return table


def add_model_section(
    story: list,
    model: Model,
    enum_names: set[str],
    styles,
    font_name: str,
):
    story.append(Paragraph(f"{model.name} <font color='#66737F'>({model.table_name})</font>", styles["h2"]))
    story.append(Paragraph(MODEL_DESCRIPTIONS[model.name], styles["body"]))
    rows: list[list[object]] = [
        [
            cell("Alan", styles["small_header"]),
            cell("Tür", styles["small_header"]),
            cell("Kural", styles["small_header"]),
        ]
    ]
    for field in model.fields:
        if not is_physical(field, enum_names):
            continue
        rows.append(
            [
                cell(field.name, styles["small"]),
                cell(display_type(field), styles["small"]),
                cell(normalize_attributes(field), styles["small"]),
            ]
        )
    story.append(
        styled_table(
            rows,
            [40 * mm, 31 * mm, CONTENT_WIDTH - 71 * mm],
            font_name,
            compact=True,
        )
    )
    directives = model_directive_summary(model)
    if directives:
        story.append(Spacer(1, 1.5 * mm))
        story.append(
            Paragraph(
                "<b>Model kuralları:</b> "
                + "; ".join(value.replace("&", "&amp;") for value in directives),
                styles["small"],
            )
        )
    story.append(Spacer(1, 3 * mm))


def draw_cover(canvas: Canvas, doc):
    canvas.saveState()
    canvas.setFillColor(WHITE)
    canvas.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
    canvas.restoreState()


def draw_later_page(canvas: Canvas, doc):
    if canvas.getPageNumber() == 1:
        return
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.setFont("ElloSans-Bold", 8.2)
    canvas.drawString(MARGIN_X, PAGE_HEIGHT - 11 * mm, "ellO / ElloDB")
    canvas.setFillColor(MUTED)
    canvas.setFont("ElloSans", 7.8)
    canvas.drawRightString(
        PAGE_WIDTH - MARGIN_X,
        PAGE_HEIGHT - 11 * mm,
        "PostgreSQL + Prisma veri modeli",
    )
    canvas.setStrokeColor(LINE_COLOR)
    canvas.line(MARGIN_X, PAGE_HEIGHT - 14 * mm, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 14 * mm)
    canvas.restoreState()


def build_pdf(
    models: list[Model],
    enums: dict[str, list[str]],
    relations: list[Relation],
):
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
    doc = BaseDocTemplate(
        str(PDF_PATH),
        pagesize=A4,
        leftMargin=MARGIN_X,
        rightMargin=MARGIN_X,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM,
        title="ElloDB Güncel Veri Modeli",
        author="ellO",
        subject="PostgreSQL ve Prisma veritabanı şema analizi",
    )
    doc.addPageTemplates(
        [
            PageTemplate(id="content", frames=[frame], onPage=draw_later_page),
        ]
    )
    story: list = []

    story.extend(
        [
            Spacer(1, 24 * mm),
            SectionLabel("Veri Modeli Raporu", bold_font),
            Spacer(1, 10 * mm),
            Paragraph("ElloDB", styles["title"]),
            Paragraph(
                "ellO Mesajlaşma Uygulaması - Güncel Veritabanı Şema Analizi",
                styles["subtitle"],
            ),
            Spacer(1, 17 * mm),
        ]
    )
    cover_rows = [
        [cell("<b>Bu rapor şunları içerir:</b>", styles["cover_box"])],
        [cell(f"• {len(models)} PostgreSQL tablosunun ayrıntılı açıklaması", styles["cover_box"])],
        [cell("• İki bölümlü güncel ER diyagramı", styles["cover_box"])],
        [cell(f"• {len(relations)} foreign-key ilişkisinin özeti", styles["cover_box"])],
        [cell("• Enum, indeks ve veri bütünlüğü notları", styles["cover_box"])],
    ]
    cover_table = Table(cover_rows, colWidths=[128 * mm], hAlign="CENTER")
    cover_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALE_BLUE),
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#A9C6D9")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8 * mm),
                ("TOPPADDING", (0, 0), (-1, 0), 6 * mm),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 6 * mm),
            ]
        )
    )
    story.extend(
        [
            cover_table,
            Spacer(1, 15 * mm),
            Paragraph(
                f"PostgreSQL · Prisma ORM · Güncelleme {date.today().strftime('%d.%m.%Y')}",
                styles["subtitle"],
            ),
            PageBreak(),
        ]
    )

    enum_names = set(enums)
    story.extend(
        [
            Paragraph("1. Genel Bakış", styles["h1"]),
            Paragraph(
                "ElloDB; kullanıcı yönetimi, iletişim davetleri, destek talepleri, "
                "direkt/grup/yönetim sohbetleri, gerçek zamanlı mesajlar, reply ve "
                "bookmark kayıtları, kişisel sohbet tercihleri, çağrı geçmişi ve "
                "kalıcı dosya eklerini kapsayan PostgreSQL veritabanıdır. Prisma "
                "şeması uygulamanın tek güncel model kaynağıdır.",
                styles["body"],
            ),
            Paragraph(
                "<b>Eski rapordan temel fark:</b> SQL Server ve 7 tablo yerine "
                f"PostgreSQL üzerinde {len(models)} tablo ve {len(enums)} enum "
                "kullanılır. Eski MessageStatus tablosu ve grup oluşturma trigger'ı "
                "güncel şemada bulunmaz.",
                styles["note"],
            ),
            Paragraph("Model Envanteri", styles["h2"]),
        ]
    )
    inventory_rows: list[list[object]] = [
        [
            cell("Prisma modeli", styles["small_header"]),
            cell("PostgreSQL tablosu", styles["small_header"]),
            cell("Alan", styles["small_header"]),
            cell("Amaç", styles["small_header"]),
        ]
    ]
    for model in models:
        physical_count = len(
            [field for field in model.fields if is_physical(field, enum_names)]
        )
        inventory_rows.append(
            [
                cell(model.name, styles["small"]),
                cell(model.table_name, styles["small"]),
                cell(str(physical_count), styles["small"]),
                cell(MODEL_DESCRIPTIONS[model.name], styles["small"]),
            ]
        )
    story.extend(
        [
            styled_table(
                inventory_rows,
                [34 * mm, 42 * mm, 12 * mm, CONTENT_WIDTH - 88 * mm],
                font_name,
                compact=True,
            ),
            PageBreak(),
        ]
    )

    model_by_name = {model.name: model for model in models}
    section_number = 2
    for group_title, names in MODEL_GROUPS:
        story.append(Paragraph(f"{section_number}. {group_title}", styles["h1"]))
        for name in names:
            add_model_section(
                story,
                model_by_name[name],
                enum_names,
                styles,
                font_name,
            )
        story.append(PageBreak())
        section_number += 1

    story.append(Paragraph(f"{section_number}. ER Diyagramları", styles["h1"]))
    story.append(
        Paragraph(
            "Diyagramlar okunabilirlik için mesajlaşma çekirdeği ve destek/iletişim "
            "modülleri olarak ikiye ayrılmıştır. Çizgiler açık foreign-key "
            "bağlantılarını gösterir.",
            styles["body"],
        )
    )
    core_nodes = {
        "User": (7 * mm, 59 * mm, 40 * mm, 18 * mm),
        "Conversation": (65 * mm, 72 * mm, 44 * mm, 18 * mm),
        "ConversationParticipant": (61 * mm, 38 * mm, 52 * mm, 18 * mm),
        "Message": (126 * mm, 59 * mm, 38 * mm, 18 * mm),
        "MessageAttachment": (124 * mm, 20 * mm, 43 * mm, 18 * mm),
        "MessageBookmark": (7 * mm, 20 * mm, 44 * mm, 18 * mm),
        "ConversationPreference": (60 * mm, 5 * mm, 54 * mm, 18 * mm),
    }
    core_edges = [
        ("Conversation", "User"),
        ("ConversationParticipant", "User"),
        ("ConversationParticipant", "Conversation"),
        ("Message", "User"),
        ("Message", "Conversation"),
        ("MessageAttachment", "Message"),
        ("MessageBookmark", "User"),
        ("MessageBookmark", "Message"),
        ("ConversationPreference", "User"),
        ("ConversationPreference", "Conversation"),
    ]
    story.append(
        SchemaDiagram(
            "Mesajlaşma çekirdeği",
            core_nodes,
            core_edges,
            font_name,
            bold_font,
        )
    )
    story.append(Spacer(1, 5 * mm))
    auxiliary_nodes = {
        "User": (7 * mm, 57 * mm, 40 * mm, 18 * mm),
        "ContactInvitation": (65 * mm, 69 * mm, 47 * mm, 18 * mm),
        "SupportTicket": (65 * mm, 36 * mm, 47 * mm, 18 * mm),
        "SupportTicketActivity": (123 * mm, 36 * mm, 49 * mm, 18 * mm),
        "Conversation": (7 * mm, 12 * mm, 44 * mm, 18 * mm),
        "CallRecord": (123 * mm, 69 * mm, 42 * mm, 18 * mm),
    }
    auxiliary_edges = [
        ("ContactInvitation", "User"),
        ("SupportTicket", "User"),
        ("SupportTicketActivity", "SupportTicket"),
        ("SupportTicketActivity", "User"),
        ("CallRecord", "User"),
        ("CallRecord", "Conversation"),
    ]
    story.extend(
        [
            SchemaDiagram(
                "Destek, iletişim ve çağrı modülleri",
                auxiliary_nodes,
                auxiliary_edges,
                font_name,
                bold_font,
            ),
            PageBreak(),
        ]
    )
    section_number += 1

    story.extend(
        [
            Paragraph(f"{section_number}. İlişki Özeti", styles["h1"]),
            Paragraph(
                "Kardinalite, foreign key alanının nullable ve unique olmasına göre "
                "gösterilir. Silme davranışı Prisma şemasındaki onDelete kuralıdır.",
                styles["body"],
            ),
        ]
    )
    relation_rows: list[list[object]] = [
        [
            cell("Kaynak", styles["small_header"]),
            cell("Hedef", styles["small_header"]),
            cell("FK", styles["small_header"]),
            cell("Kardinalite", styles["small_header"]),
            cell("Silme", styles["small_header"]),
        ]
    ]
    for relation in relations:
        relation_rows.append(
            [
                cell(relation.source_model, styles["small"]),
                cell(relation.target_model, styles["small"]),
                cell(", ".join(relation.source_columns), styles["small"]),
                cell(relation.cardinality, styles["small"]),
                cell(relation.on_delete, styles["small"]),
            ]
        )
    story.extend(
        [
            styled_table(
                relation_rows,
                [37 * mm, 37 * mm, 39 * mm, 28 * mm, CONTENT_WIDTH - 141 * mm],
                font_name,
                compact=True,
            ),
            PageBreak(),
        ]
    )
    section_number += 1

    story.extend(
        [
            Paragraph(f"{section_number}. Enumlar ve İndeksler", styles["h1"]),
            Paragraph("Enumlar", styles["h2"]),
        ]
    )
    enum_rows: list[list[object]] = [
        [
            cell("Enum", styles["small_header"]),
            cell("Değerler", styles["small_header"]),
        ]
    ]
    for enum_name, values in enums.items():
        enum_rows.append(
            [
                cell(enum_name, styles["small"]),
                cell(", ".join(values), styles["small"]),
            ]
        )
    story.append(
        styled_table(
            enum_rows,
            [48 * mm, CONTENT_WIDTH - 48 * mm],
            font_name,
            compact=True,
        )
    )
    story.extend(
        [
            Spacer(1, 4 * mm),
            Paragraph("Önemli Benzersizlik ve İndeks Kuralları", styles["h2"]),
            Paragraph(
                "• email, username ve isteğe bağlı automationId tekildir.<br/>"
                "• externalRef dış otomasyon çağrılarını idempotent yapar.<br/>"
                "• parentConversationId grup başına tek yönetim sohbetini korur.<br/>"
                "• conversationId + userId aynı üyeliğin iki kez yazılmasını önler.<br/>"
                "• senderId + clientMessageId mesaj retry tekrarlarını engeller.<br/>"
                "• conversationId + createdAt mesaj geçmişi sıralaması ve pagination "
                "için indekslidir.<br/>"
                "• ticket durum/öncelik ve atanmış admin sorguları bileşik indekslerle "
                "desteklenir.<br/>"
                "• Şema denetimi 46 beklenen indeks ve 22 foreign-key silme kuralını "
                "otomatik kontrol eder.",
                styles["body"],
            ),
            PageBreak(),
        ]
    )
    section_number += 1

    story.extend(
        [
            Paragraph(f"{section_number}. Tasarım ve Doğrulama Notları", styles["h1"]),
            Paragraph("Güncel Tasarım Kararları", styles["h2"]),
            Paragraph(
                "• Okundu bilgisi ayrı MessageStatus tablosu yerine "
                "ConversationParticipant.lastReadAt alanıyla izlenir.<br/>"
                "• Reply ilişkisi Message.replyToMessageId self-reference alanıyla "
                "saklanır; hedef mesaj silinirse alan SetNull olur.<br/>"
                "• Mesaj silme soft delete yaklaşımıyla deletedAt alanında tutulur.<br/>"
                "• Dosya ekleri MessageAttachment.data alanında Bytes olarak kalıcıdır.<br/>"
                "• Bot gruplarında externalRef tekildir; farklı externalRef değerleri "
                "birden fazla bot grubuna izin verir.<br/>"
                "• Grup başına isteğe bağlı tek bir management sohbeti bulunabilir.<br/>"
                "• Eski SQL Server trigger'ı kaldırılmıştır; grup yetkilendirmesi "
                "uygulama katmanındadır.",
                styles["body"],
            ),
            Paragraph("Bilinen Veri Modeli Sınırı", styles["h2"]),
            Paragraph(
                "Direkt sohbetteki iki kullanıcıyı normalize eden database-level "
                "unique pair key bulunmaz. Mevcut servis aynı çifti uygulama kilidiyle "
                "tekilleştirir. Yüksek eşzamanlılık hedeflenirse normalize pair key ve "
                "unique constraint ayrıca değerlendirilmelidir.",
                styles["note"],
            ),
            Paragraph("Doğrulama Komutları", styles["h2"]),
            Paragraph(
                "<font name='Courier'>cd backend<br/>"
                "npm.cmd run prisma:validate<br/>"
                "npm.cmd run db:audit</font>",
                styles["note"],
            ),
            Paragraph("Belgeyi Yeniden Üretme", styles["h2"]),
            Paragraph(
                "<font name='Courier'>"
                "python scripts/generate-database-model-report.py"
                "</font><br/><br/>"
                "Komut güncel backend/prisma/schema.prisma dosyasını okuyarak hem "
                "docs/database-data-model.md kaynağını hem de bu PDF'yi üretir.",
                styles["body"],
            ),
            Spacer(1, 8 * mm),
            Paragraph(
                "Kaynak şema: backend/prisma/schema.prisma<br/>"
                "Teknik denetim: docs/database-constraint-index-audit.md",
                styles["small"],
            ),
        ]
    )

    doc.build(story, canvasmaker=PageNumberCanvas)


def main():
    models, enums, relations = parse_schema()
    MARKDOWN_PATH.write_text(
        generate_markdown(models, enums, relations),
        encoding="utf-8",
        newline="\n",
    )
    build_pdf(models, enums, relations)
    print(f"Markdown: {MARKDOWN_PATH}")
    print(f"PDF: {PDF_PATH}")
    print(
        f"Models: {len(models)}, enums: {len(enums)}, "
        f"relations: {len(relations)}"
    )


if __name__ == "__main__":
    main()
