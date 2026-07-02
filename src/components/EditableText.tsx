interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  readOnly?: boolean;
  multiline?: boolean;
}

/** Texto/textarea inline editable usado dentro del "papel" de la boleta. */
export const EditableText = ({
  value,
  onChange,
  className = '',
  placeholder = '',
  readOnly = false,
  multiline = false,
}: EditableTextProps) => {
  const commonClasses = `bg-transparent border-none focus:ring-2 focus:ring-t-primary/20 rounded-md outline-none print:appearance-none hover:bg-t-accent-bg/80 focus:bg-t-accent-bg print:hover:bg-transparent transition-colors text-inherit font-inherit ${className} ${readOnly ? 'hover:bg-transparent focus:ring-0 cursor-default' : 'cursor-text px-1'}`;

  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`${commonClasses} resize-none block py-1 overflow-hidden print:overflow-visible`}
        rows={Math.max(1, (value.match(/\n/g) || []).length + 1)}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = 'auto';
          target.style.height = target.scrollHeight + 'px';
        }}
        style={{ height: value ? 'auto' : undefined }}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`${commonClasses} py-0.5`}
    />
  );
};
