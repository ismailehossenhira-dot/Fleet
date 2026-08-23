import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'ocean-blue' | 'emerald-teal' | 'crimson-red' | 'carrybee-amber';

export interface ThemeOption {
  id: ThemeMode;
  name: string;
  englishName: string;
  tagline: string;
  primaryColor: string;
  sidebarColor: string;
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  previewGradient: string;
  iconBg: string;
  badgeLabel: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'ocean-blue',
    name: 'Classic Ocean Blue',
    englishName: 'Classic Ocean Blue',
    tagline: '',
    primaryColor: '#2563eb',
    sidebarColor: '#020617',
    accentColor: '#3b82f6',
    badgeBg: '#eff6ff',
    badgeText: '#1d4ed8',
    previewGradient: 'from-blue-600 via-blue-500 to-indigo-700',
    iconBg: 'bg-blue-600',
    badgeLabel: 'Ocean',
  },
  {
    id: 'emerald-teal',
    name: 'Steadfast courier LTD',
    englishName: 'Steadfast courier LTD',
    tagline: '',
    primaryColor: '#2ea884',
    sidebarColor: '#071e17',
    accentColor: '#3ebd97',
    badgeBg: '#e8f7f2',
    badgeText: '#1b6b54',
    previewGradient: 'from-[#3ebd97] via-[#2ea884] to-[#185e49]',
    iconBg: 'bg-[#2ea884]',
    badgeLabel: 'Steadfast',
  },
  {
    id: 'crimson-red',
    name: 'Pathao Red',
    englishName: 'Pathao Red',
    tagline: '',
    primaryColor: '#ea2340',
    sidebarColor: '#160507',
    accentColor: '#ff2a4b',
    badgeBg: '#fff1f2',
    badgeText: '#be123c',
    previewGradient: 'from-[#ff385c] via-[#ea2340] to-[#9f1239]',
    iconBg: 'bg-[#ea2340]',
    badgeLabel: 'Pathao',
  },
  {
    id: 'carrybee-amber',
    name: 'Carrybee Amber',
    englishName: 'Carrybee Amber',
    tagline: '',
    primaryColor: '#f59e0b',
    sidebarColor: '#18150f',
    accentColor: '#fbbf24',
    badgeBg: '#fef3c7',
    badgeText: '#92400e',
    previewGradient: 'from-[#fbbf24] via-[#f59e0b] to-[#b45309]',
    iconBg: 'bg-[#f59e0b]',
    badgeLabel: 'Carrybee',
  },
];

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  currentThemeOption: ThemeOption;
  isEmerald: boolean;
  isOcean: boolean;
  isCrimson: boolean;
  isAmber: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'fleet_flow_app_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'emerald-teal' || saved === 'ocean-blue' || saved === 'crimson-red' || saved === 'carrybee-amber') {
        return saved;
      }
    } catch {
      // fallback
    }
    return 'ocean-blue';
  });

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  };

  const toggleTheme = () => {
    if (theme === 'ocean-blue') {
      setTheme('emerald-teal');
    } else if (theme === 'emerald-teal') {
      setTheme('crimson-red');
    } else if (theme === 'crimson-red') {
      setTheme('carrybee-amber');
    } else {
      setTheme('ocean-blue');
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.remove('theme-ocean', 'theme-emerald', 'theme-crimson', 'theme-amber');
    if (theme === 'emerald-teal') {
      root.classList.add('theme-emerald');
    } else if (theme === 'crimson-red') {
      root.classList.add('theme-crimson');
    } else if (theme === 'carrybee-amber') {
      root.classList.add('theme-amber');
    } else {
      root.classList.add('theme-ocean');
    }
  }, [theme]);

  const currentThemeOption = THEME_OPTIONS.find((t) => t.id === theme) || THEME_OPTIONS[0];

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        currentThemeOption,
        isEmerald: theme === 'emerald-teal',
        isOcean: theme === 'ocean-blue',
        isCrimson: theme === 'crimson-red',
        isAmber: theme === 'carrybee-amber',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
