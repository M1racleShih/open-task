import { createRoot } from "react-dom/client";
import { I18n } from "./i18n.js";
import { App } from "./App.js";
import "./style.css";
createRoot(document.getElementById("root")!).render(
  <I18n>
    <App />
  </I18n>,
);
