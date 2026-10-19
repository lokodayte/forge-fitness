import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, WifiOff, X } from 'lucide-react';
import { Button, IconButton } from './ui';

/** Shows "offline ready" and "update available" notices from the service worker. */
export function PwaPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!offlineReady && !needRefresh) return null;
  return (
    <div role="status" className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-2xl lg:bottom-6">
      {needRefresh ? <RefreshCw className="h-5 w-5 shrink-0 text-accent-ink" aria-hidden /> : <WifiOff className="h-5 w-5 shrink-0 text-accent-ink" aria-hidden />}
      <p className="flex-1 text-sm">{needRefresh ? 'A new version of FORGE is available.' : 'FORGE is ready to work offline.'}</p>
      {needRefresh && (
        <Button size="sm" variant="primary" onClick={() => updateServiceWorker(true)}>
          Update
        </Button>
      )}
      <IconButton
        icon={X}
        label="Dismiss"
        onClick={() => {
          setOfflineReady(false);
          setNeedRefresh(false);
        }}
      />
    </div>
  );
}
