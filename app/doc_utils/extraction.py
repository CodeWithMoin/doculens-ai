import os
from pathlib import Path

from docling.document_converter import DocumentConverter

EASYOCR_HOME = Path(os.getenv("EASYOCR_HOME", Path.home() / ".EasyOCR"))
EASYOCR_HOME.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("EASYOCR_HOME", str(EASYOCR_HOME))

def extract_docling_document(source: str):
    """
    Extract a Docling document from a file path or URL.
    Args:
        source (str): Path or URL to the document.
    Returns:
        Docling document object or None if extraction fails.
    """
    converter = DocumentConverter()
    result = converter.convert(source)
    return result.document if result else None
