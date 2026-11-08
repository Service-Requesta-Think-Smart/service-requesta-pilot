# Service-Requesta

**Think Smart**  
A controlled East London pilot for plumbing, electrical work, and motor mechanics.

Customers and service providers use one app and one sign-in service. Provider access requires a separate application review. Customers can save private demo requests while public bookings are closed.

## Safety and launch state

- Demo requests stay private and cannot become jobs.
- Public bookings, provider dispatch, commission enforcement, email reminders, and electronic payments are disabled by default.
- Real requests, addresses, quote approval, completion, support, and commission records are implemented behind database gates.
- Service addresses and phone numbers stay private until a customer approves a provider's quote.
- Money values use integer cents; commission terms require a legally approved database configuration.
- Do not turn on launch flags until legal/accounting review and operational checks are complete.

See docs/provider-workflow.md for the end-to-end process and roadmap.md for current readiness.
