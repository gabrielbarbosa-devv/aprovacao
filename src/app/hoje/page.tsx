import { Suspense } from "react";
import { TodayPage } from "@/features/today/components/today-page";
import { TodayLoading } from "@/features/today/components/today-loading";

export default function TodayRoute() {
  return <Suspense fallback={<TodayLoading />}><TodayPage /></Suspense>;
}
