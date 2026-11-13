import csv
import io
from datetime import datetime, timezone
from typing import List, Dict, Any

import openpyxl
from openpyxl.styles import Font

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from app.schemas.submission import FormSubmissionResponse


def _get_ordered_field_labels(submissions: List[FormSubmissionResponse]) -> List[str]:
    """Collect the union of all field labels across submissions, sorted by display_order."""
    seen_labels: dict[str, int] = {}
    for sub in submissions:
        for ans in sub.answers:
            label = ans.field_label
            d_order = ans.display_order
            if label not in seen_labels or d_order < seen_labels[label]:
                seen_labels[label] = d_order

    return [item[0] for item in sorted(seen_labels.items(), key=lambda x: x[1])]


def _sanitize_cell_value(val: Any) -> Any:
    """Prevent CSV/Excel formula injection by prefixing trigger characters (=, +, -, @) with a quote."""
    if isinstance(val, str) and val.startswith(("=", "+", "-", "@")):
        return f"'{val}"
    return val


def _get_answer_display_value(ans: Any) -> str:
    """Format answer value as text or [file] placeholder."""
    if ans.value_text is not None and ans.value_text != "":
        return ans.value_text
    if ans.file_url:
        return "[file]"
    return ""


class ExportService:
    def generate_csv(self, submissions: List[FormSubmissionResponse]) -> bytes:
        field_labels = _get_ordered_field_labels(submissions)
        header = ["Respondent Identifier", "Status", "Started At", "Submitted At"] + field_labels

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(header)

        for sub in submissions:
            ans_map: Dict[str, str] = {
                ans.field_label: _get_answer_display_value(ans) for ans in sub.answers
            }
            row = [
                _sanitize_cell_value(sub.respondent_identifier or "Anonymous"),
                sub.status,
                sub.started_at.isoformat() if sub.started_at else "",
                sub.submitted_at.isoformat() if sub.submitted_at else "",
            ]
            for label in field_labels:
                row.append(_sanitize_cell_value(ans_map.get(label, "")))
            writer.writerow(row)

        return output.getvalue().encode("utf-8-sig")

    def generate_xlsx(self, submissions: List[FormSubmissionResponse]) -> bytes:
        field_labels = _get_ordered_field_labels(submissions)
        header = ["Respondent Identifier", "Status", "Started At", "Submitted At"] + field_labels

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Submissions"

        ws.append(header)
        for cell in ws[1]:
            cell.font = Font(bold=True)

        for sub in submissions:
            ans_map: Dict[str, str] = {
                ans.field_label: _get_answer_display_value(ans) for ans in sub.answers
            }
            row = [
                _sanitize_cell_value(sub.respondent_identifier or "Anonymous"),
                sub.status,
                sub.started_at.isoformat() if sub.started_at else "",
                sub.submitted_at.isoformat() if sub.submitted_at else "",
            ]
            for label in field_labels:
                row.append(_sanitize_cell_value(ans_map.get(label, "")))
            ws.append(row)

        output = io.BytesIO()
        wb.save(output)
        return output.getvalue()

    def generate_pdf(
        self, submissions: List[FormSubmissionResponse], form_title: str
    ) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Heading1"],
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#18181b"),
        )
        subtitle_style = ParagraphStyle(
            "DocSubTitle",
            parent=styles["Normal"],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#71717a"),
        )
        sub_header_style = ParagraphStyle(
            "SubHeader",
            parent=styles["Heading3"],
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#27272a"),
        )
        meta_style = ParagraphStyle(
            "SubMeta",
            parent=styles["Normal"],
            fontSize=9,
            leading=11,
            textColor=colors.HexColor("#71717a"),
        )
        table_label_style = ParagraphStyle(
            "TableLabel",
            parent=styles["Normal"],
            fontSize=9,
            leading=11,
            textColor=colors.HexColor("#3f3f46"),
        )
        table_val_style = ParagraphStyle(
            "TableVal",
            parent=styles["Normal"],
            fontSize=9,
            leading=11,
            textColor=colors.HexColor("#09090b"),
        )

        story = []

        # Document Header
        story.append(Paragraph(f"Submissions Report — {form_title}", title_style))
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        story.append(
            Paragraph(
                f"Generated on {now_str} · Total Submissions: {len(submissions)}",
                subtitle_style,
            )
        )
        story.append(Spacer(1, 16))

        if not submissions:
            story.append(
                Paragraph(
                    "No submissions match the requested export criteria.", meta_style
                )
            )
        else:
            for i, sub in enumerate(submissions):
                resp_id = sub.respondent_identifier or "Anonymous"
                started = sub.started_at.strftime("%Y-%m-%d %H:%M") if sub.started_at else "N/A"
                submitted = sub.submitted_at.strftime("%Y-%m-%d %H:%M") if sub.submitted_at else "N/A"

                story.append(
                    Paragraph(
                        f"Submission #{sub.id} · {resp_id} [{sub.status.upper()}]",
                        sub_header_style,
                    )
                )
                story.append(
                    Paragraph(
                        f"Started: {started} | Submitted: {submitted} | Version: v{sub.version_number}",
                        meta_style,
                    )
                )
                story.append(Spacer(1, 6))

                if sub.answers:
                    table_data = []
                    for ans in sub.answers:
                        val = _get_answer_display_value(ans) or "(no answer)"
                        table_data.append(
                            [
                                Paragraph(f"<b>{ans.field_label}</b>", table_label_style),
                                Paragraph(val, table_val_style),
                            ]
                        )
                    t = Table(table_data, colWidths=[180, 360])
                    t.setStyle(
                        TableStyle(
                            [
                                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f4f4f5")),
                                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e4e4e7")),
                                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                                ("TOPPADDING", (0, 0), (-1, -1), 4),
                                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                            ]
                        )
                    )
                    story.append(t)
                else:
                    story.append(Paragraph("<i>No answers recorded.</i>", meta_style))

                story.append(Spacer(1, 14))

        doc.build(story)
        return buffer.getvalue()


export_service = ExportService()
