/**
 * Re-export the shared contract so all backend files import from "./contract.js".
 * tsx resolves the relative path to shared/contract.ts at runtime.
 */
export * from "../../shared/contract.js";
