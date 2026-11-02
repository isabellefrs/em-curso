"""Refaz a extração dos PDFs já importados sem perder metadados nem revisões visuais."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader
from extrair_pdf_core import dividir_em_trechos, normalizar_layout


pasta = Path(__file__).resolve().parents[1] / 'data' / 'knowledge'
arquivo_corpus = pasta / 'corpus.json'
arquivo_revisoes = Path(__file__).with_name('revisoes-visuais.json')
base = json.loads(arquivo_corpus.read_text(encoding='utf-8'))
revisoes = json.loads(arquivo_revisoes.read_text(encoding='utf-8'))

novos_trechos = []
avisos = []
faltantes = []
for documento in base['documents']:
    pdf = pasta / f"{documento['id']}.pdf"
    if not pdf.is_file():
        faltantes.append(str(pdf))
        continue
    bruto = pdf.read_bytes()
    if documento.get('sha256') and hashlib.sha256(bruto).hexdigest() != documento['sha256']:
        raise SystemExit(f"Hash diferente do manifesto: {documento['title']}")
    leitor = PdfReader(pdf)
    for numero, pagina in enumerate(leitor.pages, 1):
        texto = normalizar_layout(pagina.extract_text(extraction_mode='layout') or '')
        if len(texto) < 40:
            avisos.append({
                'document': documento['filename'],
                'page': numero,
                'reason': 'Pouco texto extraível; página conferida por OCR/revisão visual quando disponível.',
            })
        for indice, trecho in enumerate(dividir_em_trechos(texto)):
            chunk = {
                'id': f"{documento['id']}-p{numero}-{indice}",
                'documentId': documento['id'],
                'title': documento['title'],
                'page': numero,
                'kind': 'document',
                'text': trecho,
            }
            for campo in ('topic', 'url', 'sourceUrl'):
                if documento.get(campo):
                    chunk[campo] = documento[campo]
            novos_trechos.append(chunk)

if faltantes:
    raise SystemExit('PDFs ausentes; corpus não foi alterado:\n' + '\n'.join(faltantes))

for revisao in revisoes:
    documento = next((d for d in base['documents'] if d['id'] == revisao['documentId']), None)
    if not documento:
        continue
    for aviso in avisos:
        if aviso['document'] == documento['filename'] and aviso['page'] == revisao['page']:
            aviso['reviewed'] = True
            aviso['reviewNote'] = revisao.get(
                'note', 'Transcrição visual revisada; colunas e cabeçalhos preservados.',
            )
    if revisao.get('text'):
        chunk = {
            'id': f"{documento['id']}-p{revisao['page']}-visual",
            'documentId': documento['id'],
            'title': documento['title'],
            'page': revisao['page'],
            'kind': 'document',
            'extraction': 'visual-reviewed',
            'text': revisao['text'],
        }
        for campo in ('topic', 'url', 'sourceUrl'):
            if documento.get(campo):
                chunk[campo] = documento[campo]
        novos_trechos.append(chunk)

atualizado = {
    **base,
    'createdAt': datetime.now(timezone.utc).isoformat(),
    'chunks': novos_trechos,
    'warnings': avisos,
}
temporario = arquivo_corpus.with_suffix('.json.tmp')
temporario.write_text(json.dumps(atualizado, ensure_ascii=False, indent=2), encoding='utf-8')
temporario.replace(arquivo_corpus)
print(json.dumps({
    'documents': len(atualizado['documents']),
    'pages': sum(d.get('pages', 0) for d in atualizado['documents']),
    'chunks': len(novos_trechos),
    'warnings': len(avisos),
    'unreviewed': sum(not w.get('reviewed') for w in avisos),
}, ensure_ascii=False))
