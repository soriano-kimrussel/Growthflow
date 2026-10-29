import { expect, test, type Locator, type Page } from "@playwright/test";

/** Drags with real pointer events so dnd-kit's PointerSensor picks it up. */
async function dragTo(page: Page, source: Locator, target: Locator) {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Could not measure drag source or target");
  await page.mouse.move(from.x + 20, from.y + 15);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + 30, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 20 });
  await page.mouse.up();
}

test("sign up, create a contact, move an opportunity across the board, see the timeline", async ({ page }) => {
  const email = `owner-${Date.now()}@e2e.test`;

  // Sign up: creates the agency, its admin, and a first sub-account.
  await page.goto("/signup");
  await page.getByLabel("Agency name").fill("E2E Agency");
  await page.getByLabel("Your name").fill("Erin Owner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create agency" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  // Create a contact.
  await page.goto("/contacts/new");
  await page.getByLabel("First name").fill("Jamie");
  await page.getByLabel("Last name").fill("Rivera");
  await page.getByLabel("Email").fill("jamie@example.com");
  await page.getByLabel("Tags").fill("lead, website");
  await page.getByRole("button", { name: "Create contact" }).click();
  await expect(page.getByRole("heading", { name: "Jamie Rivera" })).toBeVisible();
  await expect(page).toHaveURL(/\/contacts\/(?!new$)[^/]+$/);
  const contactUrl = page.url();
  const timeline = page.getByRole("list", { name: "Activity timeline" });
  await expect(timeline).toContainText("Contact created");
  await expect(timeline).toContainText('Tag "lead" added');

  // The contact shows up in the list and search.
  await page.goto("/contacts?q=rivera");
  await expect(page.getByRole("link", { name: "Jamie Rivera" })).toBeVisible();

  // Create an opportunity in the first stage.
  await page.goto("/opportunities");
  const form = page.getByRole("form", { name: "New opportunity" });
  await form.getByLabel("Title").fill("Website redesign");
  await form.getByLabel("Value ($)").fill("2500");
  await form.getByRole("button", { name: "Add opportunity" }).click();

  const newLead = page.getByRole("region", { name: "Stage New Lead" });
  const contacted = page.getByRole("region", { name: "Stage Contacted" });
  const card = page.getByRole("button", { name: "Opportunity Website redesign" });
  await expect(newLead.getByRole("button", { name: "Opportunity Website redesign" })).toBeVisible();

  // Drag it to the next stage.
  await dragTo(page, card, contacted);
  await expect(contacted.getByRole("button", { name: "Opportunity Website redesign" })).toBeVisible();
  await expect(newLead.getByRole("button", { name: "Opportunity Website redesign" })).toHaveCount(0);

  // The move persisted (survives a reload) ...
  await page.reload();
  await expect(contacted.getByRole("button", { name: "Opportunity Website redesign" })).toBeVisible();

  // ... and was written to the contact's timeline.
  await page.goto(contactUrl);
  await expect(timeline).toContainText('"Website redesign" moved from New Lead to Contacted');
  await expect(timeline).toContainText('Opportunity "Website redesign" created in New Lead');
});
