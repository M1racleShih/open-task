import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({executablePath:"/usr/bin/google-chrome",headless:true,args:["--no-sandbox"]});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto("http://127.0.0.1:4310");
 await page.getByLabel("Username",{exact:true}).fill("leader");
 await page.getByLabel("Password",{exact:true}).fill("OpenTask-Test-2026!");
 await page.getByRole("button",{name:"Sign in",exact:true}).click();
 await page.locator(".task-row").first().waitFor();
 await page.goto("http://127.0.0.1:4310/?task=58c649c9-740c-433f-9134-f7725a6b4b4e");
 const box=page.locator('.checklist-card input[type="checkbox"]:checked').first();
 await box.waitFor();
 const checks=[];
 for(const theme of ["light","dark"]) {
  if(theme==="dark") await page.getByLabel("Switch theme",{exact:true}).click();
  await expect(box).toBeDisabled();
  const result=await box.evaluate(e=>({background:getComputedStyle(e).backgroundColor,opacity:getComputedStyle(e).opacity,checked:(e as HTMLInputElement).checked}));
  expect(result.background).toBe("rgb(94, 145, 173)");
  expect(result.opacity).toBe("1");
  expect(result.checked).toBe(true);
  checks.push({theme,...result});
  await page.screenshot({path:`artifacts/checklist-color-${theme}.png`});
 }
 await writeFile("artifacts/checklist-color.json",JSON.stringify(checks,null,2));
} finally {await browser.close();}
