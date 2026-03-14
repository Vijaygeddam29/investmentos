import { useState, useRef, useEffect, useCallback } from "react";
import { X, ChevronDown, Check } from "lucide-react";

interface ComboboxProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  /** Custom filter function — return true to include the option. Defaults to case-insensitive substring match. */
  filterFn?: (option: string, query: string) => boolean;
}

function defaultFilter(option: string, query: string): boolean {
  return option.toLowerCase().includes(query.toLowerCase());
}

export function Combobox({ options, value, onChange, placeholder = "All", label, className = "", filterFn }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const matchFn = filterFn ?? defaultFilter;

  const filtered = query
    ? options.filter(o => matchFn(o, query))
    : options;

  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex, open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (filtered.length > 0) setHighlightIndex(i => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (filtered.length > 0) setHighlightIndex(i => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered.length > 0 && filtered[highlightIndex]) {
          onChange(filtered[highlightIndex]);
          setOpen(false);
          setQuery("");
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setQuery("");
        break;
    }
  }, [open, filtered, highlightIndex, onChange]);

  function selectOption(opt: string) {
    onChange(opt);
    setOpen(false);
    setQuery("");
  }

  function clearValue(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">{label}</label>
      )}
      <div
        className="flex items-center gap-1 bg-secondary/50 border border-border rounded-lg px-2.5 py-1.5 cursor-text transition-colors focus-within:border-primary/50"
        onClick={() => { inputRef.current?.focus(); setOpen(true); }}
      >
        {value ? (
          <span className="inline-flex items-center gap-1 bg-primary/15 text-primary border border-primary/25 rounded px-1.5 py-0.5 text-[11px] font-medium shrink-0">
            {value}
            <button
              onClick={clearValue}
              className="hover:text-primary/70 transition-colors"
              aria-label={`Clear ${label || "filter"}`}
              type="button"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ) : null}
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={value ? "" : placeholder}
          className="flex-1 bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground/60 min-w-[60px]"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>

      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-[200px] overflow-auto rounded-lg border border-border bg-card shadow-xl shadow-black/20 py-1"
        >
          {filtered.map((opt, i) => (
            <li
              key={opt}
              role="option"
              aria-selected={opt === value}
              onClick={() => selectOption(opt)}
              onMouseEnter={() => setHighlightIndex(i)}
              className={`flex items-center justify-between px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                i === highlightIndex ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-secondary/50"
              } ${opt === value ? "font-semibold text-primary" : ""}`}
            >
              <span className="truncate">{opt}</span>
              {opt === value && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
            </li>
          ))}
        </ul>
      )}

      {open && filtered.length === 0 && query && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-xl shadow-black/20 p-3 text-center text-xs text-muted-foreground">
          No matches for "{query}"
        </div>
      )}
    </div>
  );
}
