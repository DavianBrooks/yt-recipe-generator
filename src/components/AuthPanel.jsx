import { useState } from 'react';
import { signInEmail, signOutUser, signUpEmail } from '../lib/firebase';

const ERROR_MESSAGES = {
  'auth/email-already-in-use': 'That email is already registered — try Sign in instead.',
  'auth/invalid-email': 'That email address looks invalid.',
  'auth/weak-password': 'Password needs at least 6 characters.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'No account with that email — try Sign up instead.',
  'auth/operation-not-allowed': 'Email/password sign-in is not enabled in this Firebase project.',
  'auth/configuration-not-found': 'Email/password sign-in is not enabled in this Firebase project.',
};

export default function AuthPanel({ user }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const signedIn = user && !user.isAnonymous;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const fn = mode === 'signin' ? signInEmail : signUpEmail;
      await fn(email.trim(), password);
      setNotice(mode === 'signin' ? 'Signed in.' : 'Account created — your recipes carry over.');
      setPassword('');
    } catch (err) {
      setError(ERROR_MESSAGES[err.code] || err.message || 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  if (signedIn) {
    return (
      <div className="auth-panel signed-in">
        <span>
          Signed in as <strong>{user.email}</strong>
        </span>
        <button className="secondary" onClick={() => signOutUser()}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="auth-panel">
      <p className="auth-hint">
        You're browsing as a guest.{' '}
        {mode === 'signin' ? 'Sign in' : 'Sign up'} to keep your cookbook on any device.
      </p>
      <form className="auth-form" onSubmit={submit}>
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder={mode === 'signup' ? 'Password (6+ chars)' : 'Password'}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <div className="auth-actions">
          <button type="submit" disabled={busy}>
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError('');
            }}
          >
            {mode === 'signin' ? 'Need an account?' : 'Have an account?'}
          </button>
        </div>
      </form>
      {error && <p className="form-error">{error}</p>}
      {notice && <p className="auth-ok">{notice}</p>}
    </div>
  );
}
