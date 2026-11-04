import {describe,it,expect} from "vitest";
import {JSDOM} from "jsdom";
import fs from "node:fs";
import path from "node:path";
describe("Moodle DOM fixture",()=>{it("contains Moodle quiz root and question container",()=>{const html=fs.readFileSync(path.resolve("tests/fixtures/moodle.html"),"utf8");const d=new JSDOM(html).window.document;expect(d.querySelector("#page-mod-quiz-attempt")).not.toBeNull();expect(d.querySelectorAll(".que").length).toBeGreaterThanOrEqual(1);});});
