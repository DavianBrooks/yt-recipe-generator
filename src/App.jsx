import { useCallback, useEffect, useState } from 'react';
import LinkForm from './components/LinkForm';
import RecipeView from './components/RecipeView';
import SavedRecipes from './components/SavedRecipes';
import { deleteRecipe, extractRecipe, listSavedRecipes, saveRecipe } from './api';
import { parseConfigured } from './lib/parse';

export default function App() {
  const [tab, setTab] = useState('generate');
  const [recipe, setRecipe] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const refreshSaved = useCallback(async () => {
    if (!parseConfigured) return;
    setLoadingSaved(true);
    try {
      setSavedRecipes(await listSavedRecipes());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingSaved(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'saved') refreshSaved();
  }, [tab, refreshSaved]);

  async function handleGenerate(url) {
    setLoading(true);
    setError('');
    setNotice('');
    setRecipe(null);
    setSaved(false);
    try {
      setRecipe(await extractRecipe(url));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await saveRecipe(recipe);
      setSaved(true);
      setNotice('Saved to your cookbook.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(objectId) {
    try {
      await deleteRecipe(objectId);
      setSavedRecipes((prev) => prev.filter((r) => r.objectId !== objectId));
      if (selected?.objectId === objectId) setSelected(null);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🍳 YouTube Recipe Generator</h1>
        <p>Turn any cooking video into a structured, savable recipe.</p>
      </header>

      <nav className="tabs">
        <button
          className={tab === 'generate' ? 'active' : ''}
          onClick={() => {
            setError('');
            setNotice('');
            setTab('generate');
          }}
        >
          Generate
        </button>
        <button
          className={tab === 'saved' ? 'active' : ''}
          onClick={() => {
            setSelected(null);
            setError('');
            setNotice('');
            setTab('saved');
          }}
        >
          My cookbook
        </button>
      </nav>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner ok">{notice}</div>}

      <main>
        {tab === 'generate' && (
          <>
            <LinkForm onSubmit={handleGenerate} loading={loading} />
            {recipe && (
              <RecipeView recipe={recipe} onSave={handleSave} saving={saving} saved={saved} />
            )}
          </>
        )}

        {tab === 'saved' &&
          (selected ? (
            <>
              <button className="back-btn" onClick={() => setSelected(null)}>
                ← Back to cookbook
              </button>
              <RecipeView recipe={selected} savedView />
            </>
          ) : (
            <SavedRecipes
              recipes={savedRecipes}
              loading={loadingSaved}
              onSelect={setSelected}
              onDelete={handleDelete}
              parseReady={parseConfigured}
            />
          ))}
      </main>

      <footer className="app-footer">
        <p>AI extraction via YouTube captions + LLM · Storage on Back4App (Parse)</p>
      </footer>
    </div>
  );
}
