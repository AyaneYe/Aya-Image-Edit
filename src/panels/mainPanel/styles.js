export const panelRoot =
  "flex flex-col gap-3 text-[color:var(--aya-fg)] text-sm";

export const tabList =
  "inline-flex w-fit rounded-md border border-[color:var(--aya-border)] bg-[color:var(--aya-surface)] p-1 gap-1";
export const tabBase =
  "h-8 px-3 rounded-md text-xs border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--aya-ring)]";
export const tabActive =
  "bg-[color:var(--aya-surface-strong)] border-[color:var(--aya-border-strong)] text-[color:var(--aya-fg)]";
export const tabInactive =
  "bg-transparent border-transparent text-[color:var(--aya-fg-muted)] hover:bg-[color:var(--aya-surface-hover)] hover:text-[color:var(--aya-fg)]";

export const card =
  "rounded-md border border-[color:var(--aya-border)] bg-[color:var(--aya-surface)] p-3 flex flex-col gap-3";
export const cardTitle = "text-sm font-semibold text-[color:var(--aya-fg)]";
export const cardMeta = "text-xs text-[color:var(--aya-fg-subtle)]";
export const sectionTitle = "text-sm font-medium text-[color:var(--aya-fg)]";
export const labelText = "text-xs text-[color:var(--aya-fg-muted)]";
export const helperText = "text-xs text-[color:var(--aya-fg-muted)]";

export const fieldBase =
  "w-full h-9 text-xs leading-5 border border-[color:var(--aya-border)] rounded-md px-2.5 bg-[color:var(--aya-input-bg)] text-[color:var(--aya-fg)] " +
  "placeholder:text-[color:var(--aya-fg-subtle)] disabled:opacity-60 disabled:bg-[color:var(--aya-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--aya-ring)]";

export const textareaBase =
  "w-full min-h-36 text-xs leading-5 rounded-md p-2.5 bg-[color:var(--aya-input-bg)] resize-y m-0 border border-[color:var(--aya-border)] text-[color:var(--aya-fg)] " +
  "placeholder:text-[color:var(--aya-fg-subtle)] disabled:opacity-60 disabled:bg-[color:var(--aya-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--aya-ring)]";

export const btnBase =
  "h-9 px-3 text-xs rounded-md border border-[color:var(--aya-border-strong)] bg-[color:var(--aya-surface)] text-[color:var(--aya-fg)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 " +
  "hover:bg-[color:var(--aya-surface-hover)] active:bg-[color:var(--aya-surface-strong)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--aya-ring)]";
export const btnPrimary =
  "h-9 px-3 text-xs rounded-md border border-[color:var(--aya-primary)] bg-[color:var(--aya-primary)] text-[color:var(--aya-primary-contrast)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 " +
  "hover:bg-[color:var(--aya-primary-hover)] active:bg-[color:var(--aya-primary-active)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--aya-ring)]";
export const btnGhost =
  "h-9 px-3 text-xs rounded-md border border-transparent bg-transparent text-[color:var(--aya-fg-muted)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 " +
  "hover:bg-[color:var(--aya-surface-hover)] hover:text-[color:var(--aya-fg)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--aya-ring)]";

export const statusBox =
  "rounded-md border px-2.5 py-2 text-xs break-words bg-[color:var(--aya-info-bg)] border-[color:var(--aya-info-border)] text-[color:var(--aya-info-fg)]";
export const errorBox =
  "rounded-md border px-2.5 py-2 text-xs break-words bg-[color:var(--aya-danger-bg)] border-[color:var(--aya-danger-border)] text-[color:var(--aya-danger-fg)]";
export const checkboxPill =
  "flex items-center gap-2 text-xs rounded-md border border-[color:var(--aya-border)] px-2 py-1 bg-[color:var(--aya-surface)] text-[color:var(--aya-fg)]";

export const feedbackStack = "flex flex-col gap-2";
