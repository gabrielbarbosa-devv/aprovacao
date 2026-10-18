"use client";

import * as React from "react";
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";

function Accordion({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root data-slot="accordion" className={cn("w-full", className)} {...props} />;
}

function AccordionItem({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item data-slot="accordion-item" className={cn("border-b last:border-b-0", className)} {...props} />;
}

function AccordionHeader({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Header>) {
  return <AccordionPrimitive.Header data-slot="accordion-header" className={cn("flex", className)} {...props} />;
}

function AccordionTrigger({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return <AccordionPrimitive.Trigger data-slot="accordion-trigger" className={cn("group flex min-h-16 w-full items-center justify-between gap-4 rounded-lg px-4 py-3 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset", className)} {...props}>
    {children}<ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-aria-expanded:rotate-180" />
  </AccordionPrimitive.Trigger>;
}

function AccordionPanel({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Panel>) {
  return <AccordionPrimitive.Panel data-slot="accordion-panel" className={cn("overflow-hidden pb-4", className)} {...props} />;
}

export { Accordion, AccordionItem, AccordionHeader, AccordionTrigger, AccordionPanel };
