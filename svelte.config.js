import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess(),
  vitePlugin: {
    // このリポジトリのコンポーネントだけを runes で扱う（依存パッケージには干渉しない）。
    dynamicCompileOptions({ filename }) {
      if (!filename.includes("node_modules")) return { runes: true };
    }
  }
};
