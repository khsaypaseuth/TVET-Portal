# Internationalization (i18n) Setup

This project uses `i18next` and `react-i18next` for internationalization support with English and Lao languages.

## Structure

```
src/i18n/
├── config.ts          # i18n configuration
└── locales/
    ├── en.json        # English translations
    └── lo.json        # Lao translations
```

## Adding New Translations

### 1. Add Translation Keys

Add your translation keys to both `en.json` and `lo.json` files:

**en.json:**
```json
{
  "common": {
    "myNewKey": "My English Text"
  }
}
```

**lo.json:**
```json
{
  "common": {
    "myNewKey": "ຂໍ້ຄວາມລາວຂອງຂ້ອຍ"
  }
}
```

### 2. Use in Components

Import and use the `useTranslation` hook:

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return <div>{t('common.myNewKey')}</div>;
}
```

## Language Switcher

The language switcher component is available at:
- Main header (when logged in)
- Auth pages (sign in/sign up)

Users can switch between English (🇬🇧) and Lao (🇱🇦) languages. The selected language is saved in localStorage and persists across sessions.

## Supported Languages

- **English (en)**: Default language
- **Lao (lo)**: Secondary language

## Configuration

The i18n configuration is in `src/i18n/config.ts`. Key settings:

- **Fallback language**: English
- **Language detection**: Uses localStorage and browser settings
- **Storage**: Selected language is saved in localStorage

## Adding More Languages

To add a new language:

1. Create a new JSON file in `src/i18n/locales/` (e.g., `fr.json` for French)
2. Add translations matching the structure of `en.json`
3. Import and add to `config.ts`:

```typescript
import frTranslations from './locales/fr.json';

// In resources:
fr: {
  translation: frTranslations,
}
```

4. Add the language option to `LanguageSwitcher.tsx`:

```typescript
const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'lo', name: 'ລາວ', flag: '🇱🇦' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' }, // New language
];
```

