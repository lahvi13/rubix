import { CubeDiagram } from '../../../components/CubeDiagram';
import { parseAlg } from '../../../domain/cube/notation';
import { applyAlg, solvedState } from '../../../domain/cube/state';
import { CUBE_SKINS, skinById } from '../../../lib/cube-skins';
import { strings } from '../../../lib/strings';
import { useSetting } from '../hooks/use-settings';

/** A case with some colour in it, so a skin can be judged before it is chosen. */
const PREVIEW_SETUP = "R U R' U' R' F R2 U' R' U' R U R' F'";

const HOLD_THRESHOLDS = [0, 200, 300, 500] as const;

export function SettingsScreen() {
  const [skinId, setSkinId] = useSetting('ui.cubeSkin');
  const [twistyMode, setTwistyMode] = useSetting('ui.twistyMode');
  const [holdThresholdMs, setHoldThresholdMs] = useSetting('timer.holdThresholdMs');
  const [inspectionEnabled, setInspectionEnabled] = useSetting('timer.inspectionEnabled');

  const previewState = previewCube();

  return (
    <main className="screen screen--scroll">
      <section className="data-section">
        <h2 className="data-section__title">{strings.settings.appearance}</h2>
        <p className="data-section__hint">{strings.settings.skinHint}</p>

        <div className="skins">
          {CUBE_SKINS.map((skin) => (
            <label key={skin.id} className={skin.id === skinId ? 'skin skin--active' : 'skin'}>
              <input
                type="radio"
                name="cube-skin"
                checked={skin.id === skinId}
                onChange={() => setSkinId(skin.id)}
              />
              <CubeDiagram
                className="skin__preview"
                state={previewState}
                view="lastLayer"
                skin={skinById(skin.id)}
                label={skin.name}
              />
              <span className="skin__name">{skin.name}</span>
            </label>
          ))}
        </div>

        <div className="settings-row">
          <span>{strings.settings.twistyMode}</span>
          <div className="settings-row__choices">
            {(['2D', '3D'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={twistyMode === mode ? 'is-active' : ''}
                onClick={() => setTwistyMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="data-section">
        <h2 className="data-section__title">{strings.settings.timer}</h2>

        <div className="settings-row">
          <span>{strings.settings.holdThreshold}</span>
          <div className="settings-row__choices">
            {HOLD_THRESHOLDS.map((value) => (
              <button
                key={value}
                type="button"
                className={holdThresholdMs === value ? 'is-active' : ''}
                onClick={() => setHoldThresholdMs(value)}
              >
                {value === 0 ? strings.settings.holdOff : `${value} ms`}
              </button>
            ))}
          </div>
        </div>

        <label className="toggle">
          <input
            type="checkbox"
            checked={inspectionEnabled}
            onChange={(event) => setInspectionEnabled(event.target.checked)}
          />
          {strings.timer.inspectionToggle}
        </label>
      </section>
    </main>
  );
}

function previewCube() {
  const parsed = parseAlg(PREVIEW_SETUP);
  return parsed.ok ? applyAlg(solvedState(), parsed.moves) : solvedState();
}
