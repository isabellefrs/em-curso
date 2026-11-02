"""Extrai PDFs do ZIP sem executar conteúdo ou confiar nos caminhos internos."""
import hashlib
import io
import json
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from pypdf import PdfReader
from extrair_pdf_core import dividir_em_trechos, normalizar_layout

origem = Path(sys.argv[1])
destino = Path(__file__).resolve().parents[1] / 'data' / 'knowledge'
destino.mkdir(parents=True, exist_ok=True)
documentos, trechos, avisos = [], [], []
revisoes = json.loads(Path(__file__).with_name('revisoes-visuais.json').read_text(encoding='utf-8'))

with zipfile.ZipFile(origem) as arquivo:
    for item in sorted(arquivo.infolist(), key=lambda x: x.filename):
        if item.filename.lower().endswith('.txt'):
            print(arquivo.read(item).decode('utf-8-sig', errors='replace'))
        if not item.filename.lower().endswith('.pdf'):
            continue
        bruto = arquivo.read(item)
        hash_doc = hashlib.sha256(bruto).hexdigest()
        nome = Path(item.filename).name
        leitor = PdfReader(io.BytesIO(bruto))
        documento = {'id': hash_doc[:16], 'title': Path(nome).stem, 'filename': nome, 'sha256': hash_doc,
                     'pages': len(leitor.pages), 'kind': 'document', 'importedAt': datetime.now(timezone.utc).isoformat()}
        documentos.append(documento)
        (destino / (documento['id'] + '.pdf')).write_bytes(bruto)
        for numero, pagina in enumerate(leitor.pages, 1):
            texto = normalizar_layout(pagina.extract_text(extraction_mode='layout') or '')
            if len(texto) < 40:
                avisos.append({'document': nome, 'page': numero, 'reason': 'Pouco texto extraível; pode exigir OCR/revisão visual.'})
            if not texto:
                continue
            for indice, trecho in enumerate(dividir_em_trechos(texto)):
                trechos.append({'id': f"{documento['id']}-p{numero}-{indice}", 'documentId': documento['id'],
                               'title': documento['title'], 'page': numero, 'kind': 'document', 'text': trecho})

for revisao in revisoes:
    documento = next((d for d in documentos if d['id'] == revisao['documentId']), None)
    if not documento:
        continue
    for aviso in avisos:
        if aviso['document'] == documento['filename'] and aviso['page'] == revisao['page']:
            aviso['reviewed'] = True
            aviso['reviewNote'] = revisao.get('note', 'Transcrição visual adicionada; dados pessoais de exemplos omitidos.')
    if revisao['text']:
        trechos.append({'id': f"{documento['id']}-p{revisao['page']}-visual", 'documentId': documento['id'],
                       'title': documento['title'], 'page': revisao['page'], 'kind': 'document',
                       'extraction': 'visual-reviewed', 'text': revisao['text']})

resultado = {'version': 1, 'createdAt': datetime.now(timezone.utc).isoformat(), 'documents': documentos, 'chunks': trechos, 'warnings': avisos}
(destino / 'corpus.json').write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'documents': len(documentos), 'pages': sum(d['pages'] for d in documentos), 'chunks': len(trechos), 'warnings': avisos}, ensure_ascii=False))
