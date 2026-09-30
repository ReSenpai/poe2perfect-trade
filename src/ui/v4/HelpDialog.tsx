import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import { extensionAssetUrl } from '@/lib/catalog/category-art';
import { Icon } from '@/ui/kit/Icon';

/**
 * Teaching data of the help (the parameter help design §8): made-up items, not listings. The totals and
 * the number of matches are worked out from here, so the words and the pictures cannot drift apart.
 */
export const HELP_EXAMPLES = {
  sourceItem: { implicitRarity: 12, life: 82, directFire: 20, allElemental: 15 },
  required: { minimumLife: 80, passingLife: 92, failingLife: 64 },
  alternatives: {
    minimumMatches: 2,
    thresholds: { fire: 35, cold: 30, chaos: 20 },
    item: { fire: 41, cold: 35, chaos: null },
  },
} as const;

/** Total fire resistance of Example A: the direct modifier and the all-elemental one. */
export function totalFire(): number {
  return HELP_EXAMPLES.sourceItem.directFire + HELP_EXAMPLES.sourceItem.allElemental;
}

/** Example B against its conditions: each one met or not (bounds inclusive), how many, and whether that is enough. */
export function alternativesOutcome() {
  const { thresholds, item, minimumMatches } = HELP_EXAMPLES.alternatives;
  const conditions = (['fire', 'cold', 'chaos'] as const).map((stat) => {
    const value = item[stat] as number | null;
    return { stat, value, meets: value !== null && value >= thresholds[stat] };
  });
  const matched = conditions.filter((condition) => condition.meets).length;
  return { conditions, matched, pass: matched >= minimumMatches };
}

const STAT_NAME = { fire: 'Fire', cold: 'Cold', chaos: 'Chaos' } as const;

/** The demo's icons by our own (the parameter panel's): the link of alternatives is compare, the ban is exclude. */
const OURS = { check: 'check', close: 'close', link: 'compare', ban: 'exclude', heart: 'life', fire: 'fire', cold: 'cold', lightning: 'lightning', chaos: 'chaos' } as const;

function HelpIcon({ name, class: className = '' }: { name: keyof typeof OURS; class?: string }) {
  return <Icon name={OURS[name]} class={`icon ${className}`.trim()} />;
}

function Verdict({ pass, children }: { pass: boolean; children: ComponentChildren }) {
  return (
    <span class={`verdict ${pass ? 'pass' : 'fail'}`}>
      <HelpIcon name={pass ? 'check' : 'close'} />
      <span>{children}</span>
    </span>
  );
}

export interface HelpDialogProps {
  onClose: () => void;
}

/**
 * How parameters work (step 39 E): the layout of the parameter help demo, ported (not mounted) — where a
 * stat comes from (Implicit, Explicit, Total) and how a condition matches (Required, Alternatives, Must not have). The
 * examples are pictures, not controls: only Close and Got it take focus. Esc, Close, Got it and a click on the
 * backdrop close it.
 */
