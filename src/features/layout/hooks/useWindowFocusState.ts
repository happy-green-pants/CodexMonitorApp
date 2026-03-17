import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { isMobilePlatform } from "../../../utils/platformPaths";

export function useWindowFocusState() {
	const [isFocused, setIsFocused] = useState(() => {
		if (typeof document === "undefined") {
			return true;
		}
		return document.hasFocus();
	});

	useEffect(() => {
		let unlistenFocus: (() => void) | null = null;
		let unlistenBlur: (() => void) | null = null;

		const handleFocus = () => setIsFocused(true);
		const handleBlur = () => setIsFocused(false);
		const handleVisibility = () => {
			if (document.visibilityState === "visible") {
				handleFocus();
			} else {
				handleBlur();
			}
		};

		try {
			const windowHandle = getCurrentWindow();
			windowHandle
				.listen("tauri://focus", handleFocus)
				.then((handler) => {
					unlistenFocus = handler;
				})
				.catch(() => {
					// Ignore; fallback listeners below cover focus changes.
				});
			windowHandle
				.listen("tauri://blur", handleBlur)
				.then((handler) => {
					unlistenBlur = handler;
				})
				.catch(() => {
					// Ignore; fallback listeners below cover focus changes.
				});
		} catch {
			// In non-Tauri environments, getCurrentWindow can throw.
			// The DOM listeners below still provide focus state.
		}

		window.addEventListener("focus", handleFocus);
		window.addEventListener("blur", handleBlur);
		document.addEventListener("visibilitychange", handleVisibility);

		return () => {
			if (unlistenFocus) {
				unlistenFocus();
			}
			if (unlistenBlur) {
				unlistenBlur();
			}
			window.removeEventListener("focus", handleFocus);
			window.removeEventListener("blur", handleBlur);
			document.removeEventListener("visibilitychange", handleVisibility);
		};
	}, []);

	useEffect(() => {
		if (!isMobilePlatform()) {
			return;
		}
		let didCleanup = false;
		let removeListener: (() => void) | null = null;

		void (async () => {
			try {
				const { Capacitor } = await import("@capacitor/core");
				if (!Capacitor.isNativePlatform()) {
					return;
				}
				const { App } = await import("@capacitor/app");
				const registration = await App.addListener(
					"appStateChange",
					(state: { isActive: boolean }) => {
						if (didCleanup) {
							return;
						}
						setIsFocused(Boolean(state.isActive));
					},
				);
				if (didCleanup) {
					registration.remove();
					return;
				}
				removeListener = () => {
					registration.remove();
				};
			} catch {
				// Ignore: capacitor may be unavailable in non-native runtimes.
			}
		})();

		return () => {
			didCleanup = true;
			if (removeListener) {
				removeListener();
			}
		};
	}, []);

	return isFocused;
}
