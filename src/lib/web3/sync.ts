const WEB3_SYNC_EVENT = "sakura:web3-sync";

export function emitWeb3Sync(reason = "update") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(WEB3_SYNC_EVENT, {
      detail: { reason, at: Date.now() },
    }),
  );
}

export function subscribeWeb3Sync(listener: () => void) {
  if (typeof window === "undefined") return () => {};

  const handler = () => listener();
  window.addEventListener(WEB3_SYNC_EVENT, handler as EventListener);

  return () => {
    window.removeEventListener(WEB3_SYNC_EVENT, handler as EventListener);
  };
}