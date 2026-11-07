import type { VizProps } from './types';
import H2PhaseOneView from './H2PhaseOneView';
import H2PhaseTwoView from './H2PhaseTwoView';

export default function H2View(props: VizProps) {
  return props.result.phase === 1 ? <H2PhaseOneView {...props} /> : <H2PhaseTwoView {...props} />;
}
