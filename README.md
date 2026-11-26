# 日本語 Daily

A daily Japanese-learning newspaper for Android. Each morning a new edition arrives: today's lesson, plus a few short supporting pieces that use only the grammar you have already met. Everything works offline.

Built with Expo (SDK 58), React Native, TypeScript, expo-router and SQLite. The lesson order follows Tae Kim's Guide to Japanese Grammar; all articles, examples, quizzes and illustrations are original.

## Running it

```bash
npm install
npx expo start          # then press a for Android, or w for the web preview
npm test                # publishing rules, content markup, search
npm run typecheck
```

To install on a phone, make a build with EAS:

```bash
npx eas build -p android --profile preview   # produces an installable .apk
```

The web preview is for quick checks only. On the web, the tab bar sits at the top of the screen; on Android it is at the bottom.

## How it fits together

| Folder | What lives there |
| --- | --- |
| `content/` | The article library as text files, plus categories, concepts, edition templates and cover settings |
| `scripts/content/` | The content compiler, which checks every article and writes `src/generated/content-pack.json` |
| `scripts/covers/` | Renders the cover illustrations from `content/covers.json` |
| `src/domain/` | Publishing rules: daily editions, back issues, lesson order and revision |
| `src/data/` | The two SQLite databases. `content.db` is rebuilt from the content pack; `user.db` holds reading history, bookmarks, quiz results and settings, and only changes through migrations |
| `src/app/` | Screens (expo-router) |
| `src/components/` | Reading, quiz and newspaper layout components |

User data rows have UUIDs, `updated_at` times, soft deletes and a `sync_outbox` table, so a sync service such as Supabase can be added later without reshaping the data.

## Writing articles

Articles are files in `content/articles/`. Run `npm run content` after any change: it refuses to build if a kanji has no reading, a concept is unknown, a related article is missing, or a lesson comes before its prerequisites.

Front matter:

```
id: particle-de
kind: core            # core, feature, vocab, everyday, japan_today or revision
category: grammar
stage: 2
difficulty: 2
minutes: 7
image: cover-particle-de
sequence: 220         # core lessons only: their place in the course
concepts: teaches particle-de; practises particle-ni-he
related: particle-ni-he, five-particle-mistakes
headline: で: where it happens   # no kanji in headlines or summaries
headlineJa: 「で」は場所と手段
summary: One or two sentences.
published: 2026-11-26
version: 1
```

Japanese markup: words are separated by spaces, and every kanji needs a reading, written `{漢字|かんじ}`. Blocks start with `::: example`, `breakdown`, `vocab`, `dialogue`, `mistake`, `callout`, `quote`, `image`, `kana` or `quiz` and end with `:::`. The existing articles show each one in use.

Supporting pieces must list the concepts they `practise`. A piece waits until the reader has finished the lessons that teach those concepts (the writing-system lessons never hold anything back, since every piece has furigana and translations).

Edition templates in `content/editions.json` decide which supporting pieces appear in which edition. Core lessons are not listed there; they are placed by the reader's progress.

To change an article later, copy the old file to `content/articles/history/<id>@<version>.md`, raise `version` and add a `changeNote`.

## Covers

Covers are original illustrations rendered from `content/covers.json`. To render them you need Noto Serif JP and Noto Sans JP font files:

```bash
FONT_DIR=/path/to/fonts npm run build:covers
npm run content
```

Photos can replace any cover: drop a JPEG in `assets/covers/`, add it to `content/images.json` with its credit and licence, and rebuild the content.

## Licences

Fonts are under the SIL Open Font License (see `assets/fonts/`). The curriculum order credits Tae Kim's Guide to Japanese Grammar; no text from the guide is reproduced.
