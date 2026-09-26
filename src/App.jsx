import { useCallback, useEffect, useState } from 'react';
import LinkForm from './components/LinkForm';
import RecipeView from './components/RecipeView';
import SavedRecipes from './components/SavedRecipes';
import {
  deleteRecipe,
  extractRecipe,
  findCachedRecipe,
  getSharedRecipe,
  listSavedRecipes,
  saveRecipe,
  shareRecipe,
} from './api';
import { authReady, firebaseConfigured } from './lib/firebase';

export default function App() {
  const [tab, setTab] = useState('generate');
  const [recipe, setRecipe] = useState(null);
  const [selected, setSelected] = useState(null);
  const [sharedView, setSharedView] = useState(null); // {recipe} when viewing a ?r= link
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // Shared-recipe deep link: ?r=<firestore doc id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('r');
    if (!id || !firebaseConfigured) return;
    getSharedRecipe(id).then((r) => {
      if (r) {
        setSharedView(r);
      } else {
        setError('That shared recipe could not be found (or sharing was turned off).');
      }
    });
  }, []);

  // Sign in anonymously up-front so saving/listing never waits on auth
  useEffect(() => {
    authReady();
  }, []);

  const refreshSaved = useCallback(async () => {
    if (!firebaseConfigured) return;
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
      const cached = await findCachedRecipe(url).catch(() => null);
      if (cached) {
        setRecipe(cached);
        setSaved(true);
        setNotice('Already in your cookbook — loaded it instantly without re-generating.');
        return;
      }
      setRecipe(await extractRecipe(url));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(editedRecipe) {
    setSaving(true);
    setError('');
    try {
      const saved_doc = await saveRecipe(editedRecipe || recipe);
      setRecipe({ ...recipe, ...saved_doc });
      setSaved(true);
      setNotice('Saved to your cookbook.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteRecipe(id);
      setSavedRecipes((prev) => prev.filter((r) => r.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleShare(recipeToShare) {
    setSharing(true);
    setError('');
    try {
      const link = await shareRecipe(recipeToShare.id);
      return link;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setSharing(false);
    }
  }

  if (sharedView) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>🍳 Shared Recipe</h1>
          <p>
            <a href={window.location.pathname}>← Make your own recipes</a>
          </p>
        </header>
        <main>
          <RecipeView recipe={sharedView} savedView />
        </main>
        <footer className="app-footer">
          <p>Shared from a YouTube Recipe Generator cookbook</p>
        </footer>
      </div>
    );
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
              <RecipeView
                recipe={selected}
                savedView
                onShare={() => handleShare(selected)}
                sharing={sharing}
              />
            </>
          ) : (
            <SavedRecipes
              recipes={savedRecipes}
              loading={loadingSaved}
              onSelect={setSelected}
              onDelete={handleDelete}
              dbReady={firebaseConfigured}
            />
          ))}
      </main>

      <footer className="app-footer">
        <p>AI extraction via YouTube captions + LLM · Storage on Firebase Firestore</p>
      </footer>
    </div>
  );
}
