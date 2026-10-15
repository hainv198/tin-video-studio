"use client";

import { useSyncExternalStore } from "react";

export interface Observable<S> {
  readonly state: S;
  readonly subscribe: (listener: () => void) => () => void;
}

/** Đọc trạng thái của một controller (hoặc StudioSession) và vẽ lại khi nó đổi. */
export function useController<S>(source: Observable<S>): S {
  return useSyncExternalStore(
    source.subscribe,
    () => source.state,
    () => source.state,
  );
}
