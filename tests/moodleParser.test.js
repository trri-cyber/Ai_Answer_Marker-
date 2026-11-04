import {describe,it,expect} from "vitest";
import {JSDOM} from "jsdom";
import fs from "node:fs";
describe("Moodle parser fixture",()=>{it("extracts question text and options",()=>{const d=new JSDOM(fs.readFileSync("tests/fixtures/moodle.html","utf8")).window.document;const q=d.querySelector(".que");expect(q.querySelector(".qtext").textContent).toContain("Which language");expect(q.querySelectorAll('input[type="radio"]')).toHaveLength(2);});});
