import { useEffect } from "react";
import { useSyncStore } from "../store/syncStore";

export function useNetworkStatus() {
  const { networkStatus, setNetworkStatus, sync } = useSyncStore();

  useEffect(() => {
    const handleOnline = async () => {
      setNetworkStatus("online");
      setTimeout(() => sync(), 1000);
    };
    const handleOffline = () => setNetworkStatus("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setNetworkStatus, sync]);

  return networkStatus;
}