export function HelpDialog({ onClose }: HelpDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  // A press that started inside the box (selecting text) and ends on the backdrop does not close it.
  const pressedBackdrop = useRef(false);
  const id = useId();
  const { sourceItem: item, required, alternatives } = HELP_EXAMPLES;
  const total = totalFire();
  const outcome = alternativesOutcome();

  useEffect(() => {
    const box = dialog.current;
    if (box && !box.open) {
      if (typeof box.showModal === 'function') box.showModal();
      else box.setAttribute('open', '');
    }
  }, []);

  return (
    <dialog
      ref={dialog}
      class="p2t-guide"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-intro`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && pressedBackdrop.current) onClose();
        pressedBackdrop.current = false;
      }}
    >
      <div class="shell">
        <header class="header">
          <span class="medallion" aria-hidden="true">
            i
          </span>
          <div>
            <h1 id={`${id}-title`}>How parameters work</h1>
            <p id={`${id}-intro`}>Choose what counts. Then choose what must match.</p>
          </div>
          <button type="button" class="close" aria-label="Close help" onClick={onClose}>
            <HelpIcon name="close" />
          </button>
        </header>

        <div class="body">
          <section class="sources" aria-labelledby={`${id}-sources`}>
            <h2 id={`${id}-sources`}>
              <span class="step" aria-hidden="true">
                1
              </span>
              Choose the stat source
            </h2>
            <article class="item-card">
              <div class="item-heading">
                <h3>Gold Ring</h3>
                <small>Example A · Stat sources</small>
              </div>
              <div class="item-content">
                <img class="ring" src={extensionAssetUrl('category/ring-large.png')} alt="" />
                <div class="mods">
                  <div class="mod implicit">
                    <h4>
                      Implicit <span>Built into the base</span>
                    </h4>
                    <p>{`${item.implicitRarity}% increased Rarity of Items Found`}</p>
                  </div>
                  <div class="mod explicit">
                    <h4>
                      Explicit <span>Rolled modifiers</span>
                    </h4>
                    <p>
                      {`+${item.life} to maximum Life`}
                      <br />
                      {`+${item.directFire}% to Fire Resistance`}
                      <br />
                      {`+${item.allElemental}% to all Elemental Resistances`}
                    </p>
                  </div>
                </div>
              </div>
            </article>

            <article class="total-card">
              <h3>
                <span>Total</span> <small>Combined stat</small>
              </h3>
              <div
                class="equation"
                role="img"
                aria-label={`${item.directFire} percent direct fire resistance plus ${item.allElemental} percent all elemental resistance equals ${total} percent total fire resistance`}
              >
                <div class="term" aria-hidden="true">
                  <b>
                    {`${item.directFire}% Fire `}
                    <HelpIcon name="fire" class="fire" />
                  </b>
                  <small>From explicit</small>
                </div>
                <span class="math" aria-hidden="true">
                  +
                </span>
                <div class="term" aria-hidden="true">
                  <b>{`${item.allElemental}% All elemental`}</b>
                  <small class="element-icons">
                    <HelpIcon name="fire" class="fire" />
                    <HelpIcon name="cold" class="cold" />
                    <HelpIcon name="lightning" class="lightning" />
                    <span>From explicit</span>
                  </small>
                </div>
                <span class="math equals" aria-hidden="true">
                  =
                </span>
                <div class="term total-term" aria-hidden="true">
                  <b>
                    <span>{`${total}%`}</span> Fire
                  </b>
                  <HelpIcon name="fire" class="fire" />
                </div>
              </div>
              <h4 class="search-question">{`Searching for Fire resistance ≥ ${total}%?`}</h4>
              <table class="source-table" aria-label={`Searching for Fire resistance ≥ ${total}%?`}>
                <tbody>
                  <tr>
                    <th scope="row">
                      <span class="source-tag total-tag">Total</span>
                    </th>
                    <td>Combines relevant sources.</td>
                    <td>
                      <Verdict pass>{`Match: ${total}%`}</Verdict>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">
                      <span class="source-tag explicit-tag">Explicit</span>
                    </th>
                    <td>Direct Fire Resistance modifier.</td>
                    <td>
                      <Verdict pass={false}>{`Only ${item.directFire}%`}</Verdict>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">
                      <span class="source-tag implicit-tag">Implicit</span>
                    </th>
                    <td>The base modifier on this example.</td>
                    <td>
                      <Verdict pass={false}>No fire resistance</Verdict>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div class="other-sources">
                <p>
                  <b>Other sources</b> Augment · Enchant · Desecrated · Fractured
                </p>
                <small>Available options depend on the parameter.</small>
              </div>
            </article>
          </section>

          <section class="modes" aria-labelledby={`${id}-modes`}>
            <h2 id={`${id}-modes`}>
              <span class="step" aria-hidden="true">
                2
              </span>
              Choose how it matches
            </h2>

            <article class="mode required">
              <div class="mode-heading">
                <span class="mode-icon">
                  <HelpIcon name="check" />
                </span>
                <div>
                  <h3>Required</h3>
                  <p>Every result must meet this condition.</p>
                </div>
              </div>
              <div class="parameter">
                <span class="parameter-name">
                  <HelpIcon name="heart" class="heart" />
                  Maximum life
                </span>
                <strong>{`≥ ${required.minimumLife}`}</strong>
                <span class="badge gold">Required</span>
              </div>
              <div class="outcomes two">
                <Verdict pass={required.passingLife >= required.minimumLife}>{`${required.passingLife} Life · Pass`}</Verdict>
                <Verdict pass={required.failingLife >= required.minimumLife}>{`${required.failingLife} Life · Fail`}</Verdict>
              </div>
            </article>

            <article class="mode alternatives">
              <div class="mode-heading">
                <span class="mode-icon">
                  <HelpIcon name="link" />
                </span>
                <div>
                  <h3>Alternatives</h3>
                  <p>Match at least N of the conditions below.</p>
                </div>
                <span class="count">
                  At least <b>{alternatives.minimumMatches}</b> {`of ${outcome.conditions.length}`}
                </span>
              </div>
              <div class="thresholds">
                {outcome.conditions.map(({ stat }) => (
                  <span key={stat} class={`threshold ${stat}`}>
                    <HelpIcon name={stat} />
                    {STAT_NAME[stat]} <b>{`≥ ${alternatives.thresholds[stat]}%`}</b>
                  </span>
                ))}
              </div>
              <div class="example-label">Example B · Another item</div>
              <div class="outcomes alternative-outcomes">
                {outcome.conditions.map(({ stat, value, meets }) =>
                  value === null ? (
                    <span key={stat} class="absent">{`— No ${STAT_NAME[stat]}`}</span>
                  ) : (
                    <Verdict key={stat} pass={meets}>{`${STAT_NAME[stat]} ${value}%`}</Verdict>
                  ),
                )}
                <strong class="match-count">{`${outcome.matched} matched · ${outcome.pass ? 'Pass' : 'Fail'}`}</strong>
              </div>
              <div class="card-foot">
                <p>Any two are enough. All three also pass.</p>
                <small>Counts conditions, not added values.</small>
              </div>
            </article>

            <article class="mode excluded">
              <div class="mode-heading">
                <span class="mode-icon">
                  <HelpIcon name="ban" />
                </span>
                <div>
                  <h3>Must not have</h3>
                  <p>Exclude a modifier at any value.</p>
                </div>
              </div>
              <div class="parameter">
                <span class="parameter-name">
                  Item rarity <small>Selected modifier</small>
                </span>
                <span class="badge">Explicit</span>
                <span class="badge coral">
                  <HelpIcon name="ban" />
                  Must not have
                </span>
              </div>
              <div class="outcomes two exclusion-outcomes">
                <Verdict pass={false}>Selected explicit rarity modifier · Excluded</Verdict>
                <Verdict pass>Implicit rarity alone · Allowed</Verdict>
              </div>
              <p class="note">Choose a modifier source. Total cannot be excluded here.</p>
            </article>
          </section>
        </div>

        <footer class="footer">
          <div class="footer-heading">
            <HelpIcon name="link" />
            <div>
              <h3>All conditions work together</h3>
              <small>An item must satisfy every part of your query.</small>
            </div>
          </div>
          <div class="summary">
            <span>
              <HelpIcon name="heart" class="heart" />
              {`Life ≥ ${required.minimumLife}`}
            </span>
            <b>+</b>
            <span>{`At least ${alternatives.minimumMatches} resistance conditions`}</span>
            <b>+</b>
            <span>
              <HelpIcon name="ban" class="coral" />
              No selected explicit rarity modifier
            </span>
          </div>
          <button type="button" class="got-it" onClick={onClose}>
            Got it
          </button>
        </footer>
      </div>
    </dialog>
  );
}
