"use client";

import { useEffect, useState } from "react";
import { FlowBuilder } from "@/components/FlowBuilder";
import { getLocale, type Locale } from "@/lib/i18n";

export default function FlowBuilderPage() {
  const [locale, setLocale] = useState<Locale>("ko");

  useEffect(() => {
    setLocale(getLocale());
  }, []);

  return <FlowBuilder locale={locale} />;
}
