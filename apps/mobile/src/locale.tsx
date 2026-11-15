import { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { isLocale, type Locale } from "@dineflow/shared";
const LocaleContext = createContext<{ locale: Locale; changeLocale(locale: Locale): void }>({
  locale: "fa-AF", changeLocale: () => {}
});
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("fa-AF");
  useEffect(() => {
    SecureStore.getItemAsync("dineflow-preferred-locale").then((saved) => {
      if (isLocale(saved)) setLocale(saved);
    }).catch(() => {});
  }, []);
  const changeLocale = (value: Locale) => {
    setLocale(value);
    void SecureStore.setItemAsync("dineflow-preferred-locale", value);
  };
  return <LocaleContext.Provider value={{ locale, changeLocale }}>{children}</LocaleContext.Provider>;
}
export function useLocale() { return useContext(LocaleContext); }
