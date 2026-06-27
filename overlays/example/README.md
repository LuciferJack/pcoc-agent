# Example overlay

This directory is a **template**. It is the only overlay committed to
the public repo. Use it as a starting point for your own overlays.

## To clone this template

```bash
cp -r overlays/example overlays/<my-overlay-name>
$EDITOR overlays/<my-overlay-name>/overlay.yaml
ln -sfn <my-overlay-name> overlays/_active
```

Your copy is gitignored automatically (see `.gitignore`). Only this
template stays in the repo.

## What to change

In your copy of `overlay.yaml`:

1. **`name`**: change `example` to your overlay name (e.g., `work`,
   `quant`, `personal`)
2. **`allowed_paths`**: replace the placeholder with the real paths
   you want the agent to be able to read in this overlay
3. **`denied_paths`**: keep the credential-store defaults; ADD
   paths from your other overlays (e.g., if you have a `quant`
   overlay, your `work` overlay should deny `~/quant/`)
4. **`sensitive_terms_file`**: change the path to point to your
   per-overlay sensitive-terms file (typically
   `~/.pcoc/sensitive-terms.<name>.local.txt`)
5. **`memory_partition`**: change to a name unique to this overlay

## Test your overlay

Before using it for real work:

```bash
# Activate it
ln -sfn <my-overlay-name> overlays/_active

# Confirm the hooks see it
node .claude/hooks/session-init.cjs <<< '{}'

# Confirm denied paths actually get blocked
echo '{"tool_name":"Read","tool_input":{"file_path":"~/.ssh/id_rsa"}}' | \
    node .claude/hooks/privacy-guard.cjs
# Should print a refusal and exit 2.
```

See `docs/PRIVACY.md` for the full setup walkthrough.
