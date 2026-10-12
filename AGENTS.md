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
- Keep the uploaded terminal's indicator rules in a browser-safe trading module, separate from presentation, so analysis remains testable.
- Use session-only simulated data and paper-trade state in the redesign; do not imply broker connectivity or durable risk enforcement without a connected service.
- Define all trading visual roles and component styles in the global semantic design system for a consistent terminal.
- Live prices come from Binance's free public candle feed, fetched in the browser, only for assets that list there; other assets stay simulated and are labeled so — no key or backend needed.
