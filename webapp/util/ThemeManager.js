sap.ui.define([
    "sap/ui/core/Theming"
], (Theming) => {
    "use strict";

    const THEME_KEY = "fmDriveTheme";

    return {
        isDark() {
            try {
                return window.localStorage.getItem(THEME_KEY) === "dark";
            } catch (e) {
                return false;
            }
        },

        setTheme(bDark) {
            Theming.setTheme(bDark ? "sap_horizon_dark" : "sap_horizon");
        },

        persist(bDark) {
            try {
                window.localStorage.setItem(THEME_KEY, bDark ? "dark" : "light");
            } catch (e) { /* ignore */ }
        }
    };
});