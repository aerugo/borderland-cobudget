import login from "../utils/login";
import get from "../utils/get";
import { createRound } from "../utils/round";
import { createBucket } from "../utils/bucket";

describe("Bucket budget editing", () => {
  const roundSlug = `test-budget-${Date.now()}`;
  const bucketName = "Budget Test Bucket";

  before(() => {
    login();
    createRound(roundSlug);
    createBucket(roundSlug, bucketName);
  });

  it("should persist budget changes after editing", () => {
    // Add initial budget
    get("add-bucket-budget-button").click();

    // Add a cost item
    get("bucket-expense-item-description").type("Test Cost Item");
    get("bucket-expense-item-min-amount").type("500");
    get("add-budget-submit-buton").click();

    // Verify budget displays correctly
    get("bucket-cost-min-amount-view").should("contain", "500");

    // Now edit the budget - click edit button (the pencil icon next to "Budget")
    cy.get("h2").contains("Budget").parent().find("button").click();

    // Change the amount from 500 to 750
    get("bucket-expense-item-min-amount").clear().type("750");
    get("add-budget-submit-buton").click();

    // THIS IS THE KEY ASSERTION - bug causes old value (500) to show
    get("bucket-cost-min-amount-view").should("contain", "750");

    // Extra verification: reload and confirm persistence
    cy.reload();
    get("bucket-cost-min-amount-view").should("contain", "750");
  });
});
