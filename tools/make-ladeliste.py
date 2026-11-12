"""Erzeugt Testdateien (und später die Vorlage) für den Tabellen-Import.

Aufruf:  python3 -I tools/make-ladeliste.py fixtures
"""
import argparse
import io
import re
import zipfile
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import PatternFill

ROOT = Path(__file__).resolve().parent.parent
FIX = ROOT / 'tests' / 'fixtures'


def basis_workbook():
    wb = Workbook()
    ws = wb.active
    ws.title = 'Cases'
    ws.append(['Name', 'Breite', 'Anzahl', 'Doppelt'])
    ws.append(['Kiste A', 120, 2, '=C2*2'])
    ws.append(['Kiste B', 0.5, 1, '=C3*2'])
    ws.append(['Kiste C', '60,5', 3, '=C4*2'])
    fill = PatternFill('solid', fgColor='DDDDDD')
    for r in range(5, 10):  # formatierte, aber leere Zeilen
        for c in range(1, 5):
            ws.cell(row=r, column=c).fill = fill
    ws2 = wb.create_sheet('Set')
    ws2.append(['Name', 'Teile'])
    ws2.append(['Set 1', 'A & B <x>'])
    # Lücke mittendrin: A5 und D5 gefüllt, B5/C5 leer
    ws3 = wb.create_sheet('Luecke')
    ws3['A5'] = 'links'
    ws3['D5'] = 'rechts'
    return wb


def save_basis():
    wb = basis_workbook()
    wb.save(FIX / 'ladeliste-basis.xlsx')
    return wb


def cached_values(src):
    """Stellt sicher, dass Formelzellen ein zwischengespeichertes Ergebnis tragen (wie von Excel)."""
    res = {'C2*2': 4, 'C3*2': 2, 'C4*2': 6}
    out = io.BytesIO()
    with zipfile.ZipFile(src) as zi, zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zo:
        for item in zi.infolist():
            data = zi.read(item.filename)
            if item.filename == 'xl/worksheets/sheet1.xml':
                x = data.decode('utf8')
                x = re.sub(r'<f>([^<]*)</f><v\s*/>|<f>([^<]*)</f><v></v>',
                           lambda m: f'<f>{m.group(1) or m.group(2)}</f><v>{res[m.group(1) or m.group(2)]}</v>', x)
                x = re.sub(r'<f>([^<]*)</f>(?!<v>)',
                           lambda m: f'<f>{m.group(1)}</f><v>{res[m.group(1)]}</v>', x)
                data = x.encode('utf8')
            zo.writestr(item, data)
    return out.getvalue()


def shared_strings(raw):
    """Schreibt alle Textzellen über sharedStrings.xml (Excel-Normalfall), auch wenn openpyxl inlineStr schreibt."""
    zi = zipfile.ZipFile(io.BytesIO(raw))
    table = []

    def conv(m):
        idx = len(table)
        table.append(m.group(3))
        return f'<c {m.group(1)}t="s"{m.group(2)}><v>{idx}</v></c>'

    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zo:
        for item in zi.infolist():
            data = zi.read(item.filename)
            if item.filename.startswith('xl/worksheets/sheet'):
                x = data.decode('utf8')
                x = re.sub(r'<c ([^>]*?)t="inlineStr"([^>]*)><is>(.*?)</is></c>', conv, x)
                data = x.encode('utf8')
            elif item.filename == '[Content_Types].xml':
                x = data.decode('utf8').replace(
                    '</Types>',
                    '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>')
                data = x.encode('utf8')
            elif item.filename == 'xl/_rels/workbook.xml.rels':
                x = data.decode('utf8').replace(
                    '</Relationships>',
                    '<Relationship Id="rIdSS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>')
                data = x.encode('utf8')
            zo.writestr(item, data)
        sst = ''.join(f'<si>{t}</si>' for t in table)
        zo.writestr('xl/sharedStrings.xml',
                    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                    f'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="{len(table)}" uniqueCount="{len(table)}">{sst}</sst>')
    return out.getvalue()


def fixtures():
    FIX.mkdir(parents=True, exist_ok=True)
    save_basis()
    raw = cached_values(FIX / 'ladeliste-basis.xlsx')
    assert b't="inlineStr"' in zipfile.ZipFile(io.BytesIO(raw)).read('xl/worksheets/sheet1.xml')
    (FIX / 'ladeliste-inlinestr.xlsx').write_bytes(raw)
    (FIX / 'ladeliste-basis.xlsx').write_bytes(shared_strings(raw))
    de = 'Name;Breite;Notiz\r\nKiste A;60,5;"a;b"\r\nKiste B;1,25;"Zeile1\nZeile2"\r\nKiste C;2;"sagt ""hallo"""\r\n'
    (FIX / 'ladeliste-de.csv').write_bytes(b'\xef\xbb\xbf' + de.encode('utf8'))
    en = 'Name,Width,Note\nCase A,60.5,"a,b"\nCase B,1.25,plain\n'
    (FIX / 'ladeliste-en.csv').write_text(en, encoding='utf8')


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('fixtures', help='Testdateien nach tests/fixtures/ schreiben')
    args = ap.parse_args()
    if args.cmd == 'fixtures':
        fixtures()


if __name__ == '__main__':
    main()
