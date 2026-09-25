export default function SavedRecipes({ recipes, loading, onSelect, onDelete, parseReady }) {
  if (!parseReady) {
    return (
      <div className="empty-state">
        <h3>Back4App is not configured</h3>
        <p>
          Set <code>VITE_PARSE_APP_ID</code> and <code>VITE_PARSE_JS_KEY</code> in your environment
          (see README) to save and browse recipes.
        </p>
      </div>
    );
  }

  if (loading) return <p className="empty-state">Loading your cookbook…</p>;

  if (recipes.length === 0) {
    return (
      <div className="empty-state">
        <h3>No saved recipes yet</h3>
        <p>Generate a recipe from a YouTube link and hit “Save to my cookbook”.</p>
      </div>
    );
  }

  return (
    <div className="saved-grid">
      {recipes.map((r) => (
        <div key={r.objectId} className="saved-card">
          <button className="saved-card-main" onClick={() => onSelect(r)}>
            {r.thumbnail && <img src={r.thumbnail} alt="" />}
            <span className="saved-title">{r.title}</span>
            {r.channelTitle && <span className="saved-channel">{r.channelTitle}</span>}
          </button>
          <button
            className="saved-delete"
            title="Delete recipe"
            onClick={() => onDelete(r.objectId)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
