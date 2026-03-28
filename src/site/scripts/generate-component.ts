import fs from "fs";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("What do you want to name the component? ", (componentName: string) => {
  const isValidComponentName =
    componentName &&
    componentName.includes("-") &&
    componentName.toLowerCase() === componentName &&
    !/\s/g.test(componentName);
  if (!isValidComponentName) {
    console.log(
      'Component name must be in the format "app-component". All lowercase and minimum 2 words separated by hyphens'
    );
    rl.close();
    return;
  }
  componentName = componentName.trim();

  const dir = `./src/${componentName}`;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  function capitalizeFirstLetter(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  const pascalCase = componentName
    .split("-")
    .map((s) => capitalizeFirstLetter(s))
    .join("");

  const tsPath = `${dir}/${componentName}.ts`;
  if (!fs.existsSync(tsPath)) {
    fs.writeFileSync(
      tsPath,
      `import { BaseElement } from '../base-element/base-element';

export class ${pascalCase} extends BaseElement {
  constructor() {
    super();
  }

  html(): string {
    return \`{{${componentName}.html}}\`;
  }

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }
}

customElements.define('${componentName}', ${pascalCase});
`
    );
  }
  const cssPath = `${dir}/${componentName}.css`;
  if (!fs.existsSync(cssPath)) {
    fs.writeFileSync(cssPath, "");
  }
  const htmlPath = `${dir}/${componentName}.html`;
  if (!fs.existsSync(htmlPath)) {
    fs.writeFileSync(htmlPath, "");
  }

  const components: string[] = JSON.parse(fs.readFileSync("components.json", "utf8"));
  if (components.indexOf(componentName) === -1) {
    components.push(componentName);
    fs.writeFileSync("components.json", JSON.stringify(components));
  }

  let index = fs.readFileSync("src/index.ts", "utf8").split("\n");
  const importString = `import "./${componentName}/${componentName}.ts";`;
  if (index.indexOf(importString) === -1) {
    if (index[index.length - 1] === "") {
      index.pop();
    }
    index.push(importString);
    fs.writeFileSync("src/index.ts", index.join("\n"));
  }

  rl.close();
});
