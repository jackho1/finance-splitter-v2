import '@testing-library/jest-dom/vitest';
import axios from 'axios';

// Mock DOM methods that might not be available in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: () => Promise.resolve()
  }
});

// Mock localStorage
const localStorageMock = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
};
global.localStorage = localStorageMock;

// Create a global axios mock
const mockAxios = {
  put: () => Promise.resolve({ data: { success: true } }),
  get: () => Promise.resolve({ data: [] }),
  post: () => Promise.resolve({ data: { success: true } }),
  delete: () => Promise.resolve({ data: { success: true } })
};

// Replace axios with our mock
Object.assign(axios, mockAxios); 