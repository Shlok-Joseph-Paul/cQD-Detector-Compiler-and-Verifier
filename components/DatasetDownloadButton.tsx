import { DATASET_VERSION } from "@/lib/data/releases";

export function DatasetDownloadButton() {
  return (
    <a className="primary-button" href="/api/dataset" download>
      Download v{DATASET_VERSION} CSV
    </a>
  );
}
