import { CubeDiagram } from '../../../components/CubeDiagram';
import { parseAlg } from '../../../domain/cube/notation';
import { applyAlg, solvedState } from '../../../domain/cube/state';
import {
  CLOCK_FACES,
  FONTS,
  SIZES,
  THEMES,
  type ClockFace,
  type Font,
  type Size,
  type Theme,
} from '../../../lib/appearance';
import { CUBE_SKINS, skinById } from '../../../lib/cube-skins';
import { strings } from '../../../lib/strings';
import { useSetting } from '../../../hooks/use-setting';
import { useResolvedTheme } from '../../../hooks/use-appearance';
import { InstallSection } from './InstallSection';

/** A case with some colour in it, so a skin can be judged before it is chosen. */
const PREVIEW_SETUP = "R U R' U' R' F R2 U' R' U' R U R' F'";

const THEME_LABELS: Record<Theme, string> = {
  system: strings.settings.themeSystem,
  light: strings.settings.themeLight,
  dark: strings.settings.themeDark,
};

const FONT_LABELS: Record<Font, string> = {
  sans: strings.settings.fontSans,
  mono: strings.settings.fontMono,
  system: strings.settings.fontSystem,
};

const SIZE_LABELS: Record<Size, string> = {
  small: strings.settings.sizeSmall,
  medium: strings.settings.sizeMedium,
  large: strings.settings.sizeLarge,
};

const CLOCK_FACE_LABELS: Record<ClockFace, string> = {
  match: strings.settings.clockFaceMatch,
  mono: strings.settings.clockFaceMono,
  digital: strings.settings.clockFaceDigital,
};

const HOLD_THRESHOLDS = [0, 200, 300, 500] as const;

export function SettingsScreen() {
  const [theme, setTheme] = useSetting('ui.theme');
  const [font, setFont] = useSetting('ui.font');
  const [textSize, setTextSize] = useSetting('ui.textSize');
  const [clockSize, setClockSize] = useSetting('ui.clockSize');
  const [clockFace, setClockFace] = useSetting('ui.clockFace');
  const resolved = useResolvedTheme();
  const [skinId, setSkinId] = useSetting('ui.cubeSkin');
  const [twistyMode, setTwistyMode] = useSetting('ui.twistyMode');
  const [twoLookDefault, setTwoLookDefault] = useSetting('trainer.twoLookDefault');
  const [showAlgs, setShowAlgs] = useSetting('trainer.showAlgs');
  const [showRotationAlgs, setShowRotationAlgs] = useSetting('trainer.showRotationAlgs');
  const [holdThresholdMs, setHoldThresholdMs] = useSetting('timer.holdThresholdMs');
  const [inspectionEnabled, setInspectionEnabled] = useSetting('timer.inspectionEnabled');
  const [isPreviewShown, setPreviewShown] = useSetting('timer.showScramblePreview');
  const [splitMode, setSplitMode] = useSetting('timer.splitMode');

  const previewState = previewCube();

  return (
    <main className="screen screen--scroll">
      {/* First, and only until it is done: on iOS nothing else says the app
          can leave the browser, and the share sheet is not somewhere anyone
          looks unprompted. */}
      <InstallSection />

      <section className="data-section">
        <h2 className="data-section__title">{strings.settings.appearance}</h2>

        <ChoiceRow
          label={strings.settings.theme}
          options={THEMES}
          labels={THEME_LABELS}
          value={theme}
          onChange={setTheme}
        />
        <p className="data-section__hint">{strings.settings.themeHint}</p>

        <ChoiceRow
          label={strings.settings.font}
          options={FONTS}
          labels={FONT_LABELS}
          value={font}
          onChange={setFont}
        />
        <p className="data-section__hint">{strings.settings.fontHint}</p>

        <ChoiceRow
          label={strings.settings.textSize}
          options={SIZES}
          labels={SIZE_LABELS}
          value={textSize}
          onChange={setTextSize}
        />

        <ChoiceRow
          label={strings.settings.clockSize}
          options={SIZES}
          labels={SIZE_LABELS}
          value={clockSize}
          onChange={setClockSize}
        />
        <p className="data-section__hint">{strings.settings.clockSizeHint}</p>

        <ChoiceRow
          label={strings.settings.clockFace}
          options={CLOCK_FACES}
          labels={CLOCK_FACE_LABELS}
          value={clockFace}
          onChange={setClockFace}
        />
        <p className="data-section__hint">{strings.settings.clockFaceHint}</p>

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
                skin={skinById(skin.id, resolved)}
                label={skin.name}
              />
              <span className="skin__name">{skin.name}</span>
            </label>
          ))}
        </div>

        <ChoiceRow
          label={strings.settings.twistyMode}
          options={['2D', '3D'] as const}
          labels={{ '2D': strings.settings.previewFlat, '3D': strings.settings.preview3d }}
          value={twistyMode}
          onChange={setTwistyMode}
        />
        <p className="data-section__hint">{strings.settings.twistyModeHint}</p>
      </section>

      <section className="data-section">
        <h2 className="data-section__title">{strings.settings.trainer}</h2>

        <div className="settings-row">
          <span>{strings.settings.twoLookDefault}</span>
          <div className="settings-row__choices">
            <button
              type="button"
              className={twoLookDefault ? 'is-active' : ''}
              onClick={() => setTwoLookDefault(true)}
            >
              {strings.trainer.twoLook}
            </button>
            <button
              type="button"
              className={twoLookDefault ? '' : 'is-active'}
              onClick={() => setTwoLookDefault(false)}
            >
              {strings.trainer.fullSet}
            </button>
          </div>
        </div>

        <label className="toggle">
          <input
            type="checkbox"
            checked={showAlgs}
            onChange={(event) => setShowAlgs(event.target.checked)}
          />
          {strings.settings.showAlgs}
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={showRotationAlgs}
            onChange={(event) => setShowRotationAlgs(event.target.checked)}
          />
          {strings.settings.showRotationAlgs}
        </label>
        <p className="data-section__hint">{strings.settings.showRotationAlgsHint}</p>
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

        <label className="toggle">
          <input
            type="checkbox"
            checked={isPreviewShown}
            onChange={(event) => setPreviewShown(event.target.checked)}
          />
          {strings.settings.showScramblePreview}
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={splitMode === 'phases'}
            onChange={(event) => setSplitMode(event.target.checked ? 'phases' : 'total')}
          />
          {strings.settings.splitMode}
        </label>
        <p className="data-section__hint">{strings.settings.splitModeHint}</p>
      </section>
    </main>
  );
}

/**
 * A setting with a handful of named values, as a row of buttons. There are
 * enough of these that writing the markup out each time is how they drift
 * apart.
 */
function ChoiceRow<T extends string>({
  label,
  options,
  labels,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="settings-row">
      <span>{label}</span>
      <div className="settings-row__choices">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={option === value ? 'is-active' : ''}
            onClick={() => onChange(option)}
          >
            {labels[option]}
          </button>
        ))}
      </div>
    </div>
  );
}

function previewCube() {
  const parsed = parseAlg(PREVIEW_SETUP);
  return parsed.ok ? applyAlg(solvedState(), parsed.moves) : solvedState();
}
