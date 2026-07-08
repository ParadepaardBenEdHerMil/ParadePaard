import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { PlatformAdminProvider } from "./context/PlatformAdminContext";
import { installApiErrorInterceptor } from "./utils/apiError";
import "./stylesheets/AppBase.css";
import "./stylesheets/PageShell.css";

// Rewrite ambiguous "Request failed with status code 4xx" axios errors with the
// backend's human-readable message, app-wide, before anything makes a request.
installApiErrorInterceptor();

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <AuthProvider>
            <PlatformAdminProvider>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </PlatformAdminProvider>
        </AuthProvider>
    </React.StrictMode>
);
