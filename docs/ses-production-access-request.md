# AWS SES — production access request (get out of the sandbox)

Submit in the SES console: **Account dashboard → Request production access**.

- **Region:** eu-north-1 (Stockholm) — matches our config (`email-smtp.eu-north-1.amazonaws.com`).
- **Mail type:** Transactional
- **Website URL:** https://lambdamanager.com  *(replace with the real site when we have one)*

Before submitting: **verify the sending domain with DKIM** (not just a single address) — reviewers
look for this.

---

## Use case description (paste into the form)

ParadePaard is a payroll and HR platform for hospitality (horeca) employers in the Netherlands. We
send only transactional email to users who already have an account in the system, created by their
own employer. We do not send marketing or bulk promotional email, and we never email purchased,
rented, or scraped lists.

The messages we send are:

- Onboarding/invitation emails to employees added by their employer, containing a username and a
  one-time, time-limited link to set their password.
- Password-reset emails, sent only when the account owner requests one, with a single-use, expiring
  link.
- Contract-ready notifications (an employment contract is available to review/sign).
- Payslip-available notifications (a payslip can be viewed in the account).

Recipients are the employees and administrators of our client companies. The relationship is explicit
— they are onboarded into their employer's account — so there is a clear expectation of these
operational emails.

Bounce and complaint handling: we have SES event notifications (via SNS) configured for bounces and
complaints. Hard bounces and complaints are automatically added to a suppression list and disabled
for further sending; we do not retry hard bounces. We monitor bounce and complaint rates and keep
them well within SES limits. All mail is sent from our verified domain [your-verified-domain] with
DKIM and SPF configured, from a clear sender identity.

Expected volume: typically a few hundred to about [X,000] transactional emails per month in steady
state, with occasional short bursts during initial onboarding of a new client company (up to about
[Y,000] over a few days). Sending region is eu-north-1 (Stockholm) to keep EU personal data within
the EU.

We comply with the AWS Acceptable Use Policy and SES sending policies.

---

## Fill-in notes
- **[your-verified-domain]** — the domain you verify with DKIM before submitting.
- **[X,000] / [Y,000]** — honest, modest numbers. For ~2,500 mostly-idle users, steady state is
  ~500–1,500/month; an onboarding burst might be a couple thousand over a few days.
- Keep it framed as transactional (which it genuinely is) — that's the single biggest approval factor.
