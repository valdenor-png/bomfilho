import React from 'react';

export default function SwitchControl({ id, label, description, checked, onChange, disabled = false }) {
  return (
    <label className={`switch-item ${disabled ? 'is-disabled' : ''}`} htmlFor={id}>
      <span className="switch-item-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>

      <span className="switch-control" aria-hidden="true">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
        />
        <span className="switch-slider" />
      </span>
    </label>
  );
}
