import "../../../styles/mobile-setup-wizard.css";
import X from "lucide-react/dist/esm/icons/x";
import { ModalShell } from "../../design-system/components/modal/ModalShell";

export type MobileServerSetupWizardProps = {
  remoteHostDraft: string;
  remoteTokenDraft: string;
  busy: boolean;
  checking: boolean;
  statusMessage: string | null;
  statusError: boolean;
  onClose: () => void;
  onRemoteHostChange: (value: string) => void;
  onRemoteTokenChange: (value: string) => void;
  onConnectTest: () => void;
  submitLabel?: string;
};

export function MobileServerSetupWizard({
  remoteHostDraft,
  remoteTokenDraft,
  busy,
  checking,
  statusMessage,
  statusError,
  onClose,
  onRemoteHostChange,
  onRemoteTokenChange,
  onConnectTest,
  submitLabel = "Connect & test",
}: MobileServerSetupWizardProps) {
  return (
    <ModalShell
      className="mobile-setup-wizard-overlay"
      cardClassName="mobile-setup-wizard-card"
      onBackdropClick={onClose}
      ariaLabel="Remote server setup"
    >
      <div className="mobile-setup-wizard-header">
        <button
          type="button"
          className="ghost icon-button mobile-setup-wizard-close"
          onClick={onClose}
          aria-label="Close remote setup"
        >
          <X aria-hidden />
        </button>
        <div className="mobile-setup-wizard-kicker">Remote Setup Required</div>
        <h2 className="mobile-setup-wizard-title">Connect to your backend service</h2>
        <p className="mobile-setup-wizard-subtitle">
          Complete this setup before using the app. Use the same endpoint and optional token
          configured for your remote CodexMonitor server.
        </p>
      </div>

      <div className="mobile-setup-wizard-body">
        <label className="mobile-setup-wizard-label" htmlFor="mobile-setup-host">
          Remote server / Endpoint
        </label>
        <input
          id="mobile-setup-host"
          className="mobile-setup-wizard-input"
          value={remoteHostDraft}
          placeholder="server.example.com:4732 or https://codex.example.com"
          onChange={(event) => onRemoteHostChange(event.target.value)}
          disabled={busy || checking}
        />

        <label className="mobile-setup-wizard-label" htmlFor="mobile-setup-token">
          Remote backend token
        </label>
        <input
          id="mobile-setup-token"
          type="password"
          className="mobile-setup-wizard-input"
          value={remoteTokenDraft}
          placeholder="Token"
          onChange={(event) => onRemoteTokenChange(event.target.value)}
          disabled={busy || checking}
        />

        <button
          type="button"
          className="button primary mobile-setup-wizard-action"
          onClick={onConnectTest}
          disabled={busy || checking}
        >
          {checking ? "Checking..." : busy ? "Saving..." : submitLabel}
        </button>

        {statusMessage ? (
          <div
            className={`mobile-setup-wizard-status${
              statusError ? " mobile-setup-wizard-status-error" : ""
            }`}
            role="status"
            aria-live="polite"
          >
            {statusMessage}
          </div>
        ) : null}

        <div className="mobile-setup-wizard-hint">
          Use the endpoint from your remote server configuration. You can also update advanced
          remote settings later from Settings → Server.
        </div>
      </div>
    </ModalShell>
  );
}
