import Server from "lucide-react/dist/esm/icons/server";
type RemoteBackendSwitcherProps = {
  onOpenServerSettings: () => void;
};

export function RemoteBackendSwitcher({
  onOpenServerSettings,
}: RemoteBackendSwitcherProps) {
  return (
    <button
      type="button"
      className="ghost remote-switcher-trigger"
      onClick={onOpenServerSettings}
      aria-label="Open server settings"
      title="Open server settings"
    >
      <Server aria-hidden />
    </button>
  );
}
