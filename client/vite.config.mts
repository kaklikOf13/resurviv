import { defineConfig } from "vite";

export default defineConfig(() => {
    return {
        base: "",
        build: {
            chunkSizeWarningLimit: 1000,
            rollupOptions: {
                output: {
                    assetFileNames(assetInfo) {
                        if (assetInfo.name?.endsWith(".css")) {
                            return "css/[name]-[hash][extname]";
                        }
                        return "assets/[name]-[hash][extname]";
                    },
                    entryFileNames: "js/app-[hash].js",
                    chunkFileNames: "js/[name]-[hash].js",
                    manualChunks(id, chunkInfo) {
                        if (id.includes("node_modules")) {
                            return "vendor";
                        } else if (id.includes("shared")) {
                            return "shared";
                        }
                    },
                }
            },
        },
        resolve: {
            extensions: ['.js', '.ts'],
        },
        server: {
            port: 3000,
            strictPort: true,
            host: "0.0.0.0"
        },
        preview: {
            port: 3000,
            strictPort: true,
            host: "0.0.0.0"
        }
    };
});
