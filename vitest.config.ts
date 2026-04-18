import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        pool: "vmThreads",
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            exclude: ["src/**/*.test.ts"],
        },
    },
});
