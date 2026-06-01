# AGENTS.md

## Main instruction

When Codex changes the frontend UI in this project, Codex must not only look at the single element that was changed.

Codex must also review the full surrounding UI and general page presentation so the result fits the rest of the product.

This means Codex must check the whole visible experience, not just the direct feature request.

## UI review requirement

For every frontend UI change, Codex must inspect and think through all of the following:

1. General layout
   - page structure
   - section order
   - content grouping
   - container widths
   - alignment
   - balance between left, center, and right areas
   - how the page looks as a whole

2. Spacing and sizing
   - padding
   - margins
   - gaps between sections
   - gaps between fields
   - button height
   - input height
   - card spacing
   - row spacing
   - whitespace density

3. Visual style
   - colors
   - background colors
   - text colors
   - border colors
   - shadows
   - corner radius
   - dividers
   - contrast
   - whether the styling matches the rest of the app

4. Typography
   - font size
   - font weight
   - line height
   - heading hierarchy
   - label clarity
   - helper text
   - error text
   - readability

5. Component consistency
   - buttons
   - inputs
   - selects
   - textareas
   - cards
   - tables
   - badges
   - navigation items
   - modals
   - empty states
   - loading states
   - error states

6. Interaction states
   - hover
   - active
   - focus
   - disabled
   - selected
   - validation states
   - whether these states are clear and visually consistent

7. Navigation and flow
   - page entry points
   - back buttons
   - action placement
   - primary versus secondary actions
   - whether the user flow feels logical
   - whether the page is easy to scan and use

8. Responsiveness
   - desktop layout
   - tablet layout
   - mobile layout
   - wrapping behavior
   - overflow issues
   - whether spacing and hierarchy still look correct on smaller screens

9. Surrounding pages
   - whether the changed page still matches neighboring pages
   - whether the UI still feels like part of the same application
   - whether one improved part now makes another nearby part look inconsistent

## Expected behavior

Codex must not treat a UI request as a tiny isolated patch.

If one UI element is changed, Codex must also check whether nearby layout, spacing, styling, hierarchy, and consistency need adjustment.

Codex should aim for a polished result across the full screen, not only a technically correct local fix.

## Git requirement

After finishing the requested work and updating the rundown file, Codex must push the changes to GitHub.

Codex must run these commands:

```bash
git status
git add .
git commit -m "Appropriate commit message here"
git push
```

The commit message must clearly describe the actual work that was completed.
