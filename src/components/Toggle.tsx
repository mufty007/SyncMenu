/**
 * Switch control. Knob geometry is inline-styled so it renders identically
 * everywhere (arbitrary-value utility classes proved unreliable here).
 */
export default function Toggle({
  label,
  checked,
  onChange,
  dark = false,
}: {
  label?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  dark?: boolean;
}) {
  return (
    <label
      className={`${
        label ? "flex w-full justify-between" : "inline-flex"
      } cursor-pointer items-center gap-3`}
    >
      {label && (
        <span className={dark ? "text-xs font-medium text-white/60" : "text-sm font-medium"}>
          {label}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 rounded-full transition-colors duration-200 ${
          checked ? "bg-brand" : dark ? "bg-white/20" : "bg-mist"
        }`}
        style={{ width: 44, height: 24 }}
      >
        <span
          className="absolute rounded-full bg-white shadow"
          style={{
            width: 20,
            height: 20,
            top: 2,
            left: checked ? 22 : 2,
            transition: "left 200ms ease-out",
          }}
        />
      </button>
    </label>
  );
}
