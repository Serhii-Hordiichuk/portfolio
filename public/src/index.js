// Main entry point.
// Core modules are static: the site (nav, theme, i18n, stack, chat) must boot.
// Widgets are dynamic + isolated: a failing widget (news/radio/TV) logs a
// warning but NEVER kills the core. Literal specifiers (no variables) so Vite
// code-splits them into separate chunks and native ESM can resolve them too.
import './app.js';
import './stations.js';
import './stack.js';
import './contacts.js';
import './chat.js';
import './chat-ui.js';

import('./news.js').catch((e) => console.warn('[SH] optional module failed: news', e));
import('./radio-player.js').catch((e) => console.warn('[SH] optional module failed: radio', e));
import('./tv-player.js').catch((e) => console.warn('[SH] optional module failed: tv', e));
import('./widgets.js').catch((e) => console.warn('[SH] optional module failed: widgets', e));
