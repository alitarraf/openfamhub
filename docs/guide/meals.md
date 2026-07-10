# Meals

Backed by [Mealie](https://mealie.io) — see [Mealie integration](/integrations/mealie)
for setup. Mealie isn't part of this repo; it's a separate self-hosted service this app
talks to over its REST API.

## Meals — weekly grid

A Sunday–Saturday grid of Breakfast / Lunch / Dinner / Snack, pulled from Mealie's own
meal plan. Recipe thumbnails are proxied and cached locally (never fetched at full
resolution) so the wall's meal grid stays fast even on modest hardware. Tap a
thumbnail with a linked recipe to open its detail view.

## Recipes

A read-only browse of Mealie's recipe library — this app never edits recipes, that
stays in Mealie's own UI. From a recipe detail view you can:

- **Add to grocery list** — pushes its ingredients into the shared shopping list.
- **Add to meal plan** — assigns it to a day/slot in Mealie's own meal plan, so it
  shows up both here and in Mealie's UI.

## Grocery

The shared shopping list — Mealie's, not a separate list — so items added by "Add to
grocery list" and anything you add in Mealie's own app both show up here. Tap to check
an item off; checked items stay visible (struck through) rather than vanishing, so a
tap doesn't make the row disappear mid-interaction.
