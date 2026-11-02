"""Adiciona um PDF oficial à base existente, preservando os demais documentos."""
import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader
from extrair_pdf_core import dividir_em_trechos, normalizar_layout

pasta_conhecimento = Path(__file__).resolve().parents[1] / 'data' / 'knowledge'
corpus = pasta_conhecimento / 'corpus.json'


def dividir(texto, documento, pagina):
    partes = []
    for indice, trecho in enumerate(dividir_em_trechos(texto)):
        partes.append({
                'id': f"{documento['id']}-p{pagina}-{indice}",
                'documentId': documento['id'],
                'title': documento['title'],
                'page': pagina,
                'kind': 'document',
                'topic': 'campus',
                'url': documento['url'],
                'sourceUrl': documento['sourceUrl'],
                'text': trecho,
            })
    return partes


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('pdf', type=Path)
    parser.add_argument('--titulo', required=True)
    parser.add_argument('--url', required=True)
    parser.add_argument('--transcricao', type=Path, help='Texto revisado para páginas escaneadas.')
    args = parser.parse_args()

    bruto = args.pdf.read_bytes()
    digest = hashlib.sha256(bruto).hexdigest()
    documento_id = digest[:16]
    base = json.loads(corpus.read_text(encoding='utf-8'))
    if any(d['id'] == documento_id for d in base['documents']):
        print(f"Já importado: {args.titulo}")
        return

    reader = PdfReader(args.pdf)
    documento = {
        'id': documento_id,
        'title': args.titulo,
        'filename': args.pdf.name,
        'sha256': digest,
        'pages': len(reader.pages),
        'kind': 'document',
        'topic': 'campus',
        'url': args.url,
        'sourceUrl': args.url,
        'importedAt': datetime.now(timezone.utc).isoformat(),
    }
    novos_trechos = []
    for numero, pagina in enumerate(reader.pages, 1):
        texto = normalizar_layout(pagina.extract_text(extraction_mode='layout') or '')
        novos_trechos.extend(dividir(texto, documento, numero))

    if args.transcricao:
        texto = args.transcricao.read_text(encoding='utf-8').strip()
        if texto:
            novos_trechos.append({
                'id': f'{documento_id}-p1-visual',
                'documentId': documento_id,
                'title': documento['title'],
                'page': 1,
                'kind': 'document',
                'topic': 'campus',
                'url': documento['url'],
                'sourceUrl': documento['sourceUrl'],
                'extraction': 'visual-reviewed',
                'text': texto,
            })

    if not novos_trechos:
        raise SystemExit('O PDF não contém texto extraível nem uma transcrição revisada.')

    destino = pasta_conhecimento / f'{documento_id}.pdf'
    if not destino.exists():
        shutil.copyfile(args.pdf, destino)
    base['documents'].append(documento)
    base['chunks'].extend(novos_trechos)
    base.setdefault('warnings', [])
    corpus.write_text(json.dumps(base, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Importado: {args.titulo} — {documento['pages']} páginas, {len(novos_trechos)} trechos.")


if __name__ == '__main__':
    main()
