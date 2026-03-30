import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export type RemoteComponent = ComponentType<Record<string, never>>;

type RemoteModule = {
  default: RemoteComponent;
};

export function loadRemoteComponent(loader: () => Promise<RemoteModule>) {
  return dynamic(async () => {
    const remoteModule = await loader();
    return remoteModule.default;
  }, { ssr: false });
}
