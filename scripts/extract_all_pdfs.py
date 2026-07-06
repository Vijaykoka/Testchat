"""Extract text from all PDFs, chunk, and stream to chunks.json."""
import json
import os
import re
import sys

try:
    import pymupdf
except ImportError:
    import fitz as pymupdf

PDF_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    'Chat bot',
    'Chatbot - Sample files-20260706T124527Z-3-001',
    'Chatbot - Sample files',
)
OUTPUT_FILE = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    'src', 'data', 'chunks.json',
)

CHUNK_WORDS = 250
OVERLAP_WORDS = 50


def split_text(text: str, chunk_words: int = CHUNK_WORDS, overlap: int = OVERLAP_WORDS) -> list[str]:
    words = text.split()
    total = len(words)
    if total == 0:
        return []
    chunks: list[str] = []
    i = 0
    while i < total:
        end = min(i + chunk_words, total)
        if end < total:
            last_period = -1
            for j in range(end, i, -1):
                if words[j - 1].endswith('.'):
                    last_period = j
                    break
            if last_period > i + chunk_words // 2:
                end = last_period
        chunk = ' '.join(words[i:end]).strip()
        if len(chunk) >= 20:
            chunks.append(chunk)
        next_i = end - overlap
        if next_i <= i:
            next_i = end
        if next_i >= total:
            break
        i = next_i
    return chunks


def get_pdf_short_title(filename: str) -> str:
    name = os.path.splitext(filename)[0]
    name = re.sub(r'[_-]+', ' ', name).strip()
    return name


def main():
    if not os.path.isdir(PDF_DIR):
        print(f"PDF directory not found: {PDF_DIR}")
        sys.exit(1)

    pdf_files = sorted([
        f for f in os.listdir(PDF_DIR) if f.lower().endswith('.pdf')
    ])

    print(f"Found {len(pdf_files)} PDFs in: {PDF_DIR}")

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    total_chunks = 0
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as out:
        out.write('[')
        first = True

        for pdf_file in pdf_files:
            pdf_path = os.path.join(PDF_DIR, pdf_file)
            title = get_pdf_short_title(pdf_file)
            print(f"  Processing: {pdf_file}...", end=' ')

            try:
                doc = pymupdf.open(pdf_path)
            except Exception as e:
                print(f"FAILED to open: {e}")
                continue

            page_count = doc.page_count
            chunk_count = 0

            for page_num in range(page_count):
                page = doc.load_page(page_num)
                raw = page.get_text().strip()
                if not raw:
                    continue

                clean_text = re.sub(r'\s+', ' ', raw).strip()
                if len(clean_text) < 20:
                    continue

                segments = split_text(clean_text)
                for seg_idx, segment in enumerate(segments):
                    record = {
                        'id': f"{pdf_file}_p{page_num + 1}_s{seg_idx}",
                        'text': segment,
                        'page': page_num + 1,
                        'source': pdf_file,
                        'title': title,
                    }
                    if not first:
                        out.write(',')
                    out.write(json.dumps(record, ensure_ascii=False))
                    first = False
                    chunk_count += 1

            doc.close()
            total_chunks += chunk_count
            print(f"{page_count} pages, {chunk_count} chunks")

        out.write(']')

    print(f"\nTotal: {total_chunks} chunks saved to {OUTPUT_FILE}")
    print("Done!")


if __name__ == '__main__':
    main()
