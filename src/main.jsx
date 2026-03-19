import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

const umamiSrc = import.meta.env.VITE_UMAMI_SCRIPT_URL;
const umamiId = import.meta.env.VITE_UMAMI_WEBSITE_ID;
if (import.meta.env.PROD && umamiSrc && umamiId) {
  const umami = document.createElement("script");
  umami.defer = true;
  umami.src = umamiSrc;
  umami.dataset.websiteId = umamiId;
  document.head.appendChild(umami);
}

createRoot(document.getElementById("root")).render(<App />);
