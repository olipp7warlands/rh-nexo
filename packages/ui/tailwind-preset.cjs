/** Preset Tailwind con los tokens del sistema "Clear". */
module.exports = {
  theme: {
    extend: {
      colors: {
        // humanX — dirección "Editorial": blanco/negro puro, sin color de marca (ver globals.css).
        canvas: '#FFFFFF', surface: '#FFFFFF', subtle: '#FAFAFA',
        sidebar: { DEFAULT: '#FAFAFA', hover: '#F0F0F0' },
        hover: '#F0F0F0',
        // secondary/tertiary son texto legible (AA ≥ 4.5:1 sobre blanco); disabled es el único
        // gris "de adorno" sin garantía de contraste de texto (puntos decorativos, no copy).
        ink: { DEFAULT: '#0A0A0A', secondary: '#6B6B6B', tertiary: '#757575', disabled: '#D6D6D6', inverse: '#FFFFFF' },
        line: { DEFAULT: '#EAEAEA', strong: '#D6D6D6', subtle: '#F2F2F2' },
        accent: { DEFAULT: '#0A0A0A', hover: '#000000', pressed: '#000000', soft: '#F0F0F0', ink: '#0A0A0A' },
        // Monocromos por diseño — la distinción entre estados vive en Badge.tsx
        // (relleno/contorno/píldora invertida), no en el matiz.
        success: { DEFAULT: '#0A0A0A', soft: '#F0F0F0' },
        warning: { DEFAULT: '#6B6B6B', soft: '#F5F5F5' },
        danger: { DEFAULT: '#0A0A0A', soft: '#F0F0F0' },
        info: { DEFAULT: '#6B6B6B', soft: '#F5F5F5' },
      },
      borderRadius: { xs: '4px', sm: '6px', md: '8px', lg: '12px', xl: '16px' },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
        // humanX: titulares y números destacados, peso 500. Cuerpo sigue en Inter (sans).
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
    },
  },
};
