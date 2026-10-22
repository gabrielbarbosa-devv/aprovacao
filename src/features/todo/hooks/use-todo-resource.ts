"use client";

import { useCallback, useEffect, useState } from "react";
import type { TodoActionResult } from "@/features/todo/actions";

type Loader<T> = () => Promise<TodoActionResult<T>>;
type Mutation = (input: unknown) => Promise<TodoActionResult<unknown>>;

export function useTodoResource<T>(loader: Loader<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loader();
      if (result.ok) setData(result.data);
      else setError(result.message);
    } catch {
      setError("Não foi possível carregar os dados do To-Do.");
    } finally {
      setLoading(false);
    }
  }, [loader]);

  useEffect(() => {
    let active = true;
    void loader().then((result) => {
      if (!active) return;
      if (result.ok) setData(result.data);
      else setError(result.message);
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setError("Não foi possível carregar os dados do To-Do.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [loader]);

  const mutate = useCallback(async (action: Mutation, input: unknown) => {
    const result = await action(input);
    if (result.ok) await refresh();
    else setError(result.message);
    return result;
  }, [refresh]);

  return { data, loading, error, refresh, mutate };
}
