import jsxA11y from "eslint-plugin-jsx-a11y";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tailwindcss from "eslint-plugin-tailwindcss";

const eslintConfig = [
  // ─── Tailwind CSS class validation ───────────────────────────
  // Catches non-existent, duplicate, and contradicting classes at lint time.
  // Inspired by Pump.fun's approach: they added eslint rules to flag
  // classes that "flat out didn't exist" and web-only classes that don't
  // apply in React Native. For our Next.js dashboard this catches typos
  // and ensures consistent Tailwind usage.
  ...tailwindcss.configs["flat/recommended"],
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      tailwindcss,
    },
    rules: {
      // Flag class names that don't exist in the Tailwind config
      "tailwindcss/no-custom-classname": ["warn", {
        // Allow our design-token classes (CSS variable based)
        whitelist: [
          "bg-background.*",
          "bg-surface.*",
          "text-primary.*",
          "text-secondary.*",
          "border-surface.*",
          "bg-brand.*",
          "text-brand.*",
          "text-bullish",
          "text-bearish",
          "bg-bullish.*",
          "bg-bearish.*",
        ],
      }],
      // Warn on contradicting classes (e.g., p-2 and p-4 on same element)
      "tailwindcss/no-contradicting-classname": "warn",
      // Enforce consistent class ordering for readability
      "tailwindcss/classnames-order": "warn",
      // No unnecessary arbitrary values when a utility exists
      "tailwindcss/no-unnecessary-arbitrary-value": "warn",
    },
    settings: {
      tailwindcss: {
        config: "tailwind.config.js",
        callees: ["cn", "clsx", "cva", "twMerge"],
      },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "jsx-a11y": jsxA11y,
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // Accessibility rules
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/anchor-is-valid": "warn",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/heading-has-content": "error",
      "jsx-a11y/html-has-lang": "error",
      "jsx-a11y/img-redundant-alt": "warn",
      "jsx-a11y/interactive-supports-focus": "warn",
      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/media-has-caption": "warn",
      "jsx-a11y/mouse-events-have-key-events": "warn",
      "jsx-a11y/no-access-key": "error",
      "jsx-a11y/no-autofocus": "warn",
      "jsx-a11y/no-distracting-elements": "error",
      "jsx-a11y/no-redundant-roles": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/scope": "error",
      "jsx-a11y/tabindex-no-positive": "warn",
    },
  },
];

export default eslintConfig;
