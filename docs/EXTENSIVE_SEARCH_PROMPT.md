# Copy-paste prompt for an extensive CQD photodiode search

Use this as a fresh Codex task in the Detector Data Compiler repository:

```text
Run an extensive online literature search for genuinely new experimental colloidal-quantum-dot photodiode papers that are not already in this atlas.

Scientific requirements:
- The detector must be an experimental, solution-processed CQD photodiode or photovoltaic detector allowed by the repository methodology.
- It must report specific detectivity (D*) in Jones and an identifiable measurement wavelength from 550 nm through 3000 nm.
- Exclude photoconductors, phototransistors, bolometers, epitaxial quantum dots, reviews, perspectives, theory-only work, solar cells without detector characterization, and values copied from comparison tables.
- Prioritize non-heavy-metal absorbers, especially Ag2Te, Ag2Se, InAs, InSb, AgBiS2, and other RoHS-compatible CQDs. Keep Pb- and Hg-based results in a separate lower-priority section rather than mixing them with the non-heavy-metal shortlist.
- Prefer papers with lawful, unauthenticated open-access PDFs. Do not use institutional credentials, cookies, paywall circumvention, or scraped Google Scholar pages.

Search procedure:
1. Search OpenAlex, Crossref, arXiv, public publisher/repository pages, and citation/reference chains from existing atlas papers.
2. Use material synonyms, chemical formulas with and without subscripts, CQD/colloidal nanocrystal terminology, photodiode/photovoltaic detector terms, detectivity/D* terms, and NIR/SWIR/eSWIR wavelength terms.
3. Deduplicate against data/papers.csv by normalized DOI and fuzzy normalized title, including preprint-to-journal version matches.
4. Verify each recommended paper from its abstract or full text: original research, correct device class, reported D*, wavelength in range, and a direct publication or DOI link.
5. Update only the discovery candidate registry and audit log. Do not parse PDFs or edit atlas CSVs yet.
6. Run `pnpm discovery export-shortlist` after updating the registry.

Deliverables:
- Aim for at least 20 genuinely new qualifying papers; if fewer can be verified, report the actual number without padding the list.
- Show a ranked table with title, year, material, wavelength range or measurement wavelength, reported D*, DOI/publication link, open-PDF link, heavy-metal status, and a concise reason to add or reject it.
- Separate “recommended to parse,” “needs manual screening,” “already in atlas/duplicate,” and “out of scope.”
- End by naming the strongest open-access papers to parse next and request my explicit approval before downloading or parsing any PDF.
```

The repository command that turns the resulting candidate registry into the
readable link list is:

```bash
pnpm discovery export-shortlist
```
