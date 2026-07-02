interface EditableNumberProps {
  value: number | '';
  onChange: (value: number | '') => void;
  className?: string;
  placeholder?: string;
  readOnly?: boolean;
}

/** Input numérico inline editable usado dentro del "papel" de la boleta. */
export const EditableNumber = ({
  value,
  onChange,
  className = '',
  placeholder = '',
  readOnly = false,
}: EditableNumberProps) => {
  return (
    <input
      type="number"
      value={value === '' ? '' : value}
      onChange={(e) => {
        const val = e.target.value;
        onChange(val === '' ? '' : Number(val));
      }}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`no-spinners bg-transparent border-none focus:ring-2 focus:ring-t-primary/20 rounded-md outline-none print:appearance-none hover:bg-t-accent-bg/80 focus:bg-t-accent-bg print:hover:bg-transparent transition-colors text-inherit font-inherit ${className} ${readOnly ? 'hover:bg-transparent focus:ring-0 cursor-default' : 'cursor-text px-1 py-0.5'}`}
    />
  );
};
