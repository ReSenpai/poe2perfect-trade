import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { formatAge } from '@/lib/listing/parse';
import { freeName, savedByName } from '@/lib/saved/saved-searches';
import type { SavedSearch } from '@/lib/saved/saved-searches';
import { Icon } from '@/ui/kit/Icon';

export interface SavedSearchesDialogProps {
  searches: SavedSearch[];
  /** Leagues the site has now: a saved search of another one asks before it opens. */
  leagues: string[];
  /** The league open now. */
  league: string;
  /** Suggested name for the current search: "Find a ring". */
  defaultName: string;
  now: number;
  onSave: (name: string) => void;
  /** The current search over a saved one of the same name, when the user says so. */
  onReplace?: (id: string, name: string) => void;
  onOpen: (search: SavedSearch, league: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/**
 * Saved searches (step 31, shell v5 modal): keep the current search under a name, open or delete one. Opening makes it
 * the draft; nothing here searches.
 */
export function SavedSearchesDialog({ searches, leagues, league, defaultName, now, onSave, onReplace, onOpen, onDelete, onClose }: SavedSearchesDialogProps) {
  const [name, setName] = useState(defaultName);
  const [asking, setAsking] = useState<string | null>(null);
  // A name already saved: replace that search or keep both, asked before anything is saved.
  const [clash, setClash] = useState<{ id: string; name: string } | null>(null);
  // A saved search to delete, once the user confirms.
  const [deleting, setDeleting] = useState<SavedSearch | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    const box = dialog.current;
    if (box && !box.open) {
      if (typeof box.showModal === 'function') box.showModal();
      else box.setAttribute('open', '');
    }
    field.current?.focus();
    field.current?.select();
  }, []);

  const open = (search: SavedSearch) => {
    if (leagues.includes(search.league)) onOpen(search, search.league);
    else setAsking(search.id);
  };

  return (
    <dialog
      ref={dialog}
      class="p2t-modal p2t-saved"
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div class="p2t-modal__header">
        <h2 class="p2t-modal__title" id={`${id}-title`}>
          Saved searches
        </h2>
        <button type="button" class="p2t-icon-button" aria-label="Close saved searches" title="Close" onClick={onClose}>
          <Icon name="close" size={18} />
        </button>
      </div>
      <div class="p2t-modal__body">
        <form
          class="p2t-saved__save"
          onSubmit={(event) => {
            event.preventDefault();
            const wanted = name.trim();
            if (!wanted) return;
            const taken = savedByName(searches, wanted);
            if (taken) setClash({ id: taken.id, name: wanted });
            else onSave(wanted);
          }}
        >
          <input ref={field} type="text" class="p2t-input" aria-label="Name" placeholder="Name this search" value={name} onInput={(event) => setName(event.currentTarget.value)} />
          <button type="submit" class="p2t-btn p2t-btn--primary" disabled={!name.trim()}>
            Save current search
          </button>
        </form>
        {clash && (
          <ReplaceDialog
            name={savedByName(searches, clash.name)?.name ?? clash.name}
            freeName={freeName(searches, clash.name)}
            onReplace={() => {
              onReplace?.(clash.id, clash.name);
              setClash(null);
            }}
            onKeepBoth={() => {
              onSave(freeName(searches, clash.name));
              setClash(null);
            }}
            onCancel={() => setClash(null)}
          />
        )}
        {deleting && (
          <DeleteDialog
            name={deleting.name}
            onDelete={() => {
              onDelete(deleting.id);
              setDeleting(null);
            }}
            onCancel={() => setDeleting(null)}
          />
        )}
        {searches.length === 0 ? (
          <p class="p2t-help">No saved searches yet</p>
        ) : (
          <ul class="p2t-saved__list" aria-label="Saved searches">
            {searches.map((search) => (
              <li key={search.id} class="p2t-saved__item">
                <button type="button" class="p2t-saved__open" aria-label={`Open ${search.name}`} onClick={() => open(search)}>
                  <span class="p2t-saved__name">{search.name}</span>
                  <span class="p2t-saved__meta">{`${search.league} · ${formatAge(new Date(search.savedAt).toISOString(), now)}`}</span>
                </button>
                <button type="button" class="p2t-condition__remove" aria-label={`Delete ${search.name}`} title={`Delete ${search.name}`} onClick={() => setDeleting(search)}>
                  <Icon name="close" size={15} />
                </button>
                {asking === search.id && (
                  <div class="p2t-saved__ask" role="group" aria-label={`${search.league} is not available`}>
                    <span>{`${search.league} is not available.`}</span>
                    <button type="button" class="p2t-btn" onClick={() => onOpen(search, league)}>
                      {`Open in ${league}`}
                    </button>
                    <button type="button" class="p2t-link" onClick={() => setAsking(null)}>
                      Cancel
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p class="p2t-help">Opening a search fills the filters; Find items runs it.</p>
      </div>
    </dialog>
  );
}

/**
 * A name already saved (a modal over the list): replace that search, keep both under a free name, or cancel. The safe
 * choice, keeping both, has the cursor; Esc cancels.
 */
function ReplaceDialog({ name, freeName: other, onReplace, onKeepBoth, onCancel }: { name: string; freeName: string; onReplace: () => void; onKeepBoth: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const keepBoth = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const box = dialog.current;
    if (box && !box.open) {
      if (typeof box.showModal === 'function') box.showModal();
      else box.setAttribute('open', '');
    }
    keepBoth.current?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      class="p2t-modal p2t-confirm"
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div class="p2t-modal__header">
        <h2 class="p2t-modal__title" id={`${id}-title`}>{`"${name}" is already saved`}</h2>
      </div>
      <div class="p2t-modal__body p2t-confirm__body">
        <p class="p2t-help">Replace it with the current search, or keep both.</p>
        <div class="p2t-confirm__actions">
          <button type="button" class="p2t-btn" onClick={onReplace}>
            Replace
          </button>
          <button ref={keepBoth} type="button" class="p2t-btn p2t-btn--primary" onClick={onKeepBoth}>
            {`Save as "${other}"`}
          </button>
          <button type="button" class="p2t-link" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** Deleting a saved search (a modal over the list): it cannot be undone, so Cancel has the cursor; Esc cancels. */
function DeleteDialog({ name, onDelete, onCancel }: { name: string; onDelete: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const box = dialog.current;
    if (box && !box.open) {
      if (typeof box.showModal === 'function') box.showModal();
      else box.setAttribute('open', '');
    }
    cancel.current?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      class="p2t-modal p2t-confirm"
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div class="p2t-modal__header">
        <h2 class="p2t-modal__title" id={`${id}-title`}>{`Delete "${name}"?`}</h2>
      </div>
      <div class="p2t-modal__body p2t-confirm__body">
        <p class="p2t-help">This cannot be undone.</p>
        <div class="p2t-confirm__actions p2t-confirm__actions--end">
          <button ref={cancel} type="button" class="p2t-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" class="p2t-btn p2t-btn--danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
    </dialog>
  );
}
