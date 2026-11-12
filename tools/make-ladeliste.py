"""Erzeugt Testdateien und die Vorlage für den Tabellen-Import.

Aufruf:  python3 -I tools/make-ladeliste.py fixtures
         python3 -I tools/make-ladeliste.py vorlage
"""
import argparse
import io
import json
import re
import subprocess
import zipfile
from pathlib import Path

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
FIX = ROOT / 'tests' / 'fixtures'
DATA = ROOT / 'data'

BOXEN_HINWEIS = {
    'de': 'Maße nur für lose Boxen; Boxen auf Dolly ohne Maße, die baut man im Schritt Boxen.',
    'en': 'Dimensions only for loose boxes; boxes on a dolly without dimensions, those are built in the Boxes step.',
}

REITER_NAMEN = {
    'de': {'cases': 'Cases', 'traversen': 'Traversen', 'boxen': 'Boxen', 'set': 'Set'},
    'en': {'cases': 'Cases', 'traversen': 'Trusses', 'boxen': 'Boxes', 'set': 'Set'},
}
DATEIEN = {'de': 'Truckload-Ladeliste.xlsx', 'en': 'Truckload-Loadlist.xlsx'}
JA_NEIN = {'de': ['ja', 'nein'], 'en': ['yes', 'no']}
ZEILEN_MAX = 500  # Zeilen mit Auswahllisten


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


JS_DATEN = """
import { SPALTEN, FARBEN, HINWEIS } from './js/model/ladeliste.js';
import { CATEGORIES } from './js/data/categories.js';
import { GEWERKE_EN } from './js/i18n/i18n.js';
console.log(JSON.stringify({
  spalten: SPALTEN, farben: FARBEN, hinweis: HINWEIS,
  gewerke: { de: CATEGORIES.map(c => c.name), en: CATEGORIES.map(c => GEWERKE_EN[c.name] ?? c.name) },
}));
"""


def lade_daten():
    """Kopfzeilen, Farben, Gewerke und Hinweis kommen aus den JS-Modulen (eine Quelle)."""
    out = subprocess.run(['node', '--input-type=module', '-e', JS_DATEN], cwd=ROOT,
                         capture_output=True, text=True, check=True, timeout=60).stdout
    return json.loads(out)


def liste(ws, spalte, werte, zeilen, frei=False):
    dv = DataValidation(type='list', formula1='"' + ','.join(werte) + '"', allow_blank=True)
    dv.showErrorMessage = not frei  # Gewerk: freie Eingabe bleibt erlaubt
    ws.add_data_validation(dv)
    dv.add(f'{get_column_letter(spalte)}3:{get_column_letter(spalte)}{zeilen}')


def vorlage_datei(d, sprache):
    wb = Workbook()
    wb.remove(wb.active)
    for reiter, spalten in d['spalten'].items():
        ws = wb.create_sheet(REITER_NAMEN[sprache][reiter])
        ws.append([d['hinweis'][sprache]])
        ws.append([sp[sprache] for sp in spalten])
        ws['A1'].font = Font(italic=True, color='666666')
        for c, sp in enumerate(spalten, 1):
            zelle = ws.cell(row=2, column=c)
            zelle.font = Font(bold=True)
            zelle.fill = PatternFill('solid', fgColor='DDE6F3' if sp['pflicht'] else 'F0F0F0')
            zelle.alignment = Alignment(wrap_text=True, vertical='center')
            ws.column_dimensions[get_column_letter(c)].width = max(14, len(sp[sprache]) + 4)
            ende = ZEILEN_MAX + 2
            if sp['key'] == 'gewerk':
                liste(ws, c, d['gewerke'][sprache], ende, frei=True)
            elif sp['key'] == 'farbe':
                liste(ws, c, [f[sprache] for f in d['farben']], ende)
            elif sp['key'] in ('rollen', 'tippen'):
                liste(ws, c, JA_NEIN[sprache], ende)
            elif sp['key'] == 'lage':
                liste(ws, c, ['1', '2', '3'], ende)
        if reiter == 'boxen':
            hinweis = BOXEN_HINWEIS[sprache]
            spalte_breite = [sp['key'] for sp in spalten].index('breite') + 1
            ws.cell(row=2, column=spalte_breite).comment = Comment(hinweis, 'Truckload')
            ws.cell(row=1, column=len(spalten) + 2, value=hinweis).font = Font(italic=True, color='666666')
        ws.column_dimensions['A'].width = max(ws.column_dimensions['A'].width, 28)
        ws.freeze_panes = 'A3'
    return wb


def vorlage():
    d = lade_daten()
    for sprache, name in DATEIEN.items():
        vorlage_datei(d, sprache).save(DATA / name)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('fixtures', help='Testdateien nach tests/fixtures/ schreiben')
    sub.add_parser('vorlage', help='Vorlagen nach data/ schreiben')
    args = ap.parse_args()
    if args.cmd == 'fixtures':
        fixtures()
    elif args.cmd == 'vorlage':
        vorlage()


if __name__ == '__main__':
    main()
