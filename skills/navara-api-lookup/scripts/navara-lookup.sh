#!/usr/bin/env bash
# navara-lookup.sh — local-corpus API lookups for Navara (no web fetch, no guessing).
#
# Usage:
#   navara-lookup.sh prop <name>          exact property/option: docs body + type/impl sites
#   navara-lookup.sh keys                 every registered addMesh/addEffect/addLight key
#   navara-lookup.sh find <term>          everywhere: docs + TS/WASM types + examples
#   navara-lookup.sh doc <term>           docs pages mentioning the term, with live URLs
#   navara-lookup.sh example <term>       example pages that use the term
#   navara-lookup.sh url <docs-path> [anchor]   doc file path -> https://navara.world/docs/... URL
#
# Env: NAVARA_LOOKUP_MAX (default 40) caps matched lines printed per section.
# Exit status: 0 when something matched, 1 when nothing matched.
set -uo pipefail

SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd -P "$SCRIPT_DIR/../../.." && pwd)"

DOCS="$ROOT/docs/src/content/docs"
DESCS="$ROOT/web/navara_three_default_plugins/src"  # placeholder, replaced below
DESCS="$ROOT/web/navara_three_default_descs/src"
THREE="$ROOT/web/navara_three/src"
PLUGINS="$ROOT/web/navara_three_plugins/src"
MLS="$ROOT/web/navara_maplibre_style/src"
EXAMPLES="$ROOT/web/navara_three/example/pages"
DEF_PLUGIN="$ROOT/web/navara_three_default_plugin/src/index.ts"
WASM_DTS="$ROOT/web/wasm/navara_engine/navara_wasm.d.ts"

EXCLUDES=(--exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git
          --exclude-dir=target --exclude-dir=.astro --exclude-dir=build
          --exclude-dir=coverage --exclude-dir=.cache)
# The English corpus is the source of truth; `ja/` is a translation mirror. Search
# it only when the English text has nothing, or explicitly via NAVARA_LOOKUP_LOCALE=ja.
DOCFILTER=(--exclude-dir=ja)
if [ "${NAVARA_LOOKUP_LOCALE:-en}" = "ja" ]; then
  DOCS="$DOCS/ja"
  DOCFILTER=()
fi
MAX="${NAVARA_LOOKUP_MAX:-40}"

usage() {
  sed -n '/^# Usage:/,/^# Env:/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

search() { # search <path> <pattern> [extra grep args...]   (ERE, skips binaries)
  local path="$1"; shift
  local pat="$1"; shift
  [ -e "$path" ] || return 1
  grep -rnIE "${EXCLUDES[@]}" "$@" -- "$pat" "$path" 2>/dev/null
}

slug_segment() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr ' ' '-'; }

# Docs search that prefers the English corpus and falls back to the `ja/` mirror
# only when English has no hit (a translated page is better than nothing, but
# never both — that is just duplicate output).
doc_search() {
  local pat="$1"; shift
  local out
  out="$(search "$DOCS" "$pat" "${DOCFILTER[@]}" "$@")"
  if [ -z "$out" ] && [ "${NAVARA_LOOKUP_LOCALE:-en}" != "ja" ]; then
    out="$(search "$DOCS/ja" "$pat" "$@")"
  fi
  [ -z "$out" ] || printf '%s\n' "$out"
}

# docs file path -> live URL. Mirrors the Starlight slugs: lowercase, spaces ->
# hyphens, locale dir promoted into the path, extension dropped, 'index' dropped.
url_for() {
  local p="$1" anchor="${2:-}" locale="" out="" seg
  p="${p#"$ROOT"/}"
  p="${p#docs/src/content/docs/}"
  p="${p%.md}"; p="${p%.mdx}"
  case "$p" in
    ja/*) locale="ja/"; p="${p#ja/}" ;;
  esac
  local IFS='/'
  for seg in $p; do
    [ "$seg" = "index" ] && continue
    out="$out/$(slug_segment "$seg")"
  done
  unset IFS
  out="${out#/}"
  printf 'https://navara.world/docs/%s%s/%s' "$locale" "$out" "${anchor:+#$anchor}"
}

# Definition sites for a field name, most precise pattern first.
impl_hits() {
  local name="${1:?}" pat
  pat="(readonly +$name\\b)|(^ *$name\\??:)|(^ *(public|private|protected) +$name\\??:)|(get +$name\\(\\))|(set +$name\\()|(\"$name\" *=)|(^ *$name\\(\\) *:)"
  { search "$WASM_DTS" "get +$name\\(\\)" | head -3
    search "$THREE" "$pat" --include='*.ts' | head -6
    search "$DESCS" "$pat" --include='*.ts' | head -6
    search "$PLUGINS" "$pat" --include='*.ts' | head -4
    search "$MLS" "$pat" --include='*.ts' | head -4
  } | sed "s|$ROOT/||" | awk '!seen[$0]++' | head -12
}

cmd_prop() { # exact option heading in docs + the concrete type/impl sites
  local name="${1:-}"
  [ -n "$name" ] || { echo "usage: navara-lookup.sh prop <name>" >&2; return 2; }
  local found=0 f url
  while IFS= read -r f; do
    url="$(url_for "$f" "$name")"
    awk -v file="${f#"$ROOT"/}" -v url="$url" -v name="$name" '
      /^#{2,4} / { if (hit) exit; if ($0 == "### " name || $0 == "## " name) { hit = 1; ln = FNR } }
      hit && !/^#{2,4} / {
        if ($0 ~ /^\*\*Type:\*\*/) type = $0
        if ($0 ~ /^\*\*Default:\*\*/) def = $0
        if ($0 ~ /^\*\*Description:\*\*/ && desc == "") desc = $0
      }
      END {
        if (!hit) exit 1
        printf "### %s\n  %s:%d\n  %s\n", name, file, ln, url
        if (type != "") print "  " type
        if (def != "") print "  " def
        if (desc != "") print "  " substr(desc, 1, 400)
        print ""
      }' "$f"
    found=$((found + 1))
  done < <(doc_search "^#{2,4} $name\$" | cut -d: -f1 | sort -u | head -12)

  [ "$found" -gt 0 ] || echo "docs: no '### $name' heading (try: navara-lookup.sh find $name)"
  echo "--- type / impl (authoritative when docs lag) ---"
  impl_hits "$name"
  [ "$found" -gt 0 ]
}

