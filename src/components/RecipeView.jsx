import { useEffect, useState } from 'react';

function Meta({ label, value }) {
  if (!value) return null;
  return (
    <div className="meta-chip">
      <span className="meta-label">{label}</span>
      <span className="meta-value">{value}</span>
    </div>
  );
}

export default function RecipeView({
  recipe,
  onSave,
  saving,
  saved,
  savedView,
  onShare,
  sharing,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(recipe);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDraft(recipe);
    setEditing(false);
  }, [recipe]);

  const {
    title,
    description,
    channelTitle,
    videoUrl,
    thumbnail,
    servings,
    prepTime,
    cookTime,
    cuisine,
    difficulty,
    ingredients = [],
    steps = [],
    tags = [],
  } = editing ? draft : recipe;

  const setField = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));
  const setIng = (i, key) => (e) =>
    setDraft((d) => ({
      ...d,
      ingredients: d.ingredients.map((ing, j) => (j === i ? { ...ing, [key]: e.target.value } : ing)),
    }));
  const setStep = (i, key) => (e) =>
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((s, j) => (j === i ? { ...s, [key]: e.target.value } : s)),
    }));

  async function handleShare() {
    const link = await onShare();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this share link:', link);
    }
  }

  const editInput = (key, value, ph) =>
    editing ? (
      <input className="edit-field" value={value || ''} placeholder={ph} onChange={setField(key)} />
    ) : (
      value
    );

  return (
    <article className="recipe-card">
      <header className="recipe-header">
        {thumbnail && <img className="recipe-thumb" src={thumbnail} alt={title} />}
        <div className="recipe-header-text">
          {editing ? (
            <input className="edit-field edit-title" value={title || ''} onChange={setField('title')} />
          ) : (
            <h2>{title}</h2>
          )}
          {channelTitle && (
            <p className="channel">
              from{' '}
              <a href={videoUrl} target="_blank" rel="noreferrer">
                {channelTitle}
              </a>
            </p>
          )}
          {editing ? (
            <textarea
              className="edit-field"
              rows={2}
              value={description || ''}
              onChange={setField('description')}
            />
          ) : (
            description && <p className="description">{description}</p>
          )}
        </div>
      </header>

      {editing ? (
        <div className="meta-row edit-meta">
          {[
            ['servings', 'Servings'],
            ['prepTime', 'Prep'],
            ['cookTime', 'Cook'],
            ['cuisine', 'Cuisine'],
            ['difficulty', 'Difficulty'],
          ].map(([key, ph]) => (
            <input
              key={key}
              className="edit-field"
              value={draft[key] || ''}
              placeholder={ph}
              onChange={setField(key)}
            />
          ))}
        </div>
      ) : (
        <div className="meta-row">
          <Meta label="Servings" value={servings} />
          <Meta label="Prep" value={prepTime} />
          <Meta label="Cook" value={cookTime} />
          <Meta label="Cuisine" value={cuisine} />
          <Meta label="Difficulty" value={difficulty} />
        </div>
      )}

      {tags.length > 0 && (
        <div className="tag-row">
          {tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      )}

      <section>
        <h3>Ingredients</h3>
        <ul className="ingredient-list">
          {ingredients.map((ing, i) => (
            <li key={i}>
              {editing ? (
                <div className="ing-edit">
                  <input className="edit-field" value={ing.quantity || ''} placeholder="Qty" onChange={setIng(i, 'quantity')} />
                  <input className="edit-field" value={ing.unit || ''} placeholder="Unit" onChange={setIng(i, 'unit')} />
                  <input className="edit-field" value={ing.item || ''} placeholder="Item" onChange={setIng(i, 'item')} />
                  <input className="edit-field" value={ing.notes || ''} placeholder="Notes" onChange={setIng(i, 'notes')} />
                </div>
              ) : (
                <>
                  <span className="ing-qty">{[ing.quantity, ing.unit].filter(Boolean).join(' ')}</span>
                  <span className="ing-name">
                    {ing.item}
                    {ing.notes ? <em className="ing-notes"> — {ing.notes}</em> : null}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Steps</h3>
        <ol className="step-list">
          {steps.map((step, i) => (
            <li key={step.order ?? i}>
              {editing ? (
                <div className="step-edit">
                  <textarea
                    className="edit-field"
                    rows={2}
                    value={step.instruction || ''}
                    onChange={setStep(i, 'instruction')}
                  />
                  <input className="edit-field" value={step.duration || ''} placeholder="Duration" onChange={setStep(i, 'duration')} />
                </div>
              ) : (
                <>
                  <p>{step.instruction}</p>
                  {step.duration && <span className="step-duration">{step.duration}</span>}
                </>
              )}
            </li>
          ))}
        </ol>
      </section>

      <div className="recipe-actions">
        {!savedView && onSave && (
          <>
            <button onClick={() => onSave(editing ? draft : recipe)} disabled={saving || saved}>
              {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save to my cookbook'}
            </button>
            {!saved && (
              <button className="secondary" onClick={() => setEditing((e) => !e)}>
                {editing ? 'Done editing' : 'Edit'}
              </button>
            )}
          </>
        )}
        {savedView && onShare && (
          <button className="secondary" onClick={handleShare} disabled={sharing}>
            {copied ? 'Link copied!' : sharing ? 'Sharing…' : 'Share link'}
          </button>
        )}
        <button className="secondary" onClick={() => window.print()}>
          Print / PDF
        </button>
      </div>
    </article>
  );
}
