import { isValidRut } from '../utils/rut';

interface RutFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Input de RUT chileno con validación de dígito verificador en vivo.
 * No bloquea la escritura (el usuario puede seguir tipeando), solo
 * avisa visualmente cuando el RUT ingresado no calza.
 */
export const RutField = ({ label, value, onChange, placeholder, className = '' }: RutFieldProps) => {
  const valid = isValidRut(value);

  return (
    <div className={className}>
      <label className="text-xs text-slate-400 block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={!valid}
        className={`w-full bg-slate-950 border rounded-lg py-2 px-3 focus:outline-none focus:ring-1 text-slate-200 transition-colors ${
          valid
            ? 'border-slate-800 focus:ring-t-primary'
            : 'border-red-700 focus:ring-red-600'
        }`}
      />
      {!valid && (
        <p className="text-[11px] text-red-400 mt-1">
          El RUT no es válido (revisa el dígito verificador).
        </p>
      )}
    </div>
  );
};
