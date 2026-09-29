import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { IconContext } from "@phosphor-icons/react";
import "./design-system/system.css";
import "./index.css";
import "./coaching.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <IconContext.Provider value={{ weight: "bold" }}><App /></IconContext.Provider>
  </StrictMode>,
);
