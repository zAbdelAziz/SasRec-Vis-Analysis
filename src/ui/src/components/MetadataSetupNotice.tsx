import type { DatasetStatus } from '../types/api';

type Props = { dataset?: DatasetStatus; refresh: () => Promise<void> };

export default function MetadataSetupNotice({ dataset, refresh }: Props) {
  if (dataset?.id_mapping === 'verified') return null;
  return <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
    <strong>MovieLens metadata is required for this question.</strong>
    <p className="mt-1 text-xs">After installing the Python dependencies, run <code className="rounded bg-white px-1.5 py-1">npm run setup:data</code> from the project root. Existing data is skipped.</p>
    {dataset?.mapping_message && <p className="mt-2 text-xs">{dataset.mapping_message}</p>}
    {!!dataset?.missing_metadata_files?.length && <p className="mt-1 break-words text-xs">Missing: {dataset.missing_metadata_files.join(', ')}</p>}
    <button className="btn-muted mt-2" type="button" onClick={() => void refresh()}>Recheck</button>
  </div>;
}
