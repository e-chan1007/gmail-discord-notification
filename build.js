import { build} from "esbuild";
import { GasPlugin } from "esbuild-gas-plugin";

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/bundle.js',
  plugins: [GasPlugin]
});
