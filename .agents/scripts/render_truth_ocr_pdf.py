import fitz
from pathlib import Path
src = Path('attached_assets/Truth_Engine_OCR_Verification_FORMATTED_1789513770990.pdf')
out = Path('.agents/outputs/truth-ocr-pdf')
out.mkdir(parents=True, exist_ok=True)
doc = fitz.open(src)
print(f'pages={doc.page_count}')
for i, page in enumerate(doc):
    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    path = out / f'page-{i+1}.png'
    pix.save(path)
    print(path)
