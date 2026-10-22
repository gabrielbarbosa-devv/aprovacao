"use client";

import { useCallback, useRef, useState } from "react";
import { saveTodoTaskBundleAction } from "@/features/todo/actions";
import type { TodoTaskBundle } from "@/features/todo/domain/schemas";

export function useTodoTaskFormMutation() {
  const [pending, setPending] = useState(false);
  const requestLock = useRef(false);

  const save = useCallback(async (input: TodoTaskBundle) => {
    if (requestLock.current) return { ok: false as const, message: "O salvamento já está em andamento." };
    requestLock.current = true;
    setPending(true);
    try {
      return await saveTodoTaskBundleAction(input);
    } finally {
      requestLock.current = false;
      setPending(false);
    }
  }, []);

  return { save, pending };
}
