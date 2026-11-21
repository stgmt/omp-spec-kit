import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { Given, Then, When } from "@cucumber/cucumber";

Given("the candidate is in the public-init stage", async function () {
  this.status = await readFile(".specs/product/README.md", "utf8");
  assert.match(this.status, /current public-init candidate/u);
});

Given("no marketplace catalog, plugin package, release, or runtime evidence exists", async function () {
  for (const file of [".claude-plugin/marketplace.json", "plugins/omp-spec-kit/package.json", "release-candidate", "dist"]) {
    await assert.rejects(access(file), { code: "ENOENT" });
  }
});

When("a reader opens the product status", function () {
  this.current = this.status.split("## Current product status")[1].split("## Product identity")[0];
});

Then("the state is {string}", function (state) {
  assert.match(this.current, new RegExp(`\\| Public init \\| \`${state}\\b`, "u"));
});

Then("the status says there is no installable plugin", function () {
  assert.match(this.current, /has no installable plugin/u);
});

Then("no install command is presented as usable", function () {
  assert.doesNotMatch(this.current, /(?:npm install|omp plugin install)/iu);
});
