<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application architecture
- Keep reusable customer UI and input schemas under feature modules; leaf routes own metadata so public and private surfaces remain distinct.
- Use authenticated server functions and transactional database RPCs for customer writes; RLS and database guards enforce consent, ownership and demonstration isolation.
- Keep future provider/admin/money modules locked until their workflows and release gates are verified; schema presence is not operational readiness.
- Maintain one root auth identity-transition subscriber and query-cache teardown on sign-out to prevent private-state leakage.
