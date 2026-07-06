# ParadePaard — Hosting Options & Costs (plain-language guide)

*A short, non-technical overview of where the app can "live" online, what it costs, and why.*

## The one idea to grasp first

Hosting the app is like **renting a shop that's open 24/7**. You pay rent for the space whether 5
customers or 500 are inside — until it gets so crowded you need a bigger shop.

For us, the shop is rarely crowded. We have about **2,500 users, but almost all of them barely
visit**: most work a few times a year, some monthly or weekly, only ~100 work full-time, plus 5 very
active admins. At the busiest moment maybe **100–150 people are "inside" at once** — easily handled by
a modest space.

So the bill is mostly a **flat cost, not a per-user cost**:

- An almost-idle user (a few times a year): essentially **€0 extra**.
- A monthly or weekly user: at most a **few cents**.
- A very active full-timer or admin: **a bit more** — but even all of them together don't fill the shop.

That's why 2,500 mostly-idle users cost about the same as 500 would. We're paying for the always-on
space, a safe home for the data, and backups — **not for headcount**.

## What the money actually buys (three parts)

1. **The server** — the always-on computer that runs the software. Our app is a little "heavy," so it
   needs a decent-sized one. *(the biggest cost)*
2. **The database** — where all the payroll and personal data lives. This is the part worth paying to
   protect. *(second cost)*
3. **The extras** — automatic backups (insurance against losing data), the web address, and the
   security certificate (the padlock in the browser). *(small)*

## The options, ranked with prices

Prices are **per month, for the whole company / all users** — rough estimates in euros.

| Option | ~€/month | Best for | Why this price |
|---|---|---|---|
| **Budget** — one server, we handle the data ourselves | **€35–90** | Going live cheaply while we're small | Inexpensive server; we run the backups ourselves (takes discipline) |
| **Recommended** — one server + a *managed* database | **€130–220** | Our situation right now | Adds a professional database that backs itself up automatically — far less risk, still simple |
| **Most stable (AWS-grade)** — big cloud provider, extra safety | **€250–400** | Later, or if a large client demands top reliability | Everything managed, plus a standby that takes over instantly if the main one fails |

All three keep the data **inside the EU** (legally required for payroll and personal data), use
encrypted connections, and include backups.

**For where we are today, the "Recommended" tier (~€130–220/month) is the sweet spot.** The budget
option is genuinely fine *if* we commit to doing backups properly; the most expensive is more
reliability than our current traffic needs.

## What if a new client brings +1,000 users?

It **barely changes the bill.** Those users would also be mostly idle, so they add very little
"crowd." Expect a **small bump** (a slightly larger database), not a jump to the next tier. The app
already keeps each client company's data separate, so onboarding a client is a **setup task, not a
rebuild** — we don't stand up new hosting for each one.

## How hard is it to switch providers later?

**Easy — we're not locked in.** The app was deliberately built to be portable (a big reason for the
recent "production-readiness" work). Moving to a more powerful, more stable provider like AWS is
mostly two steps:

1. copy the data across,
2. point the web address at the new home.

That's roughly a **day or a few**, usually done during a short planned maintenance window. So the
sensible path is: **start on the affordable tier now, and step up to AWS-grade only when a bigger
client or real growth makes it worth it** — with very little pain when we do.

## Bottom line

- The cost comes from the **always-on system + safe data storage + backups**, *not* from how many
  people are signed up.
- **Recommended: ~€130–220/month** for our current size; **~€35–90/month** if we go lean.
- More users — even +1,000 idle ones — means only a **small** change.
- Upgrading to AWS-grade later is straightforward; the app was built to move.

*All figures are rough ballparks (they vary by provider and change over time) and cover the whole
company, not per user.*
