import { useMemo, useState } from 'react';

export default function SavedRecipes({ recipes, loading, onSelect, onDelete, dbReady }) {
  const [search, setSearch] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [tag, setTag] = useState('');

  const cuisines = useMemo(
    () => [...new Set(recipes.map((r) => r.cuisine).filter(Boolean))].sort(),
    [recipes],
  );
  const tags = useMemo(
    () => [...new Set(recipes.flatMap((r) => r.tags || []))].sort(),
    [recipes],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes.filter(
      (r) =>
        (!q ||
          r.title?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.channelTitle?.toLowerCase().includes(q) ||
          (r.ingredients || []).some((i) => i.item?.toLowerCase().includes(q))) &&
        (!cuisine || r.cuisine === cuisine) &&
        (!tag || (r.tags || []).includes(tag)),
    );
  }, [recipes, search, cuisine, tag]);

  if (!dbReady) {
    return (
      <div className="empty-state">
        <h3>Firebase is not configured</h3>
        <p>
          Set <code>VITE_FIREBASE_API_KEY</code>, <code>VITE_FIREBASE_PROJECT_ID</code> and{' '}
          <code>VITE_FIREBASE_APP_ID</code> in your environment (see README) to save and browse
          recipes.
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
    <>
      <div className="cookbook-filters">
        <input
          className="search-input"
          type="search"
          placeholder="Search title, ingredient, channel…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
          <option value="">All cuisines</option>
          {cuisines.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="empty-state">Nothing matches those filters.</p>
      ) : (
        <div className="saved-grid">
          {filtered.map((r) => (
            <div key={r.id} className="saved-card">
              <button className="saved-card-main" onClick={() => onSelect(r)}>
                {r.thumbnail && <img src={r.thumbnail} alt="" />}
                <span className="saved-title">{r.title}</span>
                {r.channelTitle && <span className="saved-channel">{r.channelTitle}</span>}
              </button>
              <button
                className="saved-delete"
                title="Delete recipe"
                onClick={() => onDelete(r.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
