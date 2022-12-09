import { defineConfig } from '@surmon-china/libundler'

export default defineConfig({
  libName: 'MongoDBDataAPI',
  outFileName: 'mongodb-data-api-fetch',
  targets: ['cjs', 'esm'],
  entry: './src/index.ts',
  outDir: './dist',
  external: ['mongodb'],
  terser: false,
  sourcemap: false
})