cmd_keys() { # every key you can pass to addMesh/addEffect/addLight
  echo "--- descriptor keys (web/navara_three_default_plugin/src/index.ts) ---"
  [ -f "$DEF_PLUGIN" ] || { echo "plugin source not found: $DEF_PLUGIN" >&2; return 1; }
  grep -nE 'register(Mesh|Effect|Light)\("' "$DEF_PLUGIN" | sed -E 's/^/  /'
  echo
  echo "--- source / layer type strings (web/navara_three/src/type) ---"
  search "$THREE/type" 'type: "[a-z0-9-]+"' | sed "s|$ROOT/||" | sort -u -t: -k3 | head -20
}

cmd_doc() { # docs pages matching a term, with URLs
  local term="${1:-}"
  [ -n "$term" ] || { echo "usage: navara-lookup.sh doc <term>" >&2; return 2; }
  local f n=0
  while IFS= read -r f; do
    n=$((n + 1))
    printf '%s\n  %s\n' "$(url_for "$f")" "${f#"$ROOT"/}"
  done < <(doc_search "$term" | cut -d: -f1 | sort -u | head -15)
  [ "$n" -gt 0 ] || echo "no docs page mentions '$term'"
  [ "$n" -gt 0 ]
}

cmd_example() { # example pages (dirs) that mention a term
  local term="${1:-}"
  [ -n "$term" ] || { echo "usage: navara-lookup.sh example <term>" >&2; return 2; }
  local dirs
  # Rank by hit count: a page with many matches is the more likely reference impl.
  dirs="$(search "$EXAMPLES" "$term" | cut -d: -f1 |
    while IFS= read -r f; do dirname "${f#"$ROOT"/}"; done |
    sort | uniq -c | sort -rn | awk '{print $2}' | head -12)"
  if [ -z "$dirs" ]; then
    echo "  (no example page mentions '$term')"
    return 1
  fi
  printf '%s\n' "$dirs" | sed 's/^/  /'
}

cmd_find() { # the default: docs + types + examples, grouped and capped
  local term="${1:-}"
  [ -n "$term" ] || { echo "usage: navara-lookup.sh find <term>" >&2; return 2; }
  local files lines

  echo "===== docs ====="
  files="$(doc_search "$term" | cut -d: -f1 | sort -u | head -10)"
  if [ -z "$files" ]; then
    echo "  (none)"
  else
    printf '%s\n' "$files" | while IFS= read -r f; do
      printf '  %s\n    %s\n' "$(url_for "$f")" "${f#"$ROOT"/}"
    done
    lines="$(doc_search "$term" | head -"$MAX")"
    [ -n "$lines" ] && printf '%s\n' "$lines" | sed "s|$ROOT/||;s/^/    /"
  fi

  echo
  echo "===== types / impl ====="
  { search "$WASM_DTS" "$term" | head -8
    search "$THREE" "$term" --include='*.ts' | head -8
    search "$DESCS" "$term" --include='*.ts' | head -8
    search "$PLUGINS" "$term" --include='*.ts' | head -5
    search "$MLS" "$term" --include='*.ts' | head -5
  } | sed "s|$ROOT/||" | awk '!seen[$0]++' | head -"$MAX" | sed 's/^/  /'

  echo
  echo "===== examples ====="
  cmd_example "$term"
  return 0
}

main() {
  local cmd="${1:-help}"
  shift || true
  case "$cmd" in
    prop)    cmd_prop "$@" ;;
    keys)    cmd_keys ;;
    find)    cmd_find "$@" ;;
    doc)     cmd_doc "$@" ;;
    example) cmd_example "$@" ;;
    url)     url_for "$@" ;;
    help|-h|--help|"") usage ;;
    *) echo "unknown command: $cmd (try: help)" >&2; return 2 ;;
  esac
}

main "$@"
