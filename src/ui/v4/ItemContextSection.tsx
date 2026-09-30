import { useId, useState } from 'preact/hooks';
import type { Change, ItemContext } from '@/lib/editor/context';
import type { ItemCatalog, ItemCatalogChoice } from '@/lib/editor/item-catalog';
import { Icon } from '@/ui/kit/Icon';
import { categoryArtUrl } from '@/lib/catalog/category-art';
import { SelectedValue, supportsCustomSelect } from './SelectedValue';

export interface ItemContextSectionProps {
  context: ItemContext;
  catalog: ItemCatalog;
  onChange: (change: Change<ItemContext>) => void;
  /** The browser's customizable select (detected); without it the chosen category's picture stands beside the list. */
  customSelect?: boolean;
}

const KIND_TEXT = { base: 'Base', unique: 'Unique' };

/** Item (v4 §8.1): category, one search over bases and uniques, rarity. Changes go to the draft; nothing searches. */
export function ItemContextSection({ context, catalog, onChange, customSelect = supportsCustomSelect() }: ItemContextSectionProps) {
  const [text, setText] = useState('');
  const [active, setActive] = useState(-1);
  const id = useId();
  const results = catalog.search(text, context.category);
  const open = text.trim() !== '';
  const chosen = context.name ?? context.type;

  const pick = (choice: ItemCatalogChoice) => {
    onChange(catalog.choose(choice));
    setText('');
    setActive(-1);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!open) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (results.length === 0 ? -1 : (current + step + results.length) % results.length));
    } else if (event.key === 'Enter' && !(event.ctrlKey || event.metaKey)) {
      const choice = results[active] ?? (results.length === 1 ? results[0] : undefined);
      if (!choice) return;
      event.preventDefault();
      pick(choice);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setText('');
      setActive(-1);
    }
  };

  return (
    <section class="p2t-section" aria-label="Item">
      <div class="p2t-item-context">
        {/* Each category with its picture (step 34); the list copies the chosen one into the field (<selectedcontent>). */}
        <label class="p2t-item-context__field p2t-item-context__category" data-native={customSelect ? undefined : 'true'}>
          {!customSelect && context.category && <CategoryArt id={context.category} />}
          <select class="p2t-input" aria-label="Category" value={context.category ?? ''} onChange={(event) => onChange({ category: event.currentTarget.value || null })}>
            <SelectedValue />
            <option value="">Any</option>
            {catalog.categories.map((option) => (
              <option key={option.id} value={option.id}>
                <CategoryArt id={option.id} />
                {option.text}
              </option>
            ))}
          </select>
        </label>
        <label class="p2t-item-context__field">
          <select class="p2t-input" aria-label="Rarity" data-rarity={context.rarity ?? undefined} value={context.rarity ?? ''} onChange={(event) => onChange({ rarity: event.currentTarget.value || null })}>
            <SelectedValue />
            <option value="">Any</option>
            {catalog.rarities.map((option) => (
              <option key={option.id} value={option.id}>
                {option.text}
              </option>
            ))}
          </select>
        </label>
        <div class="p2t-item-context__search">
          <Icon name="search" size={16} class="p2t-item-context__search-icon" />
          <input
            type="text"
            role="combobox"
            class="p2t-input"
            aria-label="Base or unique item"
            placeholder={chosen ? 'Change item' : 'Any base'}
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
            value={text}
            onInput={(event) => {
              setText(event.currentTarget.value);
              setActive(-1);
            }}
            onKeyDown={onKeyDown}
          />
          {open && (
            <ul class="p2t-listbox" id={`${id}-list`} role="listbox" aria-label="Items">
              {results.map((choice, index) => (
                <li
                  key={`${choice.kind}:${choice.text}`}
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  class="p2t-listbox__option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(choice)}
                >
                  <span>{choice.text}</span>
                  <span class="p2t-tag">{KIND_TEXT[choice.kind]}</span>
                </li>
              ))}
              {results.length === 0 && <li class="p2t-listbox__empty">No matching items</li>}
            </ul>
          )}
        </div>
  
      </div>

      {chosen && (
        <div class="p2t-item-context__chosen" role="group" aria-label="Chosen item">
          <Icon name={context.category?.startsWith('weapon') ? 'weapon' : 'ring'} size={16} />
          <span class="p2t-item-context__chosen-text">{context.name ? `${context.name} ${context.type ?? ''}`.trim() : context.type}</span>
          <span class="p2t-tag">{context.name ? 'Unique' : 'Base'}</span>
          <button type="button" class="p2t-btn p2t-btn--icon p2t-btn--quiet" aria-label="Clear item" title="Clear item" onClick={() => onChange({ name: null, type: null })}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

    </section>
  );
}

/** The picture of a category, decorative: the name beside it says what it is. */
function CategoryArt({ id }: { id: string }) {
  const src = categoryArtUrl(id);
  return src ? <img class="p2t-category-art" src={src} alt="" width={24} height={24} loading="lazy" /> : null;
}
