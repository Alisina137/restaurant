import { readdir, readFile } from "node:fs/promises";
if (process.env.NODE_ENV === "production")
  throw new Error("Local inbox is development-only.");
try {
  const files = (await readdir(".local-mail"))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .slice(-10);
  for (const file of files) {
    const mail = JSON.parse(await readFile(`.local-mail/${file}`, "utf8"));
    console.log(`\nTo: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}`);
  }
  if (!files.length) console.log("No local email yet.");
} catch {
  console.log("No local email yet. Register an account first.");
}
