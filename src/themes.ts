export interface TerminalTheme {
  name: string;
  // Set for light-background themes. Flips the direction that `lighten(bg, N)`
  // is applied when deriving UI chrome (sidebar / hover / border etc.) so the
  // same positive amount produces a visibly-different tone on either polarity.
  isLight?: boolean;
  // Terminal colors
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

// Derive UI colors from terminal theme
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const clamp = (x: number) => Math.max(0, Math.min(255, x));
  const r = clamp(((n >> 16) & 0xff) + amt);
  const g = clamp(((n >> 8) & 0xff) + amt);
  const b = clamp((n & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function deriveUI(t: TerminalTheme) {
  const bg = t.background;
  const isLight = !!t.isLight;
  // On light themes the sidebar / hover / active / border surfaces should get
  // DARKER than the editor background, not lighter, for them to stand out.
  // Flipping the sign of the shift keeps the call-sites readable ("shade(25)"
  // always means "one step deeper than bg").
  const shade = (amt: number) => lighten(bg, isLight ? -amt : amt);
  // Terminal "brightBlack/brightWhite" semantics don't map cleanly to UI text
  // greys on a light background — bright-white would be near-invisible, and
  // the theme's dark foreground reads as solid black on pure white. Pick a
  // GitHub-style neutral grey scale for light mode (softer than the raw
  // fg/bg pair) and keep terminal-palette-driven values for dark mode.
  const textStrong = isLight ? "#1f2328" : t.brightWhite;
  const textMain   = isLight ? "#424a53" : t.foreground;
  const textDim    = isLight ? "#6e7781" : t.brightBlack;
  const textMute   = isLight ? "#8c959f" : lighten(t.brightBlack, -20);
  // Avatar tiles. Terminal ANSI colors in a light palette are picked to be
  // readable on white *as text* (so they skew dark) which produces muddy
  // blocks behind a 36px tile. On light mode we hardcode the chatterm-dark
  // ANSI palette instead — the user explicitly wants avatar tiles to look
  // the same as they do in dark mode, independent of the terminal palette.
  const avPalette = isLight ? {
    c1: "#56b6c2", c2: "#61afef", c3: "#c678dd", c4: "#e5c07b",
    c5: "#fe8a93", c6: "#7edeea", c7: "#98c379", c8: "#e06c75",
  } : {
    c1: t.cyan, c2: t.blue, c3: t.magenta, c4: t.yellow,
    c5: lighten(t.red, 30), c6: lighten(t.cyan, 40),
    c7: t.green, c8: t.red,
  };
  // Light mode softens the avatar letter to a semi-transparent dark grey so
  // "KR"/"CC" blends into the tile instead of stamping pure black on it;
  // dark mode keeps the high-contrast near-black against the vivid tiles
  // for readability.
  const avatarText = isLight ? "rgba(31,35,40,0.62)" : "#1e1e1e";
  return {
    "--editor-bg": bg,
    "--sidebar-bg": shade(7),
    "--sidebar-hover": shade(12),
    "--sidebar-active": shade(25),
    "--activity-bar": shade(21),
    "--panel-bg": shade(7),
    "--border": bg,
    "--border-strong": shade(30),
    // Generic chip / keyboard-pill / small accent surface. Used for
    // `⌘K` shortcut hint, diff-block header, progress bar track,
    // Sidebar search input, etc. Derived so it's legible on both
    // dark and light backgrounds.
    "--chip-bg": shade(18),
    "--scroll-thumb": shade(20),
    "--scroll-thumb-hover": shade(35),
    // Brand accent (filter pills, focus rings, diff accents). The dark-theme
    // value matches the long-standing `:root` fallback in App.css; the light
    // variant is GitHub's primary blue which reads sharper on white than the
    // deeper `#0e639c` used for dark.
    "--accent":        isLight ? "#0969da"              : "#0e639c",
    "--accent-hover":  isLight ? "#0550ae"              : "#1177bb",
    "--accent-faint":  isLight ? "rgba(9,105,218,0.12)" : "rgba(14,99,156,0.18)",
    // Per-session + total unread badges: always the attention-red on both
    // modes. The "Unread" filter-pill selected state is a separate styling
    // decision handled at the call site (Sidebar.tsx) so it can also pick
    // up this value without affecting the other filter pills.
    "--unread":        isLight ? "#d73a49"              : "#f14c4c",
    "--logo-bg":       "#0e639c",
    "--logo-fg":       "#ffffff",
    "--text": textMain,
    "--text-dim": textDim,
    "--text-mute": textMute,
    "--text-strong": textStrong,
    "--avatar-text": avatarText,
    "--ansi-red": t.red, "--ansi-green": t.green, "--ansi-yellow": t.yellow,
    "--ansi-blue": t.blue, "--ansi-magenta": t.magenta, "--ansi-cyan": t.cyan,
    "--ansi-white": t.white, "--ansi-gray": t.brightBlack,
    "--ansi-bright-red": t.brightRed, "--ansi-bright-green": t.brightGreen,
    "--ansi-bright-yellow": t.brightYellow, "--ansi-bright-blue": t.brightBlue,
    "--ansi-bright-magenta": t.brightMagenta, "--ansi-bright-cyan": t.brightCyan,
    "--status-running": t.green,
    "--status-error": t.red, "--status-done": t.blue, "--status-idle": textMute,
    "--status-asking": t.brightRed || t.red,
    "--av-1": avPalette.c1, "--av-2": avPalette.c2,
    "--av-3": avPalette.c3, "--av-4": avPalette.c4,
    "--av-5": avPalette.c5, "--av-6": avPalette.c6,
    "--av-7": avPalette.c7, "--av-8": avPalette.c8,
  };
}

// xterm.js ITheme object from our theme. Strip `name` (display) and
// `isLight` (UI-derivation hint) — xterm's ITheme rejects unknown keys
// on some versions and silently falls back to its default dark palette,
// which is how v0.2.2-dev was shipping light-themed Sidebar but black
// terminal.
export function toXtermTheme(t: TerminalTheme) {
  const { name: _n, isLight: _l, ...colors } = t;
  return colors;
}

// Theme change subscribers. Lets long-lived consumers (xterm instances)
// swap their palette without tearing down.
const themeSubscribers = new Set<(t: TerminalTheme) => void>();
export function subscribeTheme(fn: (t: TerminalTheme) => void): () => void {
  themeSubscribers.add(fn);
  return () => { themeSubscribers.delete(fn); };
}

// --- Built-in themes ---

export const chatterm: TerminalTheme = {
  name: "ChatTerm Dark",
  background: "#1a1d22", foreground: "#c8ccd4", cursor: "#ffffff",
  selectionBackground: "#2e4563",
  black: "#1a1d22", red: "#e06c75", green: "#98c379", yellow: "#e5c07b",
  blue: "#61afef", magenta: "#c678dd", cyan: "#56b6c2", white: "#abb2bf",
  brightBlack: "#5c6370", brightRed: "#f44747", brightGreen: "#89d185",
  brightYellow: "#f9f1a5", brightBlue: "#3794ff", brightMagenta: "#d670d6",
  brightCyan: "#29b8db", brightWhite: "#ffffff",
};

export const vscodeDarkPlus: TerminalTheme = {
  name: "VS Code Dark+",
  background: "#141414", foreground: "#c0c0c0", cursor: "#ffffff",
  selectionBackground: "#264f78",
  black: "#000000", red: "#d3001d", green: "#00b75f", yellow: "#dde600",
  blue: "#0059c3", magenta: "#be00b4", cyan: "#009ac6", white: "#dedede",
  brightBlack: "#535353", brightRed: "#ff1b34", brightGreen: "#00d171",
  brightYellow: "#f1fa00", brightBlue: "#1176ed", brightMagenta: "#dc45d3",
  brightCyan: "#00acd7", brightWhite: "#dedede",
};

// GitHub Light-inspired counterpart to the default dark ChatTerm palette.
// Keeps terminal ANSI colors readable on white while leaving the UI-derivation
// helpers (shade / text-mute) to handle sidebar chrome polarity.
export const chattermLight: TerminalTheme = {
  name: "ChatTerm Light",
  isLight: true,
  // Off-white terminal bg — pure #fff is glaring against a long `ls` listing
  // in saturated ANSI colors. #f6f8fa is the GitHub docs background.
  // Terminal fg at `#24292f` reads as pure-black against `#f6f8fa` bg — every
  // file in `ls --color` looks stamped on the page. Softened to a dark grey
  // so the default text recedes and the color-coded dir / link names stand
  // out more (they were already the intended focus of `ls --color`).
  background: "#f6f8fa", foreground: "#3d444d", cursor: "#3d444d",
  selectionBackground: "#b4d8fe",
  black: "#24292f", red: "#cf222e", green: "#1a7f37", yellow: "#9a6700",
  blue: "#0969da", magenta: "#8250df", cyan: "#1b7c83", white: "#6e7781",
  // Bright variants should be slightly more saturated than base — the earlier
  // palette had brightGreen/brightYellow darker than their base which made
  // `ls --color` dir names feel duller than regular text. Rebalanced so
  // they read as "a shade punchier" without crossing into neon.
  brightBlack: "#57606a", brightRed: "#c93c47", brightGreen: "#2da44e",
  brightYellow: "#9a6700", brightBlue: "#218bff", brightMagenta: "#a371f7",
  brightCyan: "#3192aa", brightWhite: "#6e7781",
};

export const builtinThemes: TerminalTheme[] = [chatterm, chattermLight, vscodeDarkPlus];

// --- Imported themes (persisted in localStorage) ---

const IMPORTED_KEY = "chatterm-imported-themes";

function loadImportedThemes(): TerminalTheme[] {
  try {
    const raw = localStorage.getItem(IMPORTED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveImportedThemes(themes: TerminalTheme[]) {
  try { localStorage.setItem(IMPORTED_KEY, JSON.stringify(themes)); } catch {}
}

export function getAllThemes(): TerminalTheme[] {
  return [...builtinThemes, ...loadImportedThemes()];
}

export function addImportedTheme(t: TerminalTheme): TerminalTheme {
  const imported = loadImportedThemes();
  // Replace if same name exists
  const idx = imported.findIndex(x => x.name === t.name);
  if (idx >= 0) imported[idx] = t; else imported.push(t);
  saveImportedThemes(imported);
  return t;
}

export function removeImportedTheme(name: string) {
  const imported = loadImportedThemes().filter(t => t.name !== name);
  saveImportedThemes(imported);
}

// Apply theme to document CSS variables
export function applyTheme(t: TerminalTheme) {
  const vars = deriveUI(t);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
}

// Current theme state
let currentTheme: TerminalTheme = chatterm;

export function getCurrentTheme(): TerminalTheme { return currentTheme; }

export function setCurrentTheme(t: TerminalTheme) {
  currentTheme = t;
  applyTheme(t);
  themeSubscribers.forEach(fn => fn(t));
  try { localStorage.setItem("chatterm-theme", t.name); } catch {}
}

export function loadSavedTheme(): TerminalTheme {
  try {
    const name = localStorage.getItem("chatterm-theme");
    if (name) {
      const found = getAllThemes().find(t => t.name === name);
      if (found) { currentTheme = found; return found; }
    }
  } catch {}
  return currentTheme;
}
