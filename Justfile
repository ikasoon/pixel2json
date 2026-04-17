set shell := ["bash", "-c"]

APP_DIR := "."
SV_TEMPLATE := "minimal"
SV_TYPES := "ts"
SV_ADDONS := "eslint prettier"
SV_INSTALL := "pnpm"
DEV_HOST := "0.0.0.0"
DEV_PORT := "5173"
LOCAL_ENV_FILE := ".env.development.local"

# Default action (displays command list when typing just)
default:
    @just --list

[doc("Check local tools required for frontend work")]
check-web-prereqs:
    command -v node >/dev/null
    command -v pnpm >/dev/null
    command -v just >/dev/null
    node --version
    pnpm --version
    just --version

[doc("Create a new SvelteKit app with pnpm in the target directory")]
init-web path=APP_DIR template=SV_TEMPLATE types=SV_TYPES addons=SV_ADDONS install=SV_INSTALL:
    pnpm dlx sv create --template {{ template }} --types {{ types }} --add {{ addons }} --install {{ install }} --no-dir-check {{ path }}

[doc("Install web dependencies")]
install-web:
    cd {{ APP_DIR }} && pnpm install

[doc("Run the app in a web environment (host, web-server)")]
run-web host=DEV_HOST port=DEV_PORT:
    cd {{ APP_DIR }} && pnpm dev --host {{ host }} --port {{ port }}

[doc("Run SvelteKit type and app checks")]
check-web:
    cd {{ APP_DIR }} && pnpm check

[doc("Run formatting and lint checks for the web app")]
lint-web:
    cd {{ APP_DIR }} && pnpm lint

[doc("Format web app source files")]
format-web:
    cd {{ APP_DIR }} && pnpm format

[doc("Build the web app for release deployment (host)")]
build-web: check-web
    cd {{ APP_DIR }} && pnpm build
