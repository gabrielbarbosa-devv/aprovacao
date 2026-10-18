"use client";

import * as React from "react";
import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "cn";

function Progress({ className, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return <ProgressPrimitive.Root data-slot="progress" className={cn("w-full", className)} {...props}>
    <ProgressPrimitive.Track data-slot="progress-track" className="h-2 w-full overflow-hidden rounded-full bg-secondary">
      <ProgressPrimitive.Indicator data-slot="progress-indicator" className="h-full bg-primary transition-[width]" />
    </ProgressPrimitive.Track>
  </ProgressPrimitive.Root>;
}

export { Progress };
