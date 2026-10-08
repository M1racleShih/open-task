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
 const row=page.locator(".project-group").filter({hasText:"Browser project 06ab9de4"}).locator(".task-row").first();
 const checks=[];
 for(const theme of ["light","dark"]) {
  if(theme==="dark") await page.getByLabel("Switch theme",{exact:true}).click();
  await row.click();
  await expect(row).toHaveClass(/selected/);
  const colors=await row.evaluate(e=>{
   const s=getComputedStyle(e);
   const probe=document.createElement("span");
   probe.style.background="color-mix(in srgb, var(--project-color) 16%, var(--panel))";
   e.append(probe); const expected=getComputedStyle(probe).backgroundColor; probe.style.color="var(--project-color)"; const expectedOutline=getComputedStyle(probe).color; probe.remove();
   return {background:s.backgroundColor,expected,text:s.color,outline:s.outlineStyle,outlineColor:s.outlineColor,expectedOutline};
  });
  expect(colors.background).toBe(colors.expected);
  expect(colors.outline).toBe("solid");
  expect(colors.outlineColor).toBe(colors.expectedOutline);
  await row.hover();
  expect(await row.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe(colors.expected);
  checks.push({theme,...colors});
  await page.screenshot({path:`artifacts/task-selection-${theme}.png`});
 }
 await writeFile("artifacts/task-selection-color.json",JSON.stringify(checks,null,2));
} finally {await browser.close();}
