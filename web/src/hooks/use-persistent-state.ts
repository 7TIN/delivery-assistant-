import { useEffect, useState } from "react";

export function usePersistentState<T extends string>(key: string, defaultValue: T): readonly [T, (value: T) => void];
export function usePersistentState<T extends string[]>(key: string, defaultValue: T): readonly [T, (value: T) => void];
export function usePersistentState<T>(key: string, defaultValue: T): readonly [T, (value: T) => void];

export function usePersistentState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return defaultValue;
    }

    const stored = window.localStorage.getItem(key);
    if (stored) {
      try {
        return JSON.parse(stored) as T;
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  }, [key, value]);

  return [value, setValue] as const;
}
