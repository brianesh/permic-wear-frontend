import { createContext, useContext, useState, useEffect } from "react";
import { settingsAPI } from "../services/api";

const DEFAULTS = {
  store_name:      "Permic Wear Solutions",
  store_location:  "Ruiru, Kenya",
  store_phone:     "+254706505008",
  store_email:     "permicwear@gmail.com",
  currency:        "KES",
  timezone:        "Africa/Nairobi",
  ncba_shortcode:  "880100",   // NCBA paybill/business number
  ncba_account:    "505008",   // NCBA account number (what customer types)
  ncba_phone:      "0706505008", // Phone that receives notifications
};

const StoreContext = createContext({ ...DEFAULTS, refreshStore: () => {} });

function mapSettings(s) {
  return {
    store_name:      s.store_name      || DEFAULTS.store_name,
    store_location:  s.store_location  || DEFAULTS.store_location,
    store_phone:     s.store_phone     || DEFAULTS.store_phone,
    store_email:     s.store_email     || DEFAULTS.store_email,
    currency:        s.currency        || DEFAULTS.currency,
    timezone:        s.timezone        || DEFAULTS.timezone,
    ncba_shortcode:  s.ncba_shortcode  || DEFAULTS.ncba_shortcode,
    ncba_account:    s.ncba_account    || DEFAULTS.ncba_account,
    ncba_phone:      s.ncba_phone      || DEFAULTS.ncba_phone,
  };
}

export function StoreProvider({ children, isLoggedIn }) {
  const [store, setStore] = useState(DEFAULTS);

  const load = () => {
    settingsAPI.get()
      .then(res => setStore(mapSettings(res.data || {})))
      .catch(() => {});
  };

  useEffect(() => {
    if (isLoggedIn) load();
  }, [isLoggedIn]);

  return (
    <StoreContext.Provider value={{ ...store, refreshStore: load }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);
