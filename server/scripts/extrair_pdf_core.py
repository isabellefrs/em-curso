"""Helpers para preservar linhas e colunas extraídas de PDFs com pypdf."""
import re


def normalizar_layout(texto):
    linhas = []
    for linha in texto.replace('\f', '\n').splitlines():
        linha = linha.strip()
        if linha:
            # No layout do PDF, espaços repetidos entre células marcam colunas.
            linha = re.sub(r'(?<=\S)[ \t]{2,}(?=\S)', ' | ', linha)
        linhas.append(linha)
    return re.sub(r'\n{3,}', '\n\n', '\n'.join(linhas)).strip()


def dividir_em_trechos(texto, limite=1400, sobreposicao=180):
    trechos = []
    inicio = 0
    while inicio < len(texto):
        fim = min(inicio + limite, len(texto))
        quebra = texto.rfind('\n', inicio + limite // 2, fim)
        if fim < len(texto) and quebra > inicio:
            fim = quebra
        trecho = texto[inicio:fim].strip()
        if trecho:
            trechos.append(trecho)
        if fim >= len(texto):
            break
        inicio = max(inicio + 1, fim - sobreposicao)
    return trechos
