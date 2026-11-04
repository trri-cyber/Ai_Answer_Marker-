import {describe,it,expect} from "vitest";
const normalize=t=>String(t||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,"");
describe("question normalization",()=>{it("normalizes case and whitespace",()=>expect(normalize("  WHAT  Is AI? ")).toBe("what is ai"));});
