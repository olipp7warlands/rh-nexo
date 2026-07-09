/** Preset Tailwind con los tokens del sistema "Clear". */
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: '#F5F6F8', surface: '#FFFFFF', subtle: '#FAFBFC',
        sidebar: { DEFAULT: '#DCE2E8', hover: '#CCD4DD' },
        hover: '#EDEFF2',
        ink: { DEFAULT: '#0F1419', secondary: '#4B5563', tertiary: '#9CA3AF', disabled: '#D1D5DB', inverse: '#FFFFFF' },
        line: { DEFAULT: '#E5E7EB', strong: '#D1D5DB', subtle: '#F1F3F5' },
        // Monocromo (humanX): antes cian de marca. Los colores de estado/categoría de abajo
        // (success/warning/danger/info) NO cambian — siguen siendo el acento de la app.
        accent: { DEFAULT: '#0F1419', hover: '#000000', pressed: '#000000', soft: '#F0F1F3', ink: '#0F1419' },
        success: { DEFAULT: '#16A34A', soft: '#DCFCE7' },
        warning: { DEFAULT: '#D97706', soft: '#FEF3C7' },
        danger: { DEFAULT: '#DC2626', soft: '#FEE2E2' },
        info: { DEFAULT: '#2563EB', soft: '#DBEAFE' },
      },
      borderRadius: { xs: '4px', sm: '6px', md: '8px', lg: '12px', xl: '16px' },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        // humanX: titulares y números destacados. Cuerpo sigue en Inter (sans).
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
    },
  },
};
