"""Server-side PDF report builder (reportlab).

Used by the download-pdf endpoint and by the email feature, so the same report
can be produced without a browser. The layout mirrors the in-browser report in
frontend/src/utils/pdfGenerator.js, including the cover *range* display.
"""
import re
from datetime import datetime
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

BLUE = colors.HexColor('#0066FF')
SLATE_DARK = colors.HexColor('#1E293B')
SLATE_MID = colors.HexColor('#475569')
BORDER = colors.HexColor('#E2E8F0')
LIGHT_BG = colors.HexColor('#F8FAFC')


def _clean_title(title):
    if title == 'Personal Accident Cover Recommendation':
        return 'Personal Accident Insurance'
    return (title or 'Recommended Cover').replace(' Recommendation', '')


def _format_amount(amount):
    if amount >= 10000000:
        return f"{round(amount / 10000000)} Crore"
    if amount >= 100000:
        return f"{round(amount / 100000)} Lakh"
    return f"{round(amount)}"


def format_cover_range(title, cover):
    """Turn a single cover value ("2 Crore", "50 Lakh", "5000000") into a range string."""
    if cover in (None, '', 'N/A'):
        return 'N/A'
    text = re.sub(r'[\u20b9$,]', '', str(cover))
    text = re.sub(r'(?i)\brs\.?', '', text).strip()
    match = re.search(r'([\d.]+)\s*(crore|lakh|cr|l|k|thousand)?', text, re.I)
    if not match:
        return text or 'N/A'
    try:
        num = float(match.group(1))
    except ValueError:
        return text or 'N/A'
    unit = (match.group(2) or '').lower()
    if unit.startswith('cr'):
        raw = num * 10000000
    elif unit in ('l', 'lakh'):
        raw = num * 100000
    elif unit in ('k', 'thousand'):
        raw = num * 1000
    else:
        raw = num

    t = title or ''
    if 'Health' in t or 'Term' in t or 'Personal Accident' in t:
        upper = raw + 10000000
    elif 'Critical Illness' in t:
        upper = raw + 1000000
    elif 'Cyber' in t:
        upper = raw + 1500000
    else:
        upper = raw * 1.25
    return f"Rs. {_format_amount(raw)} - {_format_amount(upper)}"


def _rupees(value):
    try:
        number = float(re.sub(r'[^\d.]', '', str(value)))
        return "Rs. " + f"{int(round(number)):,}"
    except (ValueError, TypeError):
        return 'N/A'


def build_pdf(buffer, customer_data, recommendations):
    """Write the advisory report PDF into `buffer`.

    customer_data: dict with policy_holder, age, vehicle_model, registration_no,
                   manufacturing_year, idv, risk_level (all optional).
    recommendations: list of dicts with title, cover, term, risk, benefits.
    """
    styles = getSampleStyleSheet()
    h_title = ParagraphStyle('t', parent=styles['Title'], textColor=BLUE, fontSize=22, alignment=0, spaceAfter=2)
    h_sub = ParagraphStyle('s', parent=styles['Normal'], textColor=colors.HexColor('#64748B'), fontSize=9)
    h_section = ParagraphStyle('h', parent=styles['Heading2'], textColor=SLATE_DARK, fontSize=14, spaceBefore=14, spaceAfter=6)
    h_rec = ParagraphStyle('r', parent=styles['Heading3'], textColor=BLUE, fontSize=12, spaceBefore=10, spaceAfter=4)
    cell = ParagraphStyle('c', parent=styles['Normal'], fontSize=10, leading=13, textColor=SLATE_DARK)
    cell_label = ParagraphStyle('cl', parent=cell, textColor=SLATE_MID, fontName='Helvetica-Bold')
    note = ParagraphStyle('n', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#94A3B8'), leading=11)

    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm,
                            topMargin=15 * mm, bottomMargin=15 * mm, title='Cover360 Insurance Report')
    story = [
        Paragraph('Cover360 Insurance Report', h_title),
        Paragraph(f"Generated on: {datetime.now().strftime('%d %b %Y')}", h_sub),
        Spacer(1, 6),
        Paragraph('Basic Information', h_section),
    ]

    info_rows = [
        ('Policy Holder', customer_data.get('policy_holder')),
        ('Age', customer_data.get('age')),
        ('Registration No.', customer_data.get('registration_no')),
        ('Vehicle Model', customer_data.get('vehicle_model')),
        ('Manufacture Year', customer_data.get('manufacturing_year')),
        ('IDV', _rupees(customer_data.get('idv'))),
        ('Risk Score', customer_data.get('risk_level')),
    ]
    info_table = Table(
        [[Paragraph(label, cell_label), Paragraph(escape(str(value if value not in (None, '') else 'N/A')), cell)]
         for label, value in info_rows],
        colWidths=[45 * mm, 130 * mm])
    info_table.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, -1), 0.4, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(info_table)

    story.append(Paragraph('Insurance Recommendations', h_section))
    if not recommendations:
        story.append(Paragraph('No recommendations available.', cell))

    for index, rec in enumerate(recommendations, start=1):
        title = rec.get('title') or 'Recommended Cover'
        benefits = rec.get('benefits') or []
        benefit_text = '<br/>'.join(f"&bull; {escape(str(b))}" for b in benefits) if benefits else 'N/A'
        rows = [
            ('Suggested Cover:', format_cover_range(title, rec.get('cover'))),
            ('Policy Term:', rec.get('term') or '1 Year'),
            ('Risk Level:', rec.get('risk') or 'Standard Risk'),
        ]
        data = [[Paragraph(label, cell_label), Paragraph(escape(str(value)), cell)] for label, value in rows]
        data.append([Paragraph('Key Benefits:', cell_label), Paragraph(benefit_text, cell)])
        table = Table(data, colWidths=[40 * mm, 135 * mm])
        table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
            ('BACKGROUND', (0, 0), (0, -1), LIGHT_BG),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(Paragraph(f"{index}. {escape(_clean_title(title))}", h_rec))
        story.append(table)

    story.append(Spacer(1, 14))
    story.append(Paragraph(
        'This report is an indicative advisory based on the details in your motor policy and is not a '
        'guarantee of coverage or premium. Please speak to your advisor before purchasing any policy.', note))
    doc.build(story)