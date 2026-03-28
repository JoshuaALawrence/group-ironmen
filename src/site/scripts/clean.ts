import fs from "fs";
import { globSync } from "glob";

const files = [
  ...globSync("public/*.js"),
  ...globSync("public/*.map"),
  ...globSync("public/*.html"),
];

for (const file of files) {
  fs.rmSync(file);
}
