function Meta({ label, value }) {
  if (!value) return null;
  return (
    <div className="meta-chip">
      <span className="meta-label">{label}</span>
      <span className="meta-value">{value}</span>
    </div>
  );
}

export default function RecipeView({ recipe, onSave, saving, saved, savedView }) {
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
  } = recipe;

  return (
    <article className="recipe-card">
      <header className="recipe-header">
        {thumbnail && <img className="recipe-thumb" src={thumbnail} alt={title} />}
        <div className="recipe-header-text">
          <h2>{title}</h2>
          {channelTitle && (
            <p className="channel">
              from{' '}
              <a href={videoUrl} target="_blank" rel="noreferrer">
                {channelTitle}
              </a>
            </p>
          )}
          {description && <p className="description">{description}</p>}
        </div>
      </header>

      <div className="meta-row">
        <Meta label="Servings" value={servings} />
        <Meta label="Prep" value={prepTime} />
        <Meta label="Cook" value={cookTime} />
        <Meta label="Cuisine" value={cuisine} />
        <Meta label="Difficulty" value={difficulty} />
      </div>

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
              <span className="ing-qty">{[ing.quantity, ing.unit].filter(Boolean).join(' ')}</span>
              <span className="ing-name">
                {ing.item}
                {ing.notes ? <em className="ing-notes"> — {ing.notes}</em> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Steps</h3>
        <ol className="step-list">
          {steps.map((step, i) => (
            <li key={step.order ?? i}>
              <p>{step.instruction}</p>
              {step.duration && <span className="step-duration">{step.duration}</span>}
            </li>
          ))}
        </ol>
      </section>

      {!savedView && onSave && (
        <div className="recipe-actions">
          <button onClick={onSave} disabled={saving || saved}>
            {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save to my cookbook'}
          </button>
        </div>
      )}
    </article>
  );
}
