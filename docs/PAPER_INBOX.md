# Local watched paper inbox

The paper inbox turns a local folder into a private, review-gated parsing queue.
It does not publish records, change the curated CSV files, download publisher
content, or copy PDFs into the repository.

## Folder layout

Initialize the default inbox:

```bash
pnpm inbox init
```

The default location is `~/Documents/CQD Paper Inbox`. Override it on every
command with `--inbox=/absolute/path`.

```text
CQD Paper Inbox/
├── Incoming/
│   ├── a-paper.pdf
│   └── another-paper/
│       ├── main.pdf
│       ├── supporting-information.pdf
│       └── metadata.json
├── Ready for Review/
├── Needs Attention/
├── Completed/
└── .cqd-paper-inbox/
    ├── state.json
    ├── runner.log
    └── cache/
```

A PDF directly inside `Incoming` is treated as a paper without supplied
Supporting Information. For a paper with one or more supplements, use one
subfolder. Name the article `main.pdf`, or ensure it is the only PDF whose name
does not contain `SI`, `supp`, `supporting`, or `supplement`.

The optional `metadata.json` makes bibliographic staging more reliable:

```json
{
  "title": "Paper title",
  "authors": ["First Author", "Second Author"],
  "journal": "Journal Name",
  "publicationYear": 2026,
  "doi": "10.1234/example",
  "technologyFamily": "cqd",
  "materialClasses": ["PbS"]
}
```

Missing metadata remains a review warning. It is not silently treated as
curator-confirmed information.

## Run and inspect

The scanner waits until a source set is unchanged for 60 seconds, preventing it
from parsing partially downloaded or still-copying PDFs. A newly copied paper
will normally be observed on one scan and queued on the next.

```bash
pnpm inbox once
pnpm inbox status
```

Use `--settle-seconds=120` for a longer stability window and
`--concurrency=4` to process up to four paper folders at once.

PDF extraction requires either `pdftotext` on `PATH` or a Python runtime with
`pypdf`. Select a particular Python runtime with
`--python=/absolute/path/to/python3`. Use the same option when installing the
launch agent so scheduled scans use that runtime.

Successful jobs create two files in `Ready for Review`:

- `<job-id>.proposal.json` contains the complete local paths and structured
  Paper → Device → Measurement proposal.
- `<job-id>.md` contains a concise review summary.

PDFs and full extracted text remain outside the repository. The extracted text
cache is keyed by job and PDF hash under `.cqd-paper-inbox/cache`. Only a human
review may move values into the approved atlas workflow.

If a job fails or its main article is ambiguous, read its note in
`Needs Attention`. Correct the files and let the next scan rediscover the
change, or explicitly retry it:

```bash
pnpm inbox retry --job=inbox-example
pnpm inbox once
```

## Start automatically on macOS

Install the per-user launch agent:

```bash
pnpm inbox install
```

The launch agent runs one bounded scan every 60 seconds and at login. It writes
combined output to `.cqd-paper-inbox/runner.log`. The runner uses a lock, so a
manual scan and a scheduled scan cannot process the same ledger concurrently.

Customize before installation:

```bash
pnpm inbox install --inbox="/absolute/path" --interval-seconds=120 --settle-seconds=90 --concurrency=2 --python="/absolute/path/to/python3"
```

Remove the background launch agent without deleting the inbox, cache, PDFs, or
review proposals:

```bash
pnpm inbox uninstall
```

## Scientific and operational behavior

- Main articles and supplied Supporting Information are extracted together.
- Identical main-PDF hashes are marked as duplicates.
- PDFs already represented in the repository proposal registry are also marked
  as duplicates.
- Different paper jobs are isolated; one failure does not stop the others.
- Low-text PDFs are marked as needing OCR. OCR is not run automatically.
- Proposals preserve missing values, warnings, evidence locations, noise-method
  classifications, and extended-metric review state.
- The watched folder produces proposals only. It never approves, applies,
  commits, pushes, or deploys data.
