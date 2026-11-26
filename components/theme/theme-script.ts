/** localStorage key for the chosen theme: "light", "dark" or missing (follow the system). */
export const THEME_KEY = "theme";

/**
 * Runs before paint (inline in <head>) so the page never flashes the wrong theme.
 * Kept as a plain string: it must not depend on the React bundle.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
