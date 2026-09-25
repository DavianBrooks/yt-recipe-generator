import Parse from 'parse';

export const parseConfigured = Boolean(
  import.meta.env.VITE_PARSE_APP_ID && import.meta.env.VITE_PARSE_JS_KEY,
);

if (parseConfigured) {
  Parse.initialize(import.meta.env.VITE_PARSE_APP_ID, import.meta.env.VITE_PARSE_JS_KEY);
  Parse.serverURL = import.meta.env.VITE_PARSE_SERVER_URL || 'https://parseapi.back4app.com';
}

export default Parse;
