import { createContext, useContext, useState, useEffect } from "react";
import { settingsAPI } from "../services/api";

const DEFAULTS = {
  store_name:      "Permic Wear Solutions",
  store_location:  "Ruiru, Kenya",
  store_phone:     "+254 792 369700",
  store_email:     "info@permicwear.co.ke",
  currency:        "KES",
  timezone:        "Africa/Nairobi",
  mpesa_shortcode: "880100",   // Paybill business number
  mpesa_account:   "505008",   // Paybill account number (what customer types)
  mpesa_phone:     "0706505008", // Phone that receives M-Pesa notifications
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
    mpesa_shortcode: s.mpesa_shortcode || DEFAULTS.mpesa_shortcode,
    mpesa_account:   s.mpesa_account   || DEFAULTS.mpesa_account,
    mpesa_phone:     s.mpesa_phone     || DEFAULTS.mpesa_phone,
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
