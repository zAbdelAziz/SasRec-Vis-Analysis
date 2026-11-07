import H1PhaseOneView from './H1PhaseOneView';
import H1InternalView from './H1InternalView';
import type { VizProps } from './types';

/** Research Phase I unchanged; research Phase II investigates actual attention. */
export default function H1View(props: VizProps) {
  if (!Array.isArray(props.result.views.users)) {
    return <p className="surface p-4">This result does not contain the current genre analysis. Run the investigation again.</p>;
  }
  return props.result.phase === 1 ? <H1PhaseOneView {...props} /> : <H1InternalView {...props} />;
}
