# Conversations Thread Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the admin shared inbox so the selected thread header shows avatar plus name only, the name alone links to the user profile, and the message timeline uses viewer-local WhatsApp-style day grouping with time-only labels.

**Architecture:** Keep the existing shared inbox data flow intact and localize the change to the shared inbox rendering layer. Reuse the current avatar cache, narrow the clickable target in the thread header, and derive date separators plus local time labels from existing message timestamps in the browser.

**Tech Stack:** React 19, React Router, TypeScript, Vitest, existing app CSS

---

### Task 1: Lock the revised header and timeline behavior in tests

**Files:**
- Modify: `Program/frontend/src/pages/AdminMessages.test.tsx`
- Test: `Program/frontend/src/pages/AdminMessages.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("renders the selected thread header without email and only the name as the profile link", () => {
    const html = renderToStaticMarkup(
        <MemoryRouter>
            <AdminMessagesView
                conversations={[selectedConversation, otherConversation]}
                selectedConversation={selectedConversation}
                avatarUrls={{ "user-1": "blob:avatar-1" }}
                loading={false}
                detailLoading={false}
                error={null}
                detailError={null}
                draft=""
                sending={false}
                sendError={null}
                onSelectConversation={() => undefined}
                onDraftChange={() => undefined}
                onSend={() => undefined}
                onBackToInbox={() => undefined}
            />
        </MemoryRouter>
    );

    expect(html).not.toContain("ava@example.com");
    expect(html).toContain('href="/management/users/user-1"');
    expect(html).toContain("messageThreadUserNameLink");
    expect(html).not.toContain("messageThreadUserLink");
});

it("groups thread messages with date separators and time-only labels", () => {
    const html = renderToStaticMarkup(
        <MemoryRouter>
            <AdminMessagesView
                conversations={[selectedConversation]}
                selectedConversation={selectedConversation}
                avatarUrls={{}}
                loading={false}
                detailLoading={false}
                error={null}
                detailError={null}
                draft=""
                sending={false}
                sendError={null}
                onSelectConversation={() => undefined}
                onDraftChange={() => undefined}
                onSend={() => undefined}
                onBackToInbox={() => undefined}
            />
        </MemoryRouter>
    );

    expect(html).toContain("messageDateSeparator");
    expect(html).not.toContain(">User</span>");
    expect(html).not.toContain(">Company</span>");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/AdminMessages.test.tsx`
Expected: FAIL because the header still shows email, the whole profile row is linked, and messages still render sender labels plus full date/time headers.

- [ ] **Step 3: Write minimal implementation**

```tsx
type GroupedThreadItem =
    | { kind: "separator"; label: string; key: string }
    | { kind: "message"; message: MessageEntryDTO; key: string };
```

- [ ] **Step 4: Run test to verify it still fails on the missing UI**

Run: `npm test -- src/pages/AdminMessages.test.tsx`
Expected: FAIL on the missing grouped timeline and clickable-name-only assertions rather than a type error.

- [ ] **Step 5: Commit**

```bash
git add Program/frontend/src/pages/AdminMessages.test.tsx
git commit -m "test: cover shared inbox grouped thread ui"
```

### Task 2: Implement clickable-name-only header and grouped timestamps

**Files:**
- Modify: `Program/frontend/src/pages/AdminMessages.tsx`
- Modify: `Program/frontend/src/stylesheets/Messages.css`
- Test: `Program/frontend/src/pages/AdminMessages.test.tsx`

- [ ] **Step 1: Run the failing test again before code changes**

Run: `npm test -- src/pages/AdminMessages.test.tsx`
Expected: FAIL with the same header/timeline expectation failures.

- [ ] **Step 2: Write minimal implementation**

```tsx
function formatThreadMessageTime(value?: string | null) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function buildGroupedThreadItems(messages: MessageEntryDTO[]): GroupedThreadItem[] {
    // derive browser-local day buckets and separator labels here
}

<div className="messageThreadIdentity">
    <div className={`messageThreadAvatar${selectedAvatarUrl ? " messageThreadAvatar--image" : ""}`} aria-hidden="true">
        ...
    </div>
    <div className="messageThreadHeading">
        <Link className="messageThreadUserNameLink" to={`/management/users/${selectedConversation.userId}`}>
            {getConversationDisplayName(selectedConversation)}
        </Link>
    </div>
</div>
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npm test -- src/pages/AdminMessages.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add Program/frontend/src/pages/AdminMessages.tsx Program/frontend/src/stylesheets/Messages.css Program/frontend/src/pages/AdminMessages.test.tsx
git commit -m "feat: group shared inbox thread messages"
```

### Task 3: Verify nearby messaging behavior and build

**Files:**
- Modify: `Program/frontend/src/pages/Messages.test.tsx` (only if a shared helper signature forces it)
- Test: `Program/frontend/src/pages/AdminMessages.test.tsx`
- Test: `Program/frontend/src/pages/Messages.test.tsx`
- Test: `Program/frontend/package.json`

- [ ] **Step 1: Run the shared inbox tests**

Run: `npm test -- src/pages/AdminMessages.test.tsx`
Expected: PASS

- [ ] **Step 2: Run a nearby messaging regression test**

Run: `npm test -- src/pages/Messages.test.tsx`
Expected: PASS

- [ ] **Step 3: Run the frontend build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit any final cleanup**

```bash
git add Program/frontend/src/pages/AdminMessages.tsx Program/frontend/src/stylesheets/Messages.css Program/frontend/src/pages/AdminMessages.test.tsx Program/frontend/src/pages/Messages.test.tsx Program/frontend/package.json Program/frontend/package-lock.json
git commit -m "chore: finalize shared inbox timeline polish"
```
