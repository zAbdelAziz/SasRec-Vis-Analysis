import type { VizProps } from './types';
import DemographicGenreView from './DemographicGenreView';
import H3RepresentationView from './H3RepresentationView';

export default function H3View(props: VizProps) {
  return props.result.phase === 1 ? <DemographicGenreView {...props} /> : <H3RepresentationView {...props} />;
}
