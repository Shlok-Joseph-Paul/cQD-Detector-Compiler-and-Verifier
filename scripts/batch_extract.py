#!/usr/bin/env python3
"""Concurrent, hash-cached PDF text extraction and page triage for CQD imports."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any


CATEGORIES: dict[str, tuple[str, ...]] = {
    "metadata": (r"\bdoi\b", r"\babstract\b", r"\bcite this\b", r"\bjournal\b"),
    "scope": (r"photodiode", r"photovoltaic", r"rectif", r"junction", r"photoconductor"),
    "detectivity": (r"detectivity", r"\bd\s*\*", r"jones", r"\bnep\b"),
    "noise": (r"noise", r"shot.noise", r"johnson", r"spectral density", r"spectrum analyzer"),
    "noise_instrument": (
        r"lock.?in", r"noise analy[sz]er", r"spectrum analy[sz]er",
        r"signal analy[sz]er", r"source.?measure(?:ment)? unit", r"\bSMU\b",
        r"parameter analy[sz]er", r"oscilloscope", r"fast Fourier transform",
        r"\bFFT\b", r"transimpedance", r"electrometer",
    ),
    "device": (r"device fabrication", r"device structure", r"device stack", r"\bito\b", r"\bfto\b"),
    "conditions": (r"\bbias\b", r"temperature", r"frequency", r"\bhz\b", r"active area", r"device area"),
}


@dataclass(frozen=True)
class PdfJob:
    path: Path
    digest: str
    duplicate_of: str | None


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def split_pdftotext(raw: str) -> list[str]:
    pages = raw.replace("\r\n", "\n").replace("\r", "\n").split("\f")
    while pages and not pages[-1].strip():
        pages.pop()
    return pages


def extract_pages(path: Path) -> tuple[list[str], str]:
    executable = shutil.which("pdftotext")
    if executable:
        result = subprocess.run(
            [executable, "-layout", str(path), "-"], check=True,
            capture_output=True, text=True, errors="replace",
        )
        return split_pdftotext(result.stdout), "pdftotext"
    try:
        from pypdf import PdfReader
    except ImportError as error:
        raise RuntimeError("Install pypdf or provide pdftotext on PATH.") from error
    reader = PdfReader(str(path))
    return [page.extract_text() or "" for page in reader.pages], "pypdf"


def supporting_information_links(path: Path) -> list[str]:
    """Return PDF links that look like publisher supporting information."""
    try:
        from pypdf import PdfReader
    except ImportError:
        return []
    links: set[str] = set()
    try:
        reader = PdfReader(str(path))
        for page in reader.pages:
            for annotation_ref in page.get("/Annots", []):
                annotation = annotation_ref.get_object()
                action = annotation.get("/A")
                uri = action.get("/URI") if action else None
                if not isinstance(uri, str):
                    continue
                lowered = uri.lower()
                if "suppl_file" in lowered or "supporting-information" in lowered or "supplement" in lowered:
                    links.add(uri)
    except Exception:
        return []
    return sorted(links)


def triage_pages(pages: list[str]) -> dict[str, list[int]]:
    triage = {category: [] for category in CATEGORIES}
    compiled = {
        category: [re.compile(pattern, re.IGNORECASE) for pattern in patterns]
        for category, patterns in CATEGORIES.items()
    }
    for page_number, page in enumerate(pages, start=1):
        for category, patterns in compiled.items():
            if any(pattern.search(page) for pattern in patterns):
                triage[category].append(page_number)
    return triage


def page_marked_text(pages: list[str]) -> str:
    return "\n\n".join(
        f"=== PDF PAGE {number} ===\n\n{page.strip()}"
        for number, page in enumerate(pages, start=1)
    ).rstrip() + "\n"


def extract_job(job: PdfJob, cache_dir: Path, force: bool) -> dict[str, Any]:
    text_path = cache_dir / f"{job.digest}.txt"
    metadata_path = cache_dir / f"{job.digest}.json"
    cache_hit = text_path.exists() and metadata_path.exists() and not force
    if cache_hit:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    else:
        pages, engine = extract_pages(job.path)
        extracted_characters = sum(len(page.strip()) for page in pages)
        low_text_pages = sum(1 for page in pages if len(page.strip()) < 80)
        metadata = {
            "sha256": job.digest,
            "page_count": len(pages),
            "extracted_characters": extracted_characters,
            "extraction_engine": engine,
            "needs_ocr": extracted_characters < max(500, len(pages) * 80)
            or (bool(pages) and low_text_pages / len(pages) > 0.6),
            "candidate_pages": triage_pages(pages),
            "text_path": str(text_path),
            "supporting_information_urls": supporting_information_links(job.path),
        }
        text_path.write_text(page_marked_text(pages), encoding="utf-8")
        metadata_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return {
        **metadata, "pdf_path": str(job.path), "filename": job.path.name,
        "cache_hit": cache_hit, "duplicate_of": job.duplicate_of,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Batch-extract and triage CQD research PDFs with hash caching.")
    parser.add_argument("pdfs", nargs="+", type=Path)
    parser.add_argument("--cache-dir", type=Path, default=Path("/private/tmp/cqd-paper-import-cache"))
    parser.add_argument("--workers", type=int, default=min(8, max(2, os.cpu_count() or 2)))
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    paths = [item.expanduser().resolve() for item in args.pdfs]
    missing = [str(item) for item in paths if not item.is_file()]
    if missing:
        print("Missing PDF(s): " + ", ".join(missing), file=sys.stderr)
        return 2
    invalid = [str(item) for item in paths if item.suffix.lower() != ".pdf"]
    if invalid:
        print("Expected PDF file(s): " + ", ".join(invalid), file=sys.stderr)
        return 2
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    first_by_hash: dict[str, str] = {}
    jobs: list[PdfJob] = []
    for item in paths:
        digest = sha256(item)
        duplicate_of = first_by_hash.get(digest)
        first_by_hash.setdefault(digest, str(item))
        jobs.append(PdfJob(path=item, digest=digest, duplicate_of=duplicate_of))
    records: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        future_to_job = {executor.submit(extract_job, job, args.cache_dir, args.force): job for job in jobs}
        for future in as_completed(future_to_job):
            job = future_to_job[future]
            try:
                records.append(future.result())
            except Exception as error:
                records.append({"pdf_path": str(job.path), "filename": job.path.name, "sha256": job.digest, "duplicate_of": job.duplicate_of, "error": str(error)})
    order = {str(item): index for index, item in enumerate(paths)}
    records.sort(key=lambda item: order[item["pdf_path"]])
    manifest = {
        "schema_version": 1, "cache_dir": str(args.cache_dir.resolve()),
        "paper_count": len(records),
        "cache_hits": sum(bool(record.get("cache_hit")) for record in records),
        "duplicates": sum(bool(record.get("duplicate_of")) for record in records),
        "papers": records,
    }
    manifest_path = args.cache_dir / "batch-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    output = manifest if args.json else {
        "manifest_path": str(manifest_path), "paper_count": manifest["paper_count"],
        "cache_hits": manifest["cache_hits"], "duplicates": manifest["duplicates"],
        "needs_ocr": sum(bool(record.get("needs_ocr")) for record in records),
        "errors": sum("error" in record for record in records),
    }
    print(json.dumps(output, ensure_ascii=False))
    print(f"Manifest: {manifest_path}", file=sys.stderr)
    return 1 if any("error" in record for record in records) else 0


if __name__ == "__main__":
    raise SystemExit(main())
