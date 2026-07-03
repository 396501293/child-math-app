import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: '/child-math-app/',
  plugins: [preact()],
});
