type Action = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  kind?: "primary" | "line" | "ghost";
};

type Props = {
  title: string;
  body: string;
  money?: string;
  policy?: string;
  actions?: Action[];
};

export function FailureRecovery({ title, body, money, policy, actions = [] }: Props) {
  return (
    <div className="dialog-alert mt-4 p-4" role="alert">
      <p className="text-sm text-paper">{title}</p>
      <p className="mt-1 text-sm text-mist">{body}</p>
      {money ? <p className="mt-2 text-sm font-medium text-paper">{money}</p> : null}
      {policy ? <p className="mt-3 text-xs leading-relaxed text-ash">{policy}</p> : null}
      {actions.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={action.disabled}
              onClick={action.onClick}
              className={
                action.kind === "ghost"
                  ? "btn-ghost min-h-11"
                  : action.kind === "line"
                    ? "btn btn-line w-full"
                    : "btn btn-primary w-full"
              }
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
