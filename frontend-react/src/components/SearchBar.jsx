import React, { useState, useRef } from 'react';
import VoiceSearchButton from './VoiceSearchButton';
import './SearchBar.css';

export default function SearchBar({ value, onChange, onSearch, onClear, onMicResult, placeholder = 'Buscar produtos...', onFocus, onBlur }) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch && value?.trim()) onSearch(value.trim());
    inputRef.current?.blur();
  };

  const handleClear = () => {
    if (onClear) onClear();
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    setFocused(true);
    if (onFocus) onFocus();
  };

  const handleBlur = () => {
    setFocused(false);
    if (onBlur) onBlur();
  };

  return (
    <form
      className={`search-bar ${focused ? 'search-bar--focused' : ''}`}
      onSubmit={handleSubmit}
      role="search"
    >
      {/* Lupa */}
      <span className="search-bar__icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </span>

      {/* Input */}
      <input
        ref={inputRef}
        className="search-bar__input"
        type="text"
        value={value || ''}
        onChange={(e) => onChange && onChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
      />

      {/* Clear X */}
      {value && value.length > 0 && (
        <button type="button" className="search-bar__clear" onClick={handleClear} aria-label="Limpar busca">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Mic */}
      {onMicResult && (
        <div className="search-bar__mic">
          <VoiceSearchButton onResult={onMicResult} size={17} />
        </div>
      )}
    </form>
  );
}
