import { TodayPage } from "@/features/today/components/today-page";
import { Suspense } from "react";
import { TodayLoading } from "@/features/today/components/today-loading";

export default function Home() {
  return <Suspense fallback={<TodayLoading />}><TodayPage /></Suspense>;
}
