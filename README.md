# dropday. ✨

A lightweight Expo React Native app built from scratch in place of the former Vega provider-based app, on branch release-radar-v1. No video player, scraping plugins, provider loader, or legacy Vega runtime.

## Features
- Adaptive dark/light, phone/tablet-friendly Gen Z-style interface
- Discover, 14-day calendar, saved watchlist, settings
- Anime episode number, air date/time, timezone-aware (AniList)
- TV show episodes and schedule (TVmaze US broadcast; not international OTT premieres)
- Movie release dates in selected region (TMDB optional user API key)
- Search, category/date filters, bookmarks, local one-hour-before notifications
- Offline last-known schedule with 30-minute refresh cache, pull to refresh
- Optional violet/mint accent; local-only settings

## Important data distinctions
Movie \`release_date\` is not an OTT streaming premiere. TMDB discover dates can be theatrical/general release metadata. **No streaming platform or specific OTT premiere date is claimed unless independently confirmed.** AniList airing schedules may represent Japan broadcast, not Netflix/Crunchyroll streaming time. TVmaze schedule defaults to US broadcast. Check provider details for regional availability.

## Running
1. Install Node 20+ and Expo tooling.
2. \`npm install\`
3. \`npx expo start\` (scan via Expo Go on Android), or \`npx expo run:android\` to make a development APK.
4. In Settings, optionally enter your **own** TMDB API v3 key from https://www.themoviedb.org/settings/api for movie listings. Key is saved locally in AsyncStorage; do not store production secrets in app code.

## Sources
- https://anilist.gitbook.io/anilist-apiv2-docs/ (GraphQL)
- https://www.tvmaze.com/api (public broadcast schedule)
- https://developer.themoviedb.org/reference/discover-movie (optional)
- API/provider availability and usage terms apply.

## Notes
Caching supports offline viewing after a successful sync; this is not a guarantee of live availability. Reminder permission is requested on demand. If data services fail, a previously cached list remains visible.
This is a replacement application project, **not a Vega provider**. Main branch retains original app until a pull request is intentionally merged.
