import { useState } from 'react';

const YT_RE = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\//i;

export default function LinkForm({ onSubmit, loading }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Paste a YouTube link first.');
      return;
    }
    if (!YT_RE.test(trimmed)) {
      setError('That does not look like a YouTube URL.');
      return;
    }
    setError('');
    onSubmit(trimmed);
  }

  return (
    <form className="link-form" onSubmit={handleSubmit}>
      <div className="link-form-row">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          disabled={loading}
          aria-label="YouTube video URL"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Extracting…' : 'Generate recipe'}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {loading && (
        <p className="loading-hint">
          Fetching the transcript and asking the AI to structure the recipe — usually 10–30 seconds.
        </p>
      )}
    </form>
  );
}
